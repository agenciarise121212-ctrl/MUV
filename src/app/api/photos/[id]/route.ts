import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityPhotos } from "@/db/schema";
import { eq } from "drizzle-orm";

async function _GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const [p] = await db.select({ data: activityPhotos.data }).from(activityPhotos).where(eq(activityPhotos.id, Number((await ctx.params).id)));
  if (!p) return new NextResponse("Not found", { status: 404 });
  const m = p.data.match(/^data:(image\/[a-z+]+);base64,(.*)$/);
  if (!m) return new NextResponse("Bad", { status: 500 });
  return new NextResponse(Buffer.from(m[2], "base64"), { headers: { "Content-Type": m[1], "Cache-Control": "public, max-age=31536000, immutable" } });
}

async function _DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  await db.delete(activityPhotos).where(eq(activityPhotos.id, Number((await ctx.params).id)));
  return NextResponse.json({ ok: true });
}

export const GET = withJson(_GET);
export const DELETE = withJson(_DELETE);
