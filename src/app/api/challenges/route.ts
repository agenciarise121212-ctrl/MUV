import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { activities, challengeParticipants, challenges } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const METRICS = ["distance_m", "elev_gain_m", "moving_sec", "activities_count"] as const;

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as
    | {
        action?: "create" | "join" | "leave";
        id?: number;
        name?: string;
        description?: string;
        sport?: string | null;
        metric?: string;
        target?: number;
        unit?: string;
        emoji?: string;
        days?: number;
      }
    | null;
  if (!body?.action) return Response.json({ ok: false, error: "Ação inválida" }, { status: 400 });

  if (body.action === "create") {
    const name = (body.name ?? "").trim();
    const metric = METRICS.includes((body.metric ?? "") as (typeof METRICS)[number]) ? body.metric! : "distance_m";
    const target = Number(body.target);
    if (!name || !Number.isFinite(target) || target <= 0) {
      return Response.json({ ok: false, error: "Informe nome e meta válida" }, { status: 400 });
    }
    const days = Math.min(180, Math.max(1, Math.round(body.days ?? 30)));
    const endAt = new Date(Date.now() + days * 86400000);
    const [created] = await db
      .insert(challenges)
      .values({
        name: name.slice(0, 130),
        description: (body.description ?? "").slice(0, 380) || null,
        sport: body.sport || null,
        metric,
        target,
        unit: (body.unit ?? "km").slice(0, 18),
        emoji: (body.emoji ?? "🏆").slice(0, 6),
        endAt,
        creatorId: user.id,
        isPublic: true,
      })
      .returning({ id: challenges.id });
    await db.insert(challengeParticipants).values({ challengeId: created.id, userId: user.id, progress: 0 });
    return Response.json({ ok: true, id: created.id });
  }

  const id = Number(body.id);
  if (!Number.isInteger(id)) return Response.json({ ok: false, error: "Desafio inválido" }, { status: 400 });
  const rows = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
  const challenge = rows[0];
  if (!challenge) return Response.json({ ok: false, error: "Desafio não encontrado" }, { status: 404 });

  if (body.action === "leave") {
    await db
      .delete(challengeParticipants)
      .where(and(eq(challengeParticipants.challengeId, id), eq(challengeParticipants.userId, user.id)));
    return Response.json({ ok: true, joined: false, progress: 0 });
  }

  // join: importa automaticamente o progresso das atividades já registradas no período do desafio.
  const existing = await db
    .select({ id: challengeParticipants.id })
    .from(challengeParticipants)
    .where(and(eq(challengeParticipants.challengeId, id), eq(challengeParticipants.userId, user.id)))
    .limit(1);
  if (existing.length > 0) return Response.json({ ok: true, joined: true, alreadyJoined: true });

  const conditions = [
    eq(activities.userId, user.id),
    eq(activities.status, "published"),
    gte(activities.startedAt, new Date(challenge.startAt)),
    lte(activities.startedAt, new Date(challenge.endAt)),
  ];
  if (challenge.sport) conditions.push(eq(activities.sport, challenge.sport));
  const [agg] = await db
    .select({
      distance: sql<number>`coalesce(sum(${activities.distanceM}), 0)::float`,
      elev: sql<number>`coalesce(sum(${activities.elevGainM}), 0)::float`,
      moving: sql<number>`coalesce(sum(${activities.movingSec}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(activities)
    .where(and(...conditions));
  const progress =
    challenge.metric === "distance_m"
      ? agg.distance
      : challenge.metric === "elev_gain_m"
        ? agg.elev
        : challenge.metric === "moving_sec"
          ? agg.moving
          : agg.count;
  await db.insert(challengeParticipants).values({ challengeId: id, userId: user.id, progress });
  return Response.json({ ok: true, joined: true, progress });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").map(Number).filter(Number.isInteger);
  if (ids.length === 0) return Response.json({ ok: true, challenges: [] });
  const rows = await db.select().from(challenges).where(inArray(challenges.id, ids));
  return Response.json({ ok: true, challenges: rows });
}
