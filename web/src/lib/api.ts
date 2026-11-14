"use client";
import { useEffect, useState } from "react";

export interface TeamRef { name: string; tag: string }
export interface Standing { rank: number; matchesPlayed: number; totalPoints: number; placementPoints: number; eliminations: number; wins: number; avgPlacement: number; team: TeamRef }
export interface MatchRow { matchNumber: number; mapName: string; scheduledAt: string; status: string; group: { name: string } }
export interface TournamentSummary { slug: string; name: string; description: string | null; status: string; squadSize: number; maxTeams: number; startsAt: string | null; endsAt: string | null; _count: { registrations: number } }
export interface TournamentDetail extends Omit<TournamentSummary, "_count"> {
  stages: { name: string; type: string; groups: { name: string; standings: Standing[] }[]; matches: MatchRow[] }[];
}

/** Same-origin in production (Nginx routes /api to the Node server). */
export async function api<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(r.status === 404 ? "Not found" : `Request failed (${r.status})`);
  return r.json() as Promise<T>;
}

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: !!path });
  useEffect(() => {
    if (!path) return;
    let live = true;
    setState({ data: null, error: null, loading: true });
    api<T>(path).then((data) => live && setState({ data, error: null, loading: false }))
      .catch((e: Error) => live && setState({ data: null, error: e.message, loading: false }));
    return () => { live = false; };
  }, [path]);
  return state;
}

export const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "To be announced");
export const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
