import { describe, expect, it } from "vitest";
import { parseCsv, parseJsonImport, parsePlayersCsv, parseTeamsCsv, resolveImport } from "../src/engine";

describe("CSV parsing", () => {
  it("handles quotes, escaped quotes, CRLF and BOM", () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("parses teams and reports row-numbered errors", () => {
    const ok = parseTeamsCsv("team,placement,eliminations\nSKY,1,7\nBLZ,2,4\n");
    expect(ok.errors).toEqual([]);
    expect(ok.rows).toEqual([{ team: "SKY", placement: 1, eliminations: 7 }, { team: "BLZ", placement: 2, eliminations: 4 }]);
    const bad = parseTeamsCsv("team,placement,eliminations\nSKY,first,7\nBLZ,2,\n");
    expect(bad.errors.map((e) => e.row)).toEqual([2, 3]);
    expect(bad.rows).toEqual([]);
  });
  it("rejects unknown/missing columns", () => {
    expect(parseTeamsCsv("team,placement\nA,1").errors[0]!.message).toMatch(/eliminations/);
    expect(parseTeamsCsv("team,placement,eliminations,bonus\nA,1,1,1").errors[0]!.message).toMatch(/bonus/);
  });
  it("treats blank optional player stats as null, not 0", () => {
    const r = parsePlayersCsv("ign,team,eliminations,assists,damage,survival_seconds\nAce,SKY,3,,450,\n");
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toEqual({ ign: "Ace", team: "SKY", eliminations: 3, assists: null, damage: 450, survivalSeconds: null });
  });
});

describe("JSON import", () => {
  it("validates shape strictly", () => {
    expect(parseJsonImport("{").errors[0]!.message).toMatch(/invalid JSON/);
    expect(parseJsonImport('{"teams":[{"team":"A","placement":0,"eliminations":1}]}').errors.length).toBeGreaterThan(0);
    expect(parseJsonImport('{"teams":[],"surprise":1}').errors.length).toBeGreaterThan(0);
    expect(parseJsonImport('{"teams":[{"team":"A","placement":1,"eliminations":1}]}').raw!.players).toEqual([]);
  });
});

describe("resolveImport", () => {
  const lookup = {
    teams: [{ id: "t1", tag: "SKY", name: "Skyline" }, { id: "t2", tag: "BLZ", name: "Blaze" }],
    players: [{ id: "p1", ign: "Ace", teamId: "t1" }, { id: "p2", ign: "Ace", teamId: "t2" }],
  };
  it("maps tags, names and IGNs to ids", () => {
    const r = resolveImport({ teams: [{ team: "sky", placement: 1, eliminations: 2 }], players: [{ ign: "ace", team: "Skyline", eliminations: 2, assists: null, damage: null, survivalSeconds: null }] }, lookup);
    expect(r.errors).toEqual([]);
    expect(r.input).toEqual({ teams: [{ teamId: "t1", placement: 1, eliminations: 2 }], players: [{ playerId: "p1", teamId: "t1", eliminations: 2, assists: null, damage: null, survivalSeconds: null }] });
  });
  it("errors on unknown teams and players", () => {
    const r = resolveImport({ teams: [{ team: "NOPE", placement: 1, eliminations: 0 }], players: [{ ign: "Ghost", team: "SKY", eliminations: 0, assists: null, damage: null, survivalSeconds: null }] }, lookup);
    expect(r.input).toBeUndefined();
    expect(r.errors.map((e) => e.message)).toEqual(['unknown team "NOPE"', 'unknown player "Ghost" for team "SKY"']);
  });
});
