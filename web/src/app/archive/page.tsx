"use client";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { Notice } from "@/components/ui";

interface Row { rank: number; team: string; played: number; wins: number | null; positionPoints: number | null; finishPoints: number | null; totalPoints: number; qualified: string | null }
interface Stage { name: string; order: number; sources: string[]; note: string | null; standings: Row[] }
interface Tour { key: string; name: string; organiser: string | null; dates: string | null; stages: Stage[] }

const dash = (v: number | string | null) => (v === null ? "-" : v);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

function StageTable({ stage }: { stage: Stage }) {
  const has = (k: "wins" | "positionPoints" | "finishPoints") => stage.standings.some((r) => r[k] !== null);
  const hasQ = stage.standings.some((r) => r.qualified);
  const cols = ["Rank", "Team", "Played", ...(has("wins") ? ["Wins"] : []), ...(has("positionPoints") ? ["Position pts"] : []), ...(has("finishPoints") ? ["Finish pts"] : []), "Total", ...(hasQ ? ["Outcome"] : [])];
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="text-left text-mute"><tr>{cols.map((h, i) => <th key={h} className={`px-4 py-3 font-medium ${i > 1 && h !== "Outcome" ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
        <tbody>{stage.standings.map((r) => (
          <tr key={r.rank} className="border-t border-line">
            <td className="px-4 py-3">{r.rank}</td><td className="px-4 py-3 font-medium">{r.team}</td><td className="px-4 py-3 text-right">{r.played}</td>
            {has("wins") && <td className="px-4 py-3 text-right">{dash(r.wins)}</td>}
            {has("positionPoints") && <td className="px-4 py-3 text-right">{dash(r.positionPoints)}</td>}
            {has("finishPoints") && <td className="px-4 py-3 text-right">{dash(r.finishPoints)}</td>}
            <td className="px-4 py-3 text-right font-semibold text-blue">{r.totalPoints}</td>
            {hasQ && <td className="px-4 py-3 text-mute">{r.qualified ?? ""}</td>}
          </tr>))}</tbody>
      </table>
    </div>
  );
}

export default function Archive() {
  const { data, error, loading } = useApi<Tour[]>("/api/archive");
  const [pick, setPick] = useState<Record<string, string>>({});
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Archive</h1>
        <div className="mt-3"><Notice>Unofficial archive compiled from public sources. Not affiliated with or endorsed by Krafton. Figures that were not published are left blank, never estimated.</Notice></div>
      </header>
      {loading && <p className="text-mute">Loading…</p>}
      {error && <Notice tone="error">Could not load the archive: {error}.</Notice>}
      {data && !data.length && <Notice>No archived tournaments yet.</Notice>}
      {data?.map((t) => {
        const stage = t.stages.find((s) => s.name === pick[t.key]) ?? t.stages[t.stages.length - 1];
        return (
          <section key={t.key} className="space-y-4">
            <div><h2 className="text-xl font-semibold">{t.name}</h2><p className="text-sm text-mute">{[t.organiser, t.dates].filter(Boolean).join(", ")}</p></div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Stage">
              {t.stages.map((s) => <button key={s.name} aria-pressed={s.name === stage?.name} onClick={() => setPick({ ...pick, [t.key]: s.name })}
                className={`rounded-lg border px-3 py-1.5 text-sm ${s.name === stage?.name ? "border-blue text-white" : "border-line text-mute hover:text-white"}`}>{s.name}</button>)}
            </div>
            {stage && <>
              <StageTable stage={stage} />
              {stage.note && <p className="text-sm text-mute">{stage.note}</p>}
              <p className="text-sm text-mute">Sources: {stage.sources.map((u, i) => <span key={u}>{i > 0 && ", "}<a href={u} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline">{host(u)}</a></span>)}</p>
            </>}
          </section>);
      })}
    </div>
  );
}
