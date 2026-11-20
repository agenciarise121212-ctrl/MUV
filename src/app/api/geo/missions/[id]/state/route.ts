import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { setState } from "@/lib/rpg";
async function _POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { action } = await req.json();
  if (!["start", "pause", "resume"].includes(action)) return NextResponse.json({ error: "ação inválida" }, { status: 400 });
  const r = await setState(Number((await ctx.params).id), action);
  return NextResponse.json(r, { status: "error" in r ? 400 : 200 });
}

export const POST = withJson(_POST);
