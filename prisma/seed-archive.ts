import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/db";

const T = { key: "bgis-2026", name: "BGIS 2026", organiser: "Krafton India", dates: "8 Jan to 29 Mar 2026" };
const STAGES = [
  { file: "bgis-2026-semifinals.json", name: "Semifinals", order: 1 },
  { file: "bgis-2026-grand-finals.json", name: "Grand Finals", order: 2 },
];
type Src = { sources: string[]; ties_note?: string; standings: Record<string, any>[] };

async function main() {
  for (const s of STAGES) {
    const d: Src = JSON.parse(readFileSync(fileURLToPath(new URL(`../data/archive/${s.file}`, import.meta.url)), "utf8"));
    const data = d.standings.map((r) => ({
      tournamentKey: T.key, tournamentName: T.name, organiser: T.organiser, tournamentDates: T.dates,
      stageName: s.name, stageOrder: s.order, rank: r.rank, teamName: r.team,
      matchesPlayed: r.matches, wins: r.wins ?? null, positionPoints: r.position_points ?? null,
      finishPoints: r.finish_points ?? null, totalPoints: r.total_points, qualified: r.qualified ?? null,
      sourceUrls: d.sources, note: d.ties_note ?? null,
    }));
    await prisma.$transaction([
      prisma.archivedStanding.deleteMany({ where: { tournamentKey: T.key, stageName: s.name } }),
      prisma.archivedStanding.createMany({ data }),
    ]);
    console.log(`${s.name}: ${data.length} rows`);
  }
}
main().finally(() => prisma.$disconnect());
