import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { activities, type TrackPoint } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getSport } from "@/lib/sports";
import { evaluateActivity } from "@/lib/rpg";
import { analyzeActivity } from "@/lib/anticheat";

async function _GET() {
  const rows = await db.select({ id: activities.id, sport: activities.sport, title: activities.title, distanceM: activities.distanceM, movingSec: activities.movingSec, avgSpeed: activities.avgSpeed, maxSpeed: activities.maxSpeed, elevGainM: activities.elevGainM, startedAt: activities.startedAt, calories: activities.calories }).from(activities).orderBy(desc(activities.startedAt));
  return NextResponse.json(rows);
}

async function _POST(req: Request) {
  const b = await req.json();
  const sport = getSport(String(b.sport));
  const points: TrackPoint[] = Array.isArray(b.points) ? b.points.slice(0, 50000) : [];
  const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
  const hour = new Date(b.startedAt ?? Date.now()).getHours();
  const period = hour < 12 ? "matinal" : hour < 18 ? "à tarde" : "noturna";
  // validação definitiva no servidor, a partir das coordenadas e timestamps recebidos
  const check = analyzeActivity({ points, group: sport.group, gps: sport.gps, distanceM: num(b.distanceM), movingSec: Math.round(num(b.movingSec)) });
  const [row] = await db.insert(activities).values({
    integrity: check.status,
    integrityReasons: check.reasons,
    sport: sport.key,
    title: String(b.title || `${sport.label} ${period}`).slice(0, 120),
    startedAt: new Date(b.startedAt ?? Date.now()),
    elapsedSec: Math.round(num(b.elapsedSec)),
    movingSec: Math.round(num(b.movingSec)),
    distanceM: num(b.distanceM),
    elevGainM: num(b.elevGainM),
    maxAltM: typeof b.maxAltM === "number" ? b.maxAltM : null,
    minAltM: typeof b.minAltM === "number" ? b.minAltM : null,
    avgSpeed: num(b.avgSpeed),
    maxSpeed: num(b.maxSpeed),
    calories: Math.round(num(b.calories)),
    points,
    status: "draft",
  }).returning({ id: activities.id });
  // integra com o RPG: valida percursos, bosses e objetivos de distância (idempotente)
  const missions = check.status === "valid" ? await evaluateActivity(row.id).catch(() => []) : [];
  return NextResponse.json({ ...row, missions, integrity: check.status, reasons: check.reasons });
}

export const GET = withJson(_GET);
export const POST = withJson(_POST);
