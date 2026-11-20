import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activities } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

async function _POST(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const [r] = await db.update(activities).set({ kudos: sql`${activities.kudos} + 1` }).where(eq(activities.id, Number((await ctx.params).id))).returning({ kudos: activities.kudos });
  return NextResponse.json(r ?? { kudos: 0 });
}

export const POST = withJson(_POST);
