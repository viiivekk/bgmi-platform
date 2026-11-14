"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApi, fmtDate, label, type TournamentDetail } from "@/lib/api";
import { Notice, StandingsTable, Status } from "@/components/ui";

function Detail() {
  const slug = useSearchParams().get("slug");
  const { data: t, error, loading } = useApi<TournamentDetail>(slug ? `/api/tournaments/${encodeURIComponent(slug)}` : null);
  if (!slug) return <Notice>No tournament selected. <Link href="/tournaments/" className="text-blue underline">Browse tournaments</Link>.</Notice>;
  if (loading) return <p className="text-mute">Loading…</p>;
  if (error || !t) return <Notice tone="error">{error === "Not found" ? "This tournament does not exist or is not public yet." : `Could not load this tournament: ${error}.`}</Notice>;
  return (
    <div className="space-y-10">
      <header>
        <Link href="/tournaments/" className="text-sm text-mute hover:text-white">All tournaments</Link>
        <div className="mt-3 flex items-center gap-3"><h1 className="text-3xl font-bold">{t.name}</h1><Status value={t.status} /></div>
        {t.description && <p className="mt-2 max-w-2xl text-mute">{t.description}</p>}
        <p className="mt-2 text-sm text-mute">Starts {fmtDate(t.startsAt)}. Ends {fmtDate(t.endsAt)}.</p>
      </header>
      {t.stages.map((s) => (
        <section key={s.name} className="space-y-6">
          <h2 className="text-xl font-semibold">{s.name} <span className="text-sm font-normal text-mute">{label(s.type)}</span></h2>
          {s.groups.map((g) => (
            <div key={g.name}><h3 className="mb-2 text-sm font-medium text-mute">Standings for {g.name}</h3>
              {g.standings.length ? <StandingsTable rows={g.standings} /> : <Notice>No approved results yet.</Notice>}</div>))}
          {!!s.matches.length && (
            <div><h3 className="mb-2 text-sm font-medium text-mute">Matches</h3>
              <div className="overflow-x-auto rounded-xl border border-line bg-card"><table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-mute"><tr>{["Match", "Map", "Group", "When", "Status"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
                <tbody>{s.matches.map((m) => <tr key={`${m.group.name}-${m.matchNumber}`} className="border-t border-line"><td className="px-4 py-3">{m.matchNumber}</td><td className="px-4 py-3">{m.mapName}</td><td className="px-4 py-3">{m.group.name}</td><td className="px-4 py-3">{fmtDate(m.scheduledAt)}</td><td className="px-4 py-3"><Status value={m.status} /></td></tr>)}</tbody>
              </table></div></div>)}
        </section>))}
    </div>
  );
}
export default function TournamentPage() { return <Suspense fallback={<p className="text-mute">Loading…</p>}><Detail /></Suspense>; }
