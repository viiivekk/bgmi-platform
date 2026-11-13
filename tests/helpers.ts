import type { ApprovedMatch, ScoredTeamResult } from "../src/engine";
export const st = (teamId: string, placement: number, eliminations: number, placementPoints: number): ScoredTeamResult => ({
  teamId, placement, eliminations, placementPoints, totalPoints: placementPoints + eliminations,
});
export const am = (matchId: string, matchNumber: number, teams: ScoredTeamResult[], stageId = "S1", groupId: string | null = null): ApprovedMatch =>
  ({ matchId, matchNumber, stageId, groupId, teams, players: [] });
