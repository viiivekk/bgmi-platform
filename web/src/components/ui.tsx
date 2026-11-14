import Link from "next/link";
import type { ReactNode } from "react";
import type { Standing, TournamentSummary } from "@/lib/api";
import { label } from "@/lib/api";

export function Status({ value }: { value: string }) {
  const live = value === "LIVE";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${live ? "bg-violet/20 text-violet" : "bg-blue/15 text-blue"}`}>{label(value)}</span>;
}
export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" }) {
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border p-4 text-sm ${tone === "error" ? "border-red-500/40 text-red-300" : "border-line text-mute"}`}>{children}</div>;
}
export function TournamentCard({ t }: { t: TournamentSummary }) {
  return (
    <Link href={`/tournament/?slug=${encodeURIComponent(t.slug)}`} className="block rounded-xl border border-line bg-card p-5 transition-colors hover:border-blue">
      <Status value={t.status} />
      <h3 className="mt-3 text-lg font-semibold">{t.name}</h3>
      {t.description && <p className="mt-1 line-clamp-2 text-sm text-mute">{t.description}</p>}
      <p className="mt-4 text-sm text-mute">{t._count.registrations} of {t.maxTeams} teams, squads of {t.squadSize}</p>
    </Link>
  );
}
export function StandingsTable({ rows }: { rows: Standing[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="text-left text-mute"><tr>{["Rank", "Team", "Played", "Wins", "Eliminations", "Placement pts", "Avg place", "Total"].map((h, i) => <th key={h} className={`px-4 py-3 font-medium ${i > 1 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.team.tag} className="border-t border-line">
            <td className="px-4 py-3"><span className={`inline-block w-1 h-4 mr-3 align-middle rounded ${r.rank <= 3 ? "bg-gradient-to-b from-blue to-violet" : "bg-line"}`} />{r.rank}</td>
            <td className="px-4 py-3 font-medium">{r.team.name} <span className="text-xs text-mute">{r.team.tag}</span></td>
            <td className="px-4 py-3 text-right">{r.matchesPlayed}</td><td className="px-4 py-3 text-right">{r.wins}</td>
            <td className="px-4 py-3 text-right">{r.eliminations}</td><td className="px-4 py-3 text-right">{r.placementPoints}</td>
            <td className="px-4 py-3 text-right">{r.avgPlacement.toFixed(1)}</td><td className="px-4 py-3 text-right font-semibold text-blue">{r.totalPoints}</td>
          </tr>))}</tbody>
      </table>
    </div>
  );
}
