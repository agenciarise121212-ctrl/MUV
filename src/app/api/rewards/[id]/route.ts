import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rewardRedemptions, rewards, users } from "@/db/schema";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const { id: rawId } = await ctx.params;
  const id = Number(rawId);
  const rows = await db.select().from(rewards).where(eq(rewards.id, id)).limit(1);
  const reward = rows[0];
  if (!reward) return Response.json({ ok: false, error: "Recompensa não encontrada" }, { status: 404 });
  if (user.coins < reward.cost) return Response.json({ ok: false, error: "Moedas insuficientes" }, { status: 400 });
  if (reward.stock <= 0) return Response.json({ ok: false, error: "Estoque esgotado" }, { status: 400 });

  const code = `MUV-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${reward.id}`;
  const [updated] = await db
    .update(users)
    .set({ coins: sql`${users.coins} - ${reward.cost}` })
    .where(eq(users.id, user.id))
    .returning({ coins: users.coins });
  await db.update(rewards).set({ stock: reward.stock - 1 }).where(eq(rewards.id, reward.id));
  const [redemption] = await db
    .insert(rewardRedemptions)
    .values({ rewardId: reward.id, userId: user.id, code })
    .returning({ id: rewardRedemptions.id, code: rewardRedemptions.code, createdAt: rewardRedemptions.createdAt });

  return Response.json({ ok: true, coins: updated.coins, redemption });
}
