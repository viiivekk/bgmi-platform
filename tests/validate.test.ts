import { describe, expect, it } from "vitest";
import { hasErrors, validateResultSet, type ResultSetInput } from "../src/engine";

const ctx = { lobbyTeamIds: ["A", "B", "C", "D"], squadSize: 4 };
const good = (): ResultSetInput => ({
  teams: [{ teamId: "A", placement: 1, eliminations: 5 }, { teamId: "B", placement: 2, eliminations: 4 }, { teamId: "C", placement: 3, eliminations: 3 }, { teamId: "D", placement: 4, eliminations: 2 }],
  players: [],
});
const codes = (i: ResultSetInput, c = ctx) => validateResultSet(i, c).map((x) => x.code);

describe("validateResultSet", () => {
  it("accepts a clean result", () => expect(validateResultSet(good(), ctx)).toEqual([]));
  it("flags duplicate placements", () => {
    const r = good(); r.teams[1]!.placement = 1;
    expect(codes(r)).toContain("DUPLICATE_PLACEMENT");
  });
  it("flags placement gaps", () => {
    const r = good(); r.teams[3]!.placement = 6;
    expect(codes(r)).toContain("PLACEMENT_GAP");
  });
  it("flags missing, foreign and duplicate teams", () => {
    const r = good(); r.teams.pop();
    expect(codes(r)).toContain("MISSING_TEAM");
    const f = good(); f.teams[3]!.teamId = "Z";
    expect(codes(f)).toEqual(expect.arrayContaining(["TEAM_NOT_IN_LOBBY", "MISSING_TEAM"]));
    const d = good(); d.teams[3]!.teamId = "A";
    expect(codes(d)).toContain("DUPLICATE_TEAM");
  });
  it("caps total eliminations at players-in-lobby minus one", () => {
    const r = good(); // 4 teams x 4 = 16 players -> max 15
    r.teams[0]!.eliminations = 14; r.teams[1]!.eliminations = 1; r.teams[2]!.eliminations = 0; r.teams[3]!.eliminations = 0;
    expect(hasErrors(validateResultSet(r, ctx))).toBe(false);
    r.teams[1]!.eliminations = 2;
    expect(codes(r)).toContain("IMPOSSIBLE_ELIMINATIONS");
  });
  it("rejects negative and fractional eliminations", () => {
    const r = good(); r.teams[0]!.eliminations = -1;
    expect(codes(r)).toContain("BAD_ELIMINATIONS");
  });
  it("checks player rows against team totals", () => {
    const r = good();
    r.players = [{ playerId: "p1", teamId: "A", eliminations: 3 }, { playerId: "p2", teamId: "A", eliminations: 1 }];
    expect(validateResultSet(r, ctx).map((i) => [i.severity, i.code])).toEqual([["warning", "UNATTRIBUTED_ELIMINATIONS"]]);
    r.players[0]!.eliminations = 9;
    expect(codes(r)).toContain("PLAYER_ELIMS_EXCEED_TEAM");
  });
  it("enforces roster and squad size", () => {
    const r = good();
    r.players = [{ playerId: "p1", teamId: "A", eliminations: 1 }];
    const withRoster = { ...ctx, rosterByTeam: new Map([["A", new Set(["p9"])]]) };
    expect(codes(r, withRoster)).toContain("PLAYER_NOT_ON_ROSTER");
    r.players = ["p1", "p2", "p3", "p4", "p5"].map((id) => ({ playerId: id, teamId: "A", eliminations: 0 }));
    expect(codes(r)).toContain("TOO_MANY_PLAYERS");
    r.players = [{ playerId: "p1", teamId: "A", eliminations: 0 }, { playerId: "p1", teamId: "B", eliminations: 0 }];
    expect(codes(r)).toContain("DUPLICATE_PLAYER");
  });
});
