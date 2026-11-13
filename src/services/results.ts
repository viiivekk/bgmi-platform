import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { assertCan, type Actor } from "../auth/permissions";
import {
  ScoringConfigSchema, planApproval, validateResultSet, hasErrors,
  type ApprovedMatch, type ResultSetInput, type ValidationContext, type ValidationIssue,
} from "../engine";

type Tx = Prisma.TransactionClient;

/**
 * READ COMMITTED matters on MySQL: InnoDB's default REPEATABLE READ would keep reading the snapshot taken
 * before we waited for the tournament row lock, hiding the approval that just committed.
 */
const TX_OPTS = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 30_000 } as const;

export class ResultError extends Error {
  constructor(public code: string, message: string, public issues: ValidationIssue[] = []) {
    super(message);
    this.name = "ResultError";
  }
}

export interface DomainEvent {
  type: "result.approved" | "standings.updated";
  tournamentId: string;
  stageId: string;
  groupId: string;
  matchId: string;
}

const scopeOf = (tournamentId: string) => ({ type: "TOURNAMENT", id: tournamentId });
const json = (v: unknown) => v as Prisma.InputJsonValue;

async function audit(
  tx: Tx,
  a: { actorId: string; action: string; entityType: string; entityId: string; before?: unknown; after?: unknown; reason?: string },
) {
  await tx.auditLog.create({
    data: { actorId: a.actorId, action: a.action, entityType: a.entityType, entityId: a.entityId, before: a.before === undefined ? undefined : json(a.before), after: a.after === undefined ? undefined : json(a.after), reason: a.reason },
  });
}

async function loadMatch(tx: Tx, matchId: string) {
  const m = await tx.match.findUnique({ where: { id: matchId }, include: { stage: { include: { tournament: true } } } });
  if (!m) throw new ResultError("MATCH_NOT_FOUND", "match not found");
  if (m.status === "CANCELLED") throw new ResultError("MATCH_CANCELLED", "cannot record results for a cancelled match");
  return m;
}

/** Lobby = teams slotted into the match, else the group's teams. Roster = players active at match time. */
async function loadValidationContext(tx: Tx, match: { id: string; groupId: string | null; scheduledAt: Date; stage: { tournament: { squadSize: number } } }): Promise<ValidationContext> {
  let slots = await tx.lobbySlot.findMany({ where: { matchId: match.id }, select: { teamId: true } });
  if (slots.length === 0 && match.groupId) slots = await tx.lobbySlot.findMany({ where: { groupId: match.groupId }, select: { teamId: true } });
  const lobbyTeamIds = [...new Set(slots.map((s) => s.teamId))];
  const entries = await tx.rosterEntry.findMany({
    where: { teamId: { in: lobbyTeamIds }, joinedAt: { lte: match.scheduledAt }, OR: [{ leftAt: null }, { leftAt: { gte: match.scheduledAt } }] },
    select: { teamId: true, playerId: true },
  });
  const rosterByTeam = new Map<string, Set<string>>();
  for (const e of entries) (rosterByTeam.get(e.teamId) ?? rosterByTeam.set(e.teamId, new Set()).get(e.teamId)!).add(e.playerId);
  return { lobbyTeamIds, squadSize: match.stage.tournament.squadSize, rosterByTeam };
}

function toInput(set: { teamResults: { teamId: string; placement: number; eliminations: number }[]; playerResults: { playerId: string; teamId: string; eliminations: number; assists: number | null; damage: number | null; survivalSeconds: number | null }[] }): ResultSetInput {
  return { teams: set.teamResults.map(({ teamId, placement, eliminations }) => ({ teamId, placement, eliminations })), players: set.playerResults.map(({ playerId, teamId, eliminations, assists, damage, survivalSeconds }) => ({ playerId, teamId, eliminations, assists, damage, survivalSeconds })) };
}

async function loadApprovedMatches(tx: Tx, tournamentId: string): Promise<ApprovedMatch[]> {
  const sets = await tx.resultSet.findMany({
    where: { status: "APPROVED", match: { stage: { tournamentId } } },
    include: { teamResults: true, playerResults: true, match: { select: { id: true, stageId: true, groupId: true, matchNumber: true } } },
  });
  return sets.map((s) => ({
    matchId: s.match.id, matchNumber: s.match.matchNumber, stageId: s.match.stageId, groupId: s.match.groupId,
    teams: s.teamResults.map((t) => ({ teamId: t.teamId, placement: t.placement, eliminations: t.eliminations, placementPoints: t.placementPoints ?? 0, totalPoints: t.totalPoints ?? 0 })),
    players: toInput(s).players,
  }));
}

/** Create a DRAFT result set (manual entry or a parsed CSV/JSON import). */
export async function createDraft(
  prisma: PrismaClient, actor: Actor,
  p: { matchId: string; input: ResultSetInput; source?: "MANUAL" | "CSV" | "JSON"; note?: string },
): Promise<{ resultSetId: string; version: number }> {
  return prisma.$transaction(async (tx) => {
    const match = await loadMatch(tx, p.matchId);
    assertCan(actor, "results:write", scopeOf(match.stage.tournamentId));
    const last = await tx.resultSet.aggregate({ where: { matchId: p.matchId }, _max: { version: true } });
    const version = (last._max.version ?? 0) + 1;
    const set = await tx.resultSet.create({
      data: {
        matchId: p.matchId, version, source: p.source ?? "MANUAL", note: p.note, submittedById: actor.id,
        teamResults: { create: p.input.teams.map((t) => ({ teamId: t.teamId, placement: t.placement, eliminations: t.eliminations })) },
        playerResults: { create: p.input.players.map((x) => ({ playerId: x.playerId, teamId: x.teamId, eliminations: x.eliminations, assists: x.assists ?? null, damage: x.damage ?? null, survivalSeconds: x.survivalSeconds ?? null })) },
      },
    });
    await audit(tx, { actorId: actor.id, action: "RESULT_DRAFT_CREATED", entityType: "ResultSet", entityId: set.id, after: { matchId: p.matchId, version, source: p.source ?? "MANUAL" } });
    return { resultSetId: set.id, version };
  }, TX_OPTS);
}

/** A correction is a new draft that, once approved, supersedes the approved set. Reason is mandatory. */
export async function draftCorrection(
  prisma: PrismaClient, actor: Actor,
  p: { matchId: string; input: ResultSetInput; reason: string },
): Promise<{ resultSetId: string; version: number }> {
  if (p.reason.trim().length < 10) throw new ResultError("REASON_REQUIRED", "a correction needs a reason of at least 10 characters");
  const match = await prisma.match.findUnique({ where: { id: p.matchId }, include: { stage: true } });
  if (!match) throw new ResultError("MATCH_NOT_FOUND", "match not found");
  assertCan(actor, "results:correct", scopeOf(match.stage.tournamentId));
  const current = await prisma.resultSet.findFirst({ where: { matchId: p.matchId, status: "APPROVED" } });
  if (!current) throw new ResultError("NOTHING_TO_CORRECT", "this match has no approved result to correct");
  const created = await createDraft(prisma, actor, { matchId: p.matchId, input: p.input, note: `CORRECTION: ${p.reason}` });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "RESULT_CORRECTION_DRAFTED", entityType: "ResultSet", entityId: created.resultSetId, before: { supersedes: current.id, version: current.version }, reason: p.reason } });
  return created;
}

export async function submitResultSet(prisma: PrismaClient, actor: Actor, resultSetId: string): Promise<{ issues: ValidationIssue[] }> {
  return prisma.$transaction(async (tx) => {
    const set = await tx.resultSet.findUnique({ where: { id: resultSetId }, include: { teamResults: true, playerResults: true } });
    if (!set) throw new ResultError("NOT_FOUND", "result set not found");
    const match = await loadMatch(tx, set.matchId);
    assertCan(actor, "results:write", scopeOf(match.stage.tournamentId));
    if (set.status !== "DRAFT") throw new ResultError("BAD_STATE", `only DRAFT sets can be submitted (is ${set.status})`);
    const issues = validateResultSet(toInput(set), await loadValidationContext(tx, match));
    if (hasErrors(issues)) throw new ResultError("VALIDATION_FAILED", "result set has validation errors", issues);
    await tx.resultSet.update({ where: { id: set.id }, data: { status: "SUBMITTED" } });
    await audit(tx, { actorId: actor.id, action: "RESULT_SUBMITTED", entityType: "ResultSet", entityId: set.id });
    return { issues };
  }, TX_OPTS);
}

export async function rejectResultSet(prisma: PrismaClient, actor: Actor, resultSetId: string, reason: string): Promise<void> {
  if (reason.trim().length < 5) throw new ResultError("REASON_REQUIRED", "a rejection needs a reason");
  await prisma.$transaction(async (tx) => {
    const set = await tx.resultSet.findUnique({ where: { id: resultSetId } });
    if (!set) throw new ResultError("NOT_FOUND", "result set not found");
    const match = await loadMatch(tx, set.matchId);
    assertCan(actor, "results:approve", scopeOf(match.stage.tournamentId));
    if (set.status !== "SUBMITTED") throw new ResultError("BAD_STATE", `only SUBMITTED sets can be rejected (is ${set.status})`);
    await tx.resultSet.update({ where: { id: set.id }, data: { status: "REJECTED", note: reason } });
    await audit(tx, { actorId: actor.id, action: "RESULT_REJECTED", entityType: "ResultSet", entityId: set.id, reason });
  }, TX_OPTS);
}

/**
 * Approve a SUBMITTED set. In ONE transaction (serialized per tournament by an advisory lock):
 * supersede the previously approved set, snapshot points, rebuild standings for the stage/group
 * and player stats for the tournament from APPROVED sets only, and write the audit trail.
 * Returns domain events for the caller to publish (WebSocket, notifications) AFTER commit.
 */
export async function approveResultSet(
  prisma: PrismaClient, actor: Actor, resultSetId: string, opts: { allowSelfApproval?: boolean } = {},
): Promise<{ events: DomainEvent[]; supersededResultSetId: string | null }> {
  return prisma.$transaction(async (tx) => {
    const set = await tx.resultSet.findUnique({ where: { id: resultSetId }, include: { teamResults: true, playerResults: true } });
    if (!set) throw new ResultError("NOT_FOUND", "result set not found");
    const match = await loadMatch(tx, set.matchId);
    const tournament = match.stage.tournament;
    assertCan(actor, "results:approve", scopeOf(tournament.id));

    // Serialize approvals per tournament: lock the tournament row. Under READ COMMITTED (set below),
    // every read after this line sees everything committed by the approval we waited for.
    await tx.$queryRaw`SELECT id FROM \`Tournament\` WHERE id = ${tournament.id} FOR UPDATE`;
    const fresh = await tx.resultSet.findUniqueOrThrow({ where: { id: set.id }, select: { status: true } });
    if (fresh.status !== "SUBMITTED") throw new ResultError("BAD_STATE", `only SUBMITTED sets can be approved (is ${fresh.status})`);
    if (set.submittedById === actor.id && !opts.allowSelfApproval)
      throw new ResultError("SELF_APPROVAL", "a result must be approved by someone other than its submitter");

    const cfg = ScoringConfigSchema.parse(tournament.scoringConfig);
    const plan = planApproval({
      cfg,
      candidate: { matchId: match.id, matchNumber: match.matchNumber, stageId: match.stageId, groupId: match.groupId, input: toInput(set) },
      validation: await loadValidationContext(tx, match),
      approvedInTournament: await loadApprovedMatches(tx, tournament.id),
    });
    if (!plan.ok) throw new ResultError("VALIDATION_FAILED", "result set has validation errors", plan.issues);

    const previous = await tx.resultSet.findFirst({ where: { matchId: match.id, status: "APPROVED" } });
    if (previous) await tx.resultSet.update({ where: { id: previous.id }, data: { status: "SUPERSEDED" } });

    for (const t of plan.scoredTeams)
      await tx.teamMatchResult.updateMany({ where: { resultSetId: set.id, teamId: t.teamId }, data: { placementPoints: t.placementPoints, totalPoints: t.totalPoints } });
    await tx.resultSet.update({ where: { id: set.id }, data: { status: "APPROVED", approvedById: actor.id, approvedAt: new Date(), scoringSnapshot: json(cfg) } });
    await tx.match.update({ where: { id: match.id }, data: { status: "COMPLETED" } });

    await tx.standingEntry.deleteMany({ where: { stageId: match.stageId, groupId: match.groupId } });
    await tx.standingEntry.createMany({
      data: plan.standings.map((s) => ({ stageId: match.stageId, groupId: match.groupId, teamId: s.teamId, rank: s.rank, matchesPlayed: s.matchesPlayed, totalPoints: s.totalPoints, placementPoints: s.placementPoints, eliminations: s.eliminations, wins: s.wins, avgPlacement: s.avgPlacement, lastMatchPlacement: s.lastMatchPlacement })),
    });
    await tx.playerStatSummary.deleteMany({ where: { tournamentId: tournament.id } });
    await tx.playerStatSummary.createMany({
      data: plan.playerStats.map((p) => ({ tournamentId: tournament.id, playerId: p.playerId, matches: p.matches, eliminations: p.eliminations, assists: p.assists, matchesWithAssists: p.matchesWithAssists, damage: p.damage, matchesWithDamage: p.matchesWithDamage, survivalSeconds: p.survivalSeconds, matchesWithSurvival: p.matchesWithSurvival, avgPlacement: p.avgPlacement })),
    });

    await audit(tx, {
      actorId: actor.id, action: "RESULT_APPROVED", entityType: "ResultSet", entityId: set.id,
      before: previous ? { supersededResultSetId: previous.id, version: previous.version } : null,
      after: { matchId: match.id, version: set.version, teams: plan.scoredTeams },
      reason: set.note ?? undefined,
    });

    const base = { tournamentId: tournament.id, stageId: match.stageId, groupId: match.groupId, matchId: match.id };
    return { supersededResultSetId: previous?.id ?? null, events: [{ type: "result.approved", ...base }, { type: "standings.updated", ...base }] satisfies DomainEvent[] };
  }, TX_OPTS);
}
