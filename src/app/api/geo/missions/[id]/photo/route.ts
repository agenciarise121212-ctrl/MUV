import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { photoCheckin } from "@/lib/rpg";

async function _POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const b = await req.json();
  const r = await photoCheckin(Number((await ctx.params).id), { lat: Number(b.lat), lng: Number(b.lng), acc: Number(b.acc), speed: b.speed == null ? null : Number(b.speed), data: b.data });
  return NextResponse.json(r, { status: "error" in r ? 400 : 200 });
}

export const POST = withJson(_POST);
