import { z } from "zod";
import type { ResultSetInput } from "./types";

export interface RawTeamRow { team: string; placement: number; eliminations: number }
export interface RawPlayerRow { ign: string; team: string; eliminations: number; assists: number | null; damage: number | null; survivalSeconds: number | null }
export interface RawImport { teams: RawTeamRow[]; players: RawPlayerRow[] }
export interface ImportError { row?: number; message: string }

/** Minimal RFC 4180 parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (inQ) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

function table(text: string, required: string[], optional: string[]): { rows: Record<string, string>[]; errors: ImportError[] } {
  const grid = parseCsv(text);
  const errors: ImportError[] = [];
  if (grid.length === 0) return { rows: [], errors: [{ message: "file is empty" }] };
  const header = grid[0]!.map((h) => h.trim().toLowerCase());
  for (const r of required) if (!header.includes(r)) errors.push({ message: `missing required column "${r}"` });
  for (const h of header) if (!required.includes(h) && !optional.includes(h)) errors.push({ message: `unknown column "${h}"` });
  if (errors.length) return { rows: [], errors };
  const rows = grid.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? "").trim()])));
  return { rows, errors };
}

const intOf = (v: string, name: string, row: number, errors: ImportError[], optional = false): number | null => {
  if (v === "") { if (!optional) errors.push({ row, message: `${name} is required` }); return null; }
  if (!/^\d+$/.test(v)) { errors.push({ row, message: `${name} must be a non-negative integer, got "${v}"` }); return null; }
  return Number(v);
};

export function parseTeamsCsv(text: string): { rows: RawTeamRow[]; errors: ImportError[] } {
  const { rows, errors } = table(text, ["team", "placement", "eliminations"], []);
  const out: RawTeamRow[] = [];
  rows.forEach((r, i) => {
    const n = i + 2; // 1-based, after header
    const e0 = errors.length;
    if (!r.team) errors.push({ row: n, message: "team is required" });
    const placement = intOf(r.placement!, "placement", n, errors);
    const eliminations = intOf(r.eliminations!, "eliminations", n, errors);
    if (errors.length === e0) out.push({ team: r.team!, placement: placement!, eliminations: eliminations! });
  });
  return { rows: out, errors };
}

export function parsePlayersCsv(text: string): { rows: RawPlayerRow[]; errors: ImportError[] } {
  const { rows, errors } = table(text, ["ign", "team", "eliminations"], ["assists", "damage", "survival_seconds"]);
  const out: RawPlayerRow[] = [];
  rows.forEach((r, i) => {
    const n = i + 2;
    const e0 = errors.length;
    if (!r.ign) errors.push({ row: n, message: "ign is required" });
    if (!r.team) errors.push({ row: n, message: "team is required" });
    const eliminations = intOf(r.eliminations!, "eliminations", n, errors);
    const assists = intOf(r.assists ?? "", "assists", n, errors, true);
    const damage = intOf(r.damage ?? "", "damage", n, errors, true);
    const survivalSeconds = intOf(r.survival_seconds ?? "", "survival_seconds", n, errors, true);
    if (errors.length === e0) out.push({ ign: r.ign!, team: r.team!, eliminations: eliminations!, assists, damage, survivalSeconds });
  });
  return { rows: out, errors };
}

const nn = z.number().int().min(0);
const JsonImportSchema = z.object({
  teams: z.array(z.object({ team: z.string().min(1), placement: z.number().int().min(1), eliminations: nn }).strict()),
  players: z
    .array(z.object({ ign: z.string().min(1), team: z.string().min(1), eliminations: nn, assists: nn.nullish(), damage: nn.nullish(), survivalSeconds: nn.nullish() }).strict())
    .default([]),
}).strict();

export function parseJsonImport(text: string): { raw?: RawImport; errors: ImportError[] } {
  let data: unknown;
  try { data = JSON.parse(text); } catch (e) { return { errors: [{ message: `invalid JSON: ${(e as Error).message}` }] }; }
  const r = JsonImportSchema.safeParse(data);
  if (!r.success) return { errors: r.error.issues.map((i) => ({ message: `${i.path.join(".") || "(root)"}: ${i.message}` })) };
  return {
    errors: [],
    raw: {
      teams: r.data.teams,
      players: r.data.players.map((p) => ({ ign: p.ign, team: p.team, eliminations: p.eliminations, assists: p.assists ?? null, damage: p.damage ?? null, survivalSeconds: p.survivalSeconds ?? null })),
    },
  };
}

export interface ImportLookup {
  teams: { id: string; tag: string; name: string }[];
  players: { id: string; ign: string; teamId: string }[];
}

/** Resolve human-friendly keys (team tag/name/id, player IGN) to ids. Unknown or ambiguous keys are errors. */
export function resolveImport(raw: RawImport, lookup: ImportLookup): { input?: ResultSetInput; errors: ImportError[] } {
  const errors: ImportError[] = [];
  const teamId = (key: string, row?: number): string | undefined => {
    const k = key.toLowerCase();
    const hits = lookup.teams.filter((t) => t.id.toLowerCase() === k || t.tag.toLowerCase() === k || t.name.toLowerCase() === k);
    const ids = [...new Set(hits.map((h) => h.id))];
    if (ids.length === 1) return ids[0];
    errors.push({ row, message: ids.length === 0 ? `unknown team "${key}"` : `ambiguous team "${key}"` });
    return undefined;
  };
  const teams = raw.teams.map((t, i) => ({ id: teamId(t.team, i + 2), t }));
  const players = raw.players.map((p, i) => {
    const tid = teamId(p.team, i + 2);
    const hits = lookup.players.filter((x) => x.ign.toLowerCase() === p.ign.toLowerCase() && (!tid || x.teamId === tid));
    if (hits.length !== 1) errors.push({ row: i + 2, message: hits.length === 0 ? `unknown player "${p.ign}" for team "${p.team}"` : `ambiguous player "${p.ign}"` });
    return { tid, pid: hits[0]?.id, p };
  });
  if (errors.length) return { errors };
  return {
    errors,
    input: {
      teams: teams.map(({ id, t }) => ({ teamId: id!, placement: t.placement, eliminations: t.eliminations })),
      players: players.map(({ tid, pid, p }) => ({ playerId: pid!, teamId: tid!, eliminations: p.eliminations, assists: p.assists, damage: p.damage, survivalSeconds: p.survivalSeconds })),
    },
  };
}
