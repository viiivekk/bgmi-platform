import type { ResultSetInput, ValidationIssue } from "./types";

export interface ValidationContext {
  /** Teams assigned to this match's lobby. */
  lobbyTeamIds: string[];
  squadSize: number;
  /** Optional: teamId -> playerIds allowed to play for that team. */
  rosterByTeam?: Map<string, Set<string>>;
}

const isNonNegInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

export function validateResultSet(input: ResultSetInput, ctx: ValidationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ severity: "warning", code, message });

  const lobby = new Set(ctx.lobbyTeamIds);
  const seenTeams = new Set<string>();
  const seenPlacements = new Set<number>();

  for (const t of input.teams) {
    if (seenTeams.has(t.teamId)) err("DUPLICATE_TEAM", `team ${t.teamId} appears more than once`);
    seenTeams.add(t.teamId);
    if (!lobby.has(t.teamId)) err("TEAM_NOT_IN_LOBBY", `team ${t.teamId} is not assigned to this match`);
    if (!Number.isInteger(t.placement) || t.placement < 1) err("BAD_PLACEMENT", `team ${t.teamId}: placement must be an integer >= 1`);
    else if (seenPlacements.has(t.placement)) err("DUPLICATE_PLACEMENT", `placement ${t.placement} is used by more than one team`);
    seenPlacements.add(t.placement);
    if (!isNonNegInt(t.eliminations)) err("BAD_ELIMINATIONS", `team ${t.teamId}: eliminations must be an integer >= 0`);
  }
  for (const id of lobby) if (!seenTeams.has(id)) err("MISSING_TEAM", `lobby team ${id} has no result`);

  const n = input.teams.length;
  for (let p = 1; p <= n; p++) {
    if (!seenPlacements.has(p) && n > 0 && !issues.some((i) => i.code === "BAD_PLACEMENT"))
      err("PLACEMENT_GAP", `placements must be contiguous 1..${n}; ${p} is missing`);
  }

  const totalElims = input.teams.reduce((s, t) => s + (isNonNegInt(t.eliminations) ? t.eliminations : 0), 0);
  const maxElims = n * ctx.squadSize - 1;
  if (n > 0 && totalElims > maxElims)
    err("IMPOSSIBLE_ELIMINATIONS", `total eliminations ${totalElims} exceeds ${maxElims} (players in lobby minus one)`);

  // Player rows
  const elimsByTeam = new Map(input.teams.map((t) => [t.teamId, t.eliminations]));
  const seenPlayers = new Set<string>();
  const sumByTeam = new Map<string, number>();
  const countByTeam = new Map<string, number>();
  for (const p of input.players) {
    if (seenPlayers.has(p.playerId)) err("DUPLICATE_PLAYER", `player ${p.playerId} appears more than once`);
    seenPlayers.add(p.playerId);
    if (!seenTeams.has(p.teamId)) {
      err("PLAYER_TEAM_NOT_IN_RESULT", `player ${p.playerId} references team ${p.teamId} which has no result`);
      continue;
    }
    const allowed = ctx.rosterByTeam?.get(p.teamId);
    if (allowed && !allowed.has(p.playerId)) err("PLAYER_NOT_ON_ROSTER", `player ${p.playerId} is not on team ${p.teamId}'s roster`);
    for (const [k, v] of [["eliminations", p.eliminations], ["assists", p.assists], ["damage", p.damage], ["survivalSeconds", p.survivalSeconds]] as const) {
      if (v != null && !isNonNegInt(v)) err("BAD_PLAYER_STAT", `player ${p.playerId}: ${k} must be an integer >= 0`);
    }
    sumByTeam.set(p.teamId, (sumByTeam.get(p.teamId) ?? 0) + (isNonNegInt(p.eliminations) ? p.eliminations : 0));
    countByTeam.set(p.teamId, (countByTeam.get(p.teamId) ?? 0) + 1);
  }
  for (const [teamId, count] of countByTeam) {
    if (count > ctx.squadSize) err("TOO_MANY_PLAYERS", `team ${teamId} has ${count} player rows; squad size is ${ctx.squadSize}`);
    const teamElims = elimsByTeam.get(teamId) ?? 0;
    const sum = sumByTeam.get(teamId) ?? 0;
    if (sum > teamElims) err("PLAYER_ELIMS_EXCEED_TEAM", `team ${teamId}: player eliminations (${sum}) exceed team eliminations (${teamElims})`);
    else if (sum < teamElims) warn("UNATTRIBUTED_ELIMINATIONS", `team ${teamId}: ${teamElims - sum} eliminations are not attributed to a player`);
  }
  return issues;
}

export const hasErrors = (issues: ValidationIssue[]) => issues.some((i) => i.severity === "error");
