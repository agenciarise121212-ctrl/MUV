import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { comments } from "@/db/schema";

async function _POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { author, body } = await req.json();
  if (typeof body !== "string" || !body.trim()) return NextResponse.json({ error: "vazio" }, { status: 400 });
  const [r] = await db.insert(comments).values({ activityId: Number((await ctx.params).id), author: String(author || "Atleta").slice(0, 60), body: body.slice(0, 1000) }).returning();
  return NextResponse.json(r);
}

export const POST = withJson(_POST);
