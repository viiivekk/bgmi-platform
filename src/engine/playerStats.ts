import type { ApprovedMatch } from "./types";

export interface PlayerAggregate {
  playerId: string;
  matches: number;
  eliminations: number;
  /** null when no approved match supplied that stat; never defaulted to 0. */
  assists: number | null;
  matchesWithAssists: number;
  damage: number | null;
  matchesWithDamage: number;
  survivalSeconds: number | null;
  matchesWithSurvival: number;
  /** average of the player's team placement across matches played */
  avgPlacement: number;
}

export function aggregatePlayerStats(matches: Pick<ApprovedMatch, "teams" | "players">[]): PlayerAggregate[] {
  const out = new Map<string, PlayerAggregate & { placementSum: number }>();
  for (const m of matches) {
    const placementByTeam = new Map(m.teams.map((t) => [t.teamId, t.placement]));
    for (const p of m.players) {
      const placement = placementByTeam.get(p.teamId);
      if (placement === undefined) continue;
      const a =
        out.get(p.playerId) ??
        { playerId: p.playerId, matches: 0, eliminations: 0, assists: null, matchesWithAssists: 0, damage: null, matchesWithDamage: 0, survivalSeconds: null, matchesWithSurvival: 0, avgPlacement: 0, placementSum: 0 };
      a.matches += 1;
      a.eliminations += p.eliminations;
      a.placementSum += placement;
      if (p.assists != null) { a.assists = (a.assists ?? 0) + p.assists; a.matchesWithAssists += 1; }
      if (p.damage != null) { a.damage = (a.damage ?? 0) + p.damage; a.matchesWithDamage += 1; }
      if (p.survivalSeconds != null) { a.survivalSeconds = (a.survivalSeconds ?? 0) + p.survivalSeconds; a.matchesWithSurvival += 1; }
      out.set(p.playerId, a);
    }
  }
  return [...out.values()]
    .map(({ placementSum, ...a }) => ({ ...a, avgPlacement: placementSum / a.matches }))
    .sort((a, b) => b.eliminations - a.eliminations || a.playerId.localeCompare(b.playerId));
}
