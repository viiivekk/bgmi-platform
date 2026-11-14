import type { FastifyInstance } from "fastify";
import { prisma } from "./db";

interface Stage { name: string; order: number; sources: unknown; note: string | null; standings: object[] }
interface Tour { key: string; name: string; organiser: string | null; dates: string | null; stages: Stage[] }

/** Read-only archive of published results (separate from the approval engine's tables). */
export async function archiveRoutes(app: FastifyInstance) {
  app.get("/api/archive", async () => {
    const rows = await prisma.archivedStanding.findMany({
      orderBy: [{ tournamentKey: "asc" }, { stageOrder: "asc" }, { rank: "asc" }],
    });
    const tours = new Map<string, Tour>();
    for (const r of rows) {
      let t = tours.get(r.tournamentKey);
      if (!t) { t = { key: r.tournamentKey, name: r.tournamentName, organiser: r.organiser, dates: r.tournamentDates, stages: [] }; tours.set(t.key, t); }
      let s = t.stages.find((x) => x.name === r.stageName);
      if (!s) { s = { name: r.stageName, order: r.stageOrder, sources: r.sourceUrls, note: r.note, standings: [] }; t.stages.push(s); }
      s.standings.push({ rank: r.rank, team: r.teamName, played: r.matchesPlayed, wins: r.wins, positionPoints: r.positionPoints, finishPoints: r.finishPoints, totalPoints: r.totalPoints, qualified: r.qualified });
    }
    return [...tours.values()];
  });
}
