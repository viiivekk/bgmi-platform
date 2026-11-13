import { describe, expect, it } from "vitest";
import { EXAMPLE_SCORING_TEMPLATE as cfg, planApproval, type ResultSetInput } from "../src/engine";
import { am, st } from "./helpers";

const validation = { lobbyTeamIds: ["A", "B", "C"], squadSize: 4 };
const input = (a: number, b: number, c: number, ea = 5, eb = 3, ec = 1): ResultSetInput => ({
  teams: [{ teamId: "A", placement: a, eliminations: ea }, { teamId: "B", placement: b, eliminations: eb }, { teamId: "C", placement: c, eliminations: ec }],
  players: [],
});
const base = { cfg, validation };

describe("planApproval", () => {
  it("scores the candidate and builds standings from it", () => {
    const p = planApproval({ ...base, candidate: { matchId: "m1", matchNumber: 1, stageId: "S1", groupId: null, input: input(1, 2, 3) }, approvedInTournament: [] });
    expect(p.ok).toBe(true);
    expect(p.scoredTeams.map((t) => [t.teamId, t.totalPoints])).toEqual([["A", 20], ["B", 15], ["C", 11]]);
    expect(p.standings.map((s) => [s.teamId, s.rank])).toEqual([["A", 1], ["B", 2], ["C", 3]]);
  });

  it("refuses to plan an invalid result and produces no standings", () => {
    const p = planApproval({ ...base, candidate: { matchId: "m1", matchNumber: 1, stageId: "S1", groupId: null, input: input(1, 1, 3) }, approvedInTournament: [] });
    expect(p.ok).toBe(false);
    expect(p.standings).toEqual([]);
    expect(p.issues.some((i) => i.code === "DUPLICATE_PLACEMENT")).toBe(true);
  });

  it("a correction replaces the old approved result of the same match", () => {
    const old = am("m1", 1, [st("A", 1, 5, 15), st("B", 2, 3, 12), st("C", 3, 1, 10)]);
    const p = planApproval({ ...base, candidate: { matchId: "m1", matchNumber: 1, stageId: "S1", groupId: null, input: input(2, 1, 3) }, approvedInTournament: [old] });
    expect(p.standings.map((s) => [s.teamId, s.totalPoints])).toEqual([["B", 18], ["A", 17], ["C", 11]]);
    expect(p.standings.every((s) => s.matchesPlayed === 1)).toBe(true); // old version not double counted
  });

  it("standings only use matches in the same stage/group; player stats span the tournament", () => {
    const otherGroup = { ...am("m9", 1, [st("A", 1, 9, 15)], "S1", "G2"), players: [{ playerId: "p1", teamId: "A", eliminations: 9 }] };
    const p = planApproval({
      ...base,
      candidate: { matchId: "m1", matchNumber: 1, stageId: "S1", groupId: "G1", input: { ...input(1, 2, 3), players: [{ playerId: "p1", teamId: "A", eliminations: 5 }] } },
      approvedInTournament: [otherGroup],
    });
    expect(p.standings.find((s) => s.teamId === "A")!.matchesPlayed).toBe(1);
    expect(p.playerStats.find((s) => s.playerId === "p1")).toMatchObject({ matches: 2, eliminations: 14 });
  });

  it("recomputes cumulative standings across several approved matches", () => {
    const m1 = am("m1", 1, [st("A", 1, 5, 15), st("B", 2, 3, 12), st("C", 3, 1, 10)]);
    const p = planApproval({ ...base, candidate: { matchId: "m2", matchNumber: 2, stageId: "S1", groupId: null, input: input(3, 1, 2) }, approvedInTournament: [m1] });
    expect(p.standings.map((s) => [s.teamId, s.totalPoints])).toEqual([["A", 35], ["B", 33], ["C", 24]]);
  });
});
