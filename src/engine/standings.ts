import type { ScoredTeamResult } from "./types";
import type { ScoringConfig, Tiebreaker } from "./scoring";

export interface StandingRow {
  teamId: string;
  rank: number;
  matchesPlayed: number;
  wins: number;
  totalPoints: number;
  placementPoints: number;
  eliminations: number;
  avgPlacement: number;
  bestPlacement: number;
  lastMatchPlacement: number | null;
}

interface Acc {
  teamId: string;
  matchesPlayed: number;
  wins: number;
  totalPoints: number;
  placementPoints: number;
  eliminations: number;
  placementSum: number;
  bestPlacement: number;
  lastMatchNumber: number;
  lastMatchPlacement: number | null;
}

/** Sort key: lower sorts first. */
function keyFor(row: StandingRow, tiebreakers: Tiebreaker[]): number[] {
  const parts: Record<Tiebreaker, number> = {
    WWCD: -row.wins,
    PLACEMENT_POINTS: -row.placementPoints,
    ELIMINATIONS: -row.eliminations,
    AVG_PLACEMENT: row.avgPlacement,
    BEST_PLACEMENT: row.bestPlacement,
    LAST_MATCH_PLACEMENT: row.lastMatchPlacement ?? Number.POSITIVE_INFINITY,
  };
  return [-row.totalPoints, ...tiebreakers.map((t) => parts[t])];
}
const cmpKeys = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]! ? -1 : 1;
  return 0;
};

/**
 * Pure function: standings from already-scored, APPROVED matches only.
 * Teams equal on every configured criterion share a rank (1,2,2,4); display order
 * inside a tie is by teamId so output is deterministic.
 */
export function computeStandings(
  matches: { matchNumber: number; teams: ScoredTeamResult[] }[],
  cfg: Pick<ScoringConfig, "tiebreakers">,
): StandingRow[] {
  const acc = new Map<string, Acc>();
  for (const m of [...matches].sort((a, b) => a.matchNumber - b.matchNumber)) {
    for (const t of m.teams) {
      const a =
        acc.get(t.teamId) ??
        ({ teamId: t.teamId, matchesPlayed: 0, wins: 0, totalPoints: 0, placementPoints: 0, eliminations: 0, placementSum: 0, bestPlacement: Infinity, lastMatchNumber: -Infinity, lastMatchPlacement: null } as Acc);
      a.matchesPlayed += 1;
      if (t.placement === 1) a.wins += 1;
      a.totalPoints += t.totalPoints;
      a.placementPoints += t.placementPoints;
      a.eliminations += t.eliminations;
      a.placementSum += t.placement;
      a.bestPlacement = Math.min(a.bestPlacement, t.placement);
      if (m.matchNumber >= a.lastMatchNumber) {
        a.lastMatchNumber = m.matchNumber;
        a.lastMatchPlacement = t.placement;
      }
      acc.set(t.teamId, a);
    }
  }
  const rows: StandingRow[] = [...acc.values()].map((a) => ({
    teamId: a.teamId,
    rank: 0,
    matchesPlayed: a.matchesPlayed,
    wins: a.wins,
    totalPoints: a.totalPoints,
    placementPoints: a.placementPoints,
    eliminations: a.eliminations,
    avgPlacement: a.placementSum / a.matchesPlayed,
    bestPlacement: a.bestPlacement,
    lastMatchPlacement: a.lastMatchPlacement,
  }));
  const keyed = rows
    .map((r) => ({ r, k: keyFor(r, cfg.tiebreakers) }))
    .sort((x, y) => cmpKeys(x.k, y.k) || x.r.teamId.localeCompare(y.r.teamId));
  keyed.forEach((e, i) => {
    e.r.rank = i > 0 && cmpKeys(keyed[i - 1]!.k, e.k) === 0 ? keyed[i - 1]!.r.rank : i + 1;
  });
  return keyed.map((e) => e.r);
}
