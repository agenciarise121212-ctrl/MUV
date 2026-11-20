import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { listMissions, wallet } from "@/lib/rpg";
async function _GET() { return NextResponse.json({ missions: await listMissions(), wallet: await wallet() }); }

export const GET = withJson(_GET);
