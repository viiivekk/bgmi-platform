import type { ApprovedMatch, ResultSetInput, ScoredTeamResult, ValidationIssue } from "./types";
import { scoreTeam, type ScoringConfig } from "./scoring";
import { hasErrors, validateResultSet, type ValidationContext } from "./validate";
import { computeStandings, type StandingRow } from "./standings";
import { aggregatePlayerStats, type PlayerAggregate } from "./playerStats";

export interface ApprovalPlanInput {
  cfg: ScoringConfig;
  candidate: { matchId: string; matchNumber: number; stageId: string; groupId: string | null; input: ResultSetInput };
  validation: ValidationContext;
  /**
   * Every currently-APPROVED match of the tournament. The candidate's own match
   * is ignored here, so passing the set it supersedes is safe.
   */
  approvedInTournament: ApprovedMatch[];
}

export interface ApprovalPlan {
  ok: boolean;
  issues: ValidationIssue[];
  scoredTeams: ScoredTeamResult[];
  /** standings for the candidate's (stage, group) scope */
  standings: StandingRow[];
  /** per-player aggregates for the whole tournament */
  playerStats: PlayerAggregate[];
}

/** Pure: computes everything the DB layer must write when a result set is approved. */
export function planApproval(p: ApprovalPlanInput): ApprovalPlan {
  const issues = validateResultSet(p.candidate.input, p.validation);
  if (hasErrors(issues)) return { ok: false, issues, scoredTeams: [], standings: [], playerStats: [] };

  const scoredTeams: ScoredTeamResult[] = p.candidate.input.teams.map((t) => {
    const s = scoreTeam(p.cfg, t.placement, t.eliminations);
    return { ...t, placementPoints: s.placementPoints, totalPoints: s.totalPoints };
  });
  const candidate: ApprovedMatch = {
    matchId: p.candidate.matchId,
    matchNumber: p.candidate.matchNumber,
    stageId: p.candidate.stageId,
    groupId: p.candidate.groupId,
    teams: scoredTeams,
    players: p.candidate.input.players,
  };
  const all = [...p.approvedInTournament.filter((m) => m.matchId !== candidate.matchId), candidate];
  const scope = all.filter((m) => m.stageId === candidate.stageId && m.groupId === candidate.groupId);
  return {
    ok: true,
    issues,
    scoredTeams,
    standings: computeStandings(scope, p.cfg),
    playerStats: aggregatePlayerStats(all),
  };
}
