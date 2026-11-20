import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, territoryClaims, territories, users, type TrackPoint } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";
import { distanceInsideCircle } from "@/lib/geo";

export const dynamic = "force-dynamic";

/** Reavalia os territórios usando as últimas atividades reais do atleta. */
export async function POST() {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });

  const allTerritories = await db.select().from(territories);
  const recent = await db
    .select({ id: activities.id, track: activities.track })
    .from(activities)
    .where(and(eq(activities.userId, user.id), eq(activities.status, "published")))
    .orderBy(desc(activities.startedAt))
    .limit(10);

  const claimed: { name: string; emoji: string }[] = [];
  let xpEarned = 0;
  let coinsEarned = 0;

  for (const t of allTerritories) {
    const owned = await db
      .select({ id: territoryClaims.id })
      .from(territoryClaims)
      .where(and(eq(territoryClaims.territoryId, t.id), eq(territoryClaims.userId, user.id)))
      .limit(1);
    if (owned.length > 0) continue;
    let best = 0;
    let bestActivity: number | null = null;
    for (const a of recent) {
      const inside = distanceInsideCircle((a.track ?? []) as TrackPoint[], t.centerLat, t.centerLng, t.radiusM);
      if (inside > best) {
        best = inside;
        bestActivity = a.id;
      }
    }
    if (best >= 250) {
      await db.insert(territoryClaims).values({
        territoryId: t.id,
        userId: user.id,
        activityId: bestActivity,
        distanceInsideM: Math.round(best),
      });
      xpEarned += t.xpReward;
      coinsEarned += t.coinsReward;
      claimed.push({ name: t.name, emoji: t.emoji });
    }
  }

  if (xpEarned || coinsEarned) {
    await db
      .update(users)
      .set({ xp: sql`${users.xp} + ${xpEarned}`, coins: sql`${users.coins} + ${coinsEarned}` })
      .where(eq(users.id, user.id));
  }

  return Response.json({ ok: true, claimed, xpEarned, coinsEarned });
}
