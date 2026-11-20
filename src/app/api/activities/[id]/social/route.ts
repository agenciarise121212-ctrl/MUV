import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { activities, comments, kudos } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Interações sociais: kudos (toggle) e comentários. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  const body = (await request.json().catch(() => null)) as { type?: "kudos" | "comment"; body?: string } | null;
  if (!body?.type) return Response.json({ ok: false, error: "Ação inválida" }, { status: 400 });

  const rows = await db.select({ id: activities.id, userId: activities.userId }).from(activities).where(eq(activities.id, id)).limit(1);
  const activity = rows[0];
  if (!activity) return Response.json({ ok: false, error: "Atividade não encontrada" }, { status: 404 });

  if (body.type === "kudos") {
    const existing = await db
      .select({ id: kudos.id })
      .from(kudos)
      .where(and(eq(kudos.activityId, id), eq(kudos.userId, user.id)))
      .limit(1);
    if (existing.length > 0) {
      await db.delete(kudos).where(eq(kudos.id, existing[0].id));
    } else {
      await db.insert(kudos).values({ activityId: id, userId: user.id });
    }
    const all = await db.select({ userId: kudos.userId }).from(kudos).where(eq(kudos.activityId, id));
    return Response.json({ ok: true, active: existing.length === 0, count: all.length });
  }

  const text = (body.body ?? "").trim();
  if (!text) return Response.json({ ok: false, error: "Comentário vazio" }, { status: 400 });
  const [created] = await db
    .insert(comments)
    .values({ activityId: id, userId: user.id, body: text.slice(0, 500) })
    .returning({ id: comments.id, body: comments.body, createdAt: comments.createdAt });
  const total = await db.select({ id: comments.id }).from(comments).where(eq(comments.activityId, id));
  return Response.json({
    ok: true,
    comment: { id: created.id, body: created.body, createdAt: created.createdAt, userId: user.id, name: user.name, username: user.username, avatarColor: user.avatarColor },
    count: total.length,
  });
}
