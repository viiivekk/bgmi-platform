import { describe, expect, it } from "vitest";
import { EXAMPLE_SCORING_TEMPLATE as T, ScoringConfigSchema, scoreTeam } from "../src/engine";

describe("scoreTeam", () => {
  it("adds placement and elimination points", () => {
    expect(scoreTeam(T, 1, 8)).toEqual({ placementPoints: 15, eliminationPoints: 8, totalPoints: 23 });
    expect(scoreTeam(T, 3, 0).totalPoints).toBe(10);
  });
  it("scores 0 placement points beyond the table", () => {
    expect(scoreTeam(T, 9, 4)).toEqual({ placementPoints: 0, eliminationPoints: 4, totalPoints: 4 });
  });
  it("honours a custom elimination multiplier", () => {
    expect(scoreTeam({ ...T, eliminationPoints: 2 }, 2, 5).totalPoints).toBe(22);
  });
  it("rejects invalid inputs", () => {
    expect(() => scoreTeam(T, 0, 1)).toThrow();
    expect(() => scoreTeam(T, 1, -1)).toThrow();
    expect(() => scoreTeam(T, 1.5, 1)).toThrow();
  });
});

describe("ScoringConfigSchema", () => {
  it("applies defaults", () => {
    const c = ScoringConfigSchema.parse({ placementPoints: [10, 5] });
    expect(c.eliminationPoints).toBe(1);
    expect(c.tiebreakers[0]).toBe("WWCD");
  });
  it("rejects placement points that increase with worse placement", () => {
    expect(ScoringConfigSchema.safeParse({ placementPoints: [5, 10] }).success).toBe(false);
  });
  it("rejects repeated tiebreakers and unknown ones", () => {
    expect(ScoringConfigSchema.safeParse({ placementPoints: [5], tiebreakers: ["WWCD", "WWCD"] }).success).toBe(false);
    expect(ScoringConfigSchema.safeParse({ placementPoints: [5], tiebreakers: ["COINFLIP"] }).success).toBe(false);
  });
});
