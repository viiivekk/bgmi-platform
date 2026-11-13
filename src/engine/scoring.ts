import { z } from "zod";

export const TIEBREAKERS = [
  "WWCD", // most wins (1st-place finishes), higher is better
  "PLACEMENT_POINTS", // total placement points, higher is better
  "ELIMINATIONS", // total eliminations, higher is better
  "AVG_PLACEMENT", // lower is better
  "BEST_PLACEMENT", // lower is better
  "LAST_MATCH_PLACEMENT", // lower is better
] as const;
export type Tiebreaker = (typeof TIEBREAKERS)[number];

/** Per-tournament, organizer-configurable scoring rules. Stored as JSON on Tournament. */
export const ScoringConfigSchema = z
  .object({
    /** index 0 = points for 1st place. Placements beyond the array score 0. */
    placementPoints: z.array(z.number().int().min(0)).min(1).max(100),
    eliminationPoints: z.number().int().min(0).default(1),
    /** Applied in order after total points. */
    tiebreakers: z
      .array(z.enum(TIEBREAKERS))
      .default(["WWCD", "PLACEMENT_POINTS", "ELIMINATIONS", "LAST_MATCH_PLACEMENT"]),
  })
  .refine((c) => new Set(c.tiebreakers).size === c.tiebreakers.length, {
    message: "tiebreakers must not repeat",
    path: ["tiebreakers"],
  })
  .refine((c) => c.placementPoints.every((p, i, a) => i === 0 || p <= a[i - 1]!), {
    message: "placementPoints must not increase with worse placement",
    path: ["placementPoints"],
  });
export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;

/** A starting template only. Organizers must confirm the values for their own event. */
export const EXAMPLE_SCORING_TEMPLATE: ScoringConfig = {
  placementPoints: [15, 12, 10, 8, 6, 4, 2, 1],
  eliminationPoints: 1,
  tiebreakers: ["WWCD", "PLACEMENT_POINTS", "ELIMINATIONS", "LAST_MATCH_PLACEMENT"],
};

export interface ScoredPoints {
  placementPoints: number;
  eliminationPoints: number;
  totalPoints: number;
}

export function scoreTeam(cfg: ScoringConfig, placement: number, eliminations: number): ScoredPoints {
  if (!Number.isInteger(placement) || placement < 1) throw new RangeError(`invalid placement ${placement}`);
  if (!Number.isInteger(eliminations) || eliminations < 0) throw new RangeError(`invalid eliminations ${eliminations}`);
  const placementPoints = cfg.placementPoints[placement - 1] ?? 0;
  const eliminationPoints = eliminations * cfg.eliminationPoints;
  return { placementPoints, eliminationPoints, totalPoints: placementPoints + eliminationPoints };
}
