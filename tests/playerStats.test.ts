import { describe, expect, it } from "vitest";
import { aggregatePlayerStats } from "../src/engine";
import { st } from "./helpers";

describe("aggregatePlayerStats", () => {
  const m1 = { teams: [st("A", 1, 5, 15), st("B", 3, 2, 10)], players: [
    { playerId: "p1", teamId: "A", eliminations: 3, assists: 1, damage: 400, survivalSeconds: 900 },
    { playerId: "p2", teamId: "B", eliminations: 2 },
  ] };
  const m2 = { teams: [st("A", 2, 4, 12), st("B", 1, 1, 15)], players: [
    { playerId: "p1", teamId: "A", eliminations: 1, assists: null, damage: 200, survivalSeconds: null },
    { playerId: "p2", teamId: "B", eliminations: 1 },
  ] };
  const out = Object.fromEntries(aggregatePlayerStats([m1, m2]).map((p) => [p.playerId, p]));

  it("sums eliminations and averages team placement", () => {
    expect(out.p1).toMatchObject({ matches: 2, eliminations: 4, avgPlacement: 1.5 });
    expect(out.p2).toMatchObject({ matches: 2, eliminations: 3, avgPlacement: 2 });
  });
  it("tracks how many matches supplied each optional stat", () => {
    expect(out.p1).toMatchObject({ assists: 1, matchesWithAssists: 1, damage: 600, matchesWithDamage: 2, survivalSeconds: 900, matchesWithSurvival: 1 });
  });
  it("keeps unavailable stats null instead of inventing zeros", () => {
    expect(out.p2).toMatchObject({ assists: null, damage: null, survivalSeconds: null, matchesWithDamage: 0 });
  });
});
