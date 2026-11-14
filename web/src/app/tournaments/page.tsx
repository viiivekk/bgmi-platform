"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { useApi, label, type TournamentSummary } from "@/lib/api";
import { Notice, TournamentCard } from "@/components/ui";

const PAGE = 9;
export default function Tournaments() {
  const { data, error, loading } = useApi<TournamentSummary[]>("/api/tournaments");
  const [q, setQ] = useState(""); const [status, setStatus] = useState("ALL"); const [page, setPage] = useState(1);
  const statuses = ["ALL", ...Array.from(new Set(data?.map((t) => t.status) ?? []))];
  const rows = (data ?? []).filter((t) => (status === "ALL" || t.status === status) && t.name.toLowerCase().includes(q.toLowerCase()));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)); const cur = Math.min(page, pages);
  return (
    <div>
      <h1 className="text-3xl font-bold">Tournaments</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <label className="relative"><span className="sr-only">Search tournaments</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-mute" aria-hidden />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by name" className="w-64 rounded-lg border border-line bg-panel py-2 pl-9 pr-3 text-sm" /></label>
        <label><span className="sr-only">Filter by status</span>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm">
            {statuses.map((s) => <option key={s} value={s}>{s === "ALL" ? "All statuses" : label(s)}</option>)}</select></label>
      </div>
      <div className="mt-6">
        {loading && <p className="text-mute">Loading…</p>}
        {error && <Notice tone="error">Could not load tournaments: {error}.</Notice>}
        {data && !rows.length && <Notice>No tournaments match your search.</Notice>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.slice((cur - 1) * PAGE, cur * PAGE).map((t) => <TournamentCard key={t.slug} t={t} />)}</div>
        {pages > 1 && <div className="mt-6 flex items-center gap-3 text-sm">
          <button disabled={cur === 1} onClick={() => setPage(cur - 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">Previous</button>
          <span className="text-mute">Page {cur} of {pages}</span>
          <button disabled={cur === pages} onClick={() => setPage(cur + 1)} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40">Next</button></div>}
      </div>
    </div>
  );
}
