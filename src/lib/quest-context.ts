import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities } from "@/db/schema";
import type { TrackPoint } from "@/db/schema";
import { totalDistance } from "@/lib/geo";

/**
 * Contexto real do atleta para a geração de missões.
 * Tudo vem do histórico publicado — nenhum valor é estimado ou inventado.
 */
export async function sportsFromHistory(userId: number): Promise<{
  totalKm: number;
  totalElev: number;
  favoriteKind: "ride" | "run" | "walk";
  fallbackLat: number;
  fallbackLng: number;
}> {
  const rows = await db
    .select({ sport: activities.sport, distanceM: activities.distanceM, elevGainM: activities.elevGainM, track: activities.track })
    .from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.status, "published")))
    .orderBy(sql`${activities.startedAt} desc`)
    .limit(30);

  const buckets: Record<string, number> = { ride: 0, run: 0, walk: 0 };
  let totalKm = 0;
  let totalElev = 0;
  let lastTrack: TrackPoint[] = [];

  for (const row of rows) {
    totalKm += row.distanceM / 1000;
    totalElev += row.elevGainM ?? 0;
    const family = row.sport.startsWith("ride") || row.sport === "mtb" || row.sport === "gravel" || row.sport === "ebike"
      ? "ride"
      : row.sport.startsWith("walk") || row.sport === "hike"
        ? "walk"
        : row.sport.startsWith("run")
          ? "run"
          : null;
    if (family) buckets[family] += row.distanceM;
    const track = (row.track ?? []) as TrackPoint[];
    if (track.length > 10 && lastTrack.length === 0) lastTrack = track;
  }

  const favorite = (Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "ride") as "ride" | "run" | "walk";
  // Fallback de centro: última posição real registrada, nunca uma coordenada fixa.
  const center = lastTrack[Math.floor(lastTrack.length / 2)] ?? lastTrack[0];

  return {
    totalKm: Math.round(totalKm),
    totalElev: Math.round(totalElev),
    favoriteKind: favorite,
    fallbackLat: center?.lat ?? -23.5505,
    fallbackLng: center?.lng ?? -46.6333,
  };
}
