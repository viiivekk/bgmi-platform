import { describe, expect, it } from "vitest";
import { computeStandings, EXAMPLE_SCORING_TEMPLATE as T } from "../src/engine";
import { am, st } from "./helpers";

describe("computeStandings", () => {
  it("aggregates points, wins and averages across matches", () => {
    const rows = computeStandings(
      [
        am("m1", 1, [st("A", 1, 5, 15), st("B", 2, 3, 12), st("C", 3, 8, 10)]),
        am("m2", 2, [st("A", 3, 2, 10), st("B", 1, 4, 15), st("C", 2, 1, 12)]),
      ],
      T,
    );
    expect(rows.map((r) => [r.teamId, r.rank, r.totalPoints])).toEqual([["B", 1, 34], ["A", 2, 32], ["C", 3, 31]]);
    const a = rows.find((r) => r.teamId === "A")!;
    expect(a).toMatchObject({ matchesPlayed: 2, wins: 1, placementPoints: 25, eliminations: 7, avgPlacement: 2, bestPlacement: 1, lastMatchPlacement: 3 });
  });

  it("breaks a points tie by wins first", () => {
    const rows = computeStandings([am("m1", 1, [st("X", 1, 0, 15), st("Y", 2, 3, 12)])], T);
    expect(rows.map((r) => [r.teamId, r.rank])).toEqual([["X", 1], ["Y", 2]]);
  });

  it("breaks a tie by placement points when wins are equal", () => {
    const rows = computeStandings([am("m1", 1, [st("Q", 1, 0, 15), st("Z", 3, 5, 10), st("W", 4, 7, 8)])], T);
    expect(rows.map((r) => r.teamId)).toEqual(["Q", "Z", "W"]); // Z and W both 15 pts, Z has more placement points
    expect(rows.find((r) => r.teamId === "Z")!.rank).toBe(2);
  });

  it("uses eliminations when elimination points are 0 and placement points tie", () => {
    const cfg = { ...T, eliminationPoints: 0 };
    const rows = computeStandings([am("m1", 1, [st("N", 9, 2, 0), st("M", 10, 6, 0)])].map((m) => ({ ...m, teams: m.teams.map((t) => ({ ...t, totalPoints: 0 })) })), cfg);
    expect(rows.map((r) => r.teamId)).toEqual(["M", "N"]);
  });

  const swapped = [
    am("m1", 1, [st("P", 1, 2, 15), st("Q", 2, 5, 12), st("R", 3, 0, 10)]),
    am("m2", 2, [st("P", 2, 5, 12), st("Q", 1, 2, 15), st("R", 3, 0, 10)]),
  ];
  it("falls through to last-match placement", () => {
    const rows = computeStandings(swapped, T);
    expect(rows.map((r) => [r.teamId, r.rank])).toEqual([["Q", 1], ["P", 2], ["R", 3]]);
  });
  it("gives shared ranks when every criterion is equal (1,1,3)", () => {
    const rows = computeStandings(swapped, { tiebreakers: [] });
    expect(rows.map((r) => [r.teamId, r.rank])).toEqual([["P", 1], ["Q", 1], ["R", 3]]);
  });
  it("is independent of match input order", () => {
    expect(computeStandings([...swapped].reverse(), T)).toEqual(computeStandings(swapped, T));
  });
  it("returns nothing when there are no approved matches", () => expect(computeStandings([], T)).toEqual([]));
});
