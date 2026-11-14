"use client";
import Link from "next/link";
import { useApi, type TournamentDetail, type TournamentSummary } from "@/lib/api";
import { Notice, StandingsTable, TournamentCard } from "@/components/ui";

export default function Home() {
  const list = useApi<TournamentSummary[]>("/api/tournaments");
  const featured = list.data?.find((t) => t.status === "LIVE") ?? list.data?.[0];
  const detail = useApi<TournamentDetail>(featured ? `/api/tournaments/${encodeURIComponent(featured.slug)}` : null);
  const top = detail.data?.stages.flatMap((s) => s.groups).find((g) => g.standings.length)?.standings.slice(0, 5);
  return (
    <div className="space-y-12">
      <section>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Follow every match, every point, every rank.</h1>
        <p className="mt-3 max-w-xl text-mute">Standings come only from approved results, so the table you see is the official one.</p>
        {list.loading && <p className="mt-8 text-mute">Loading tournaments…</p>}
        {list.error && <div className="mt-8"><Notice tone="error">Could not load tournaments: {list.error}. Check that the server is running and try again.</Notice></div>}
        {featured && (
          <div className="mt-8">
            <div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-semibold">{featured.name}</h2><Link href={`/tournament/?slug=${encodeURIComponent(featured.slug)}`} className="text-sm text-blue hover:underline">Full standings</Link></div>
            {top ? <StandingsTable rows={top} /> : detail.loading ? <p className="text-mute">Loading standings…</p> : <Notice>No approved results yet. Standings appear after the first match is approved.</Notice>}
          </div>
        )}
      </section>
      <section>
        <div className="mb-4 flex items-baseline justify-between"><h2 className="text-xl font-semibold">Tournaments</h2><Link href="/tournaments/" className="text-sm text-blue hover:underline">Browse all</Link></div>
        {list.data && !list.data.length && <Notice>No tournaments yet. Organisers will publish them here.</Notice>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.data?.slice(0, 6).map((t) => <TournamentCard key={t.slug} t={t} />)}</div>
      </section>
    </div>
  );
}
