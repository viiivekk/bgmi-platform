export interface TeamResultInput {
  teamId: string;
  placement: number;
  eliminations: number;
}
export interface PlayerResultInput {
  playerId: string;
  teamId: string;
  eliminations: number;
  assists?: number | null;
  damage?: number | null;
  survivalSeconds?: number | null;
}
export interface ResultSetInput {
  teams: TeamResultInput[];
  players: PlayerResultInput[];
}
export interface ScoredTeamResult extends TeamResultInput {
  placementPoints: number;
  totalPoints: number;
}
/** An approved match as the standings/stat calculators see it. */
export interface ApprovedMatch {
  matchId: string;
  matchNumber: number;
  stageId: string;
  groupId: string | null;
  teams: ScoredTeamResult[];
  players: PlayerResultInput[];
}
export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}
