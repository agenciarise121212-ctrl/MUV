import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { spawnAround, type RoadEl } from "@/lib/spawn";
import { listMissions, wallet } from "@/lib/rpg";
import { listActivities } from "@/lib/queries";
import { level } from "@/lib/gamification";

export const maxDuration = 30;

// Mantém o mapa povoado: expira o que venceu e repõe desafios/bosses sobre vias públicas reais
async function _POST(req: Request) {
  const b = await req.json();
  const lat = Number(b.lat), lng = Number(b.lng), acc = Number(b.acc);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return NextResponse.json({ error: "Localização inválida." }, { status: 400 });
  if (isFinite(acc) && acc > 200) return NextResponse.json({ error: "Precisão do GPS insuficiente." }, { status: 400 });
  const roads: RoadEl[] = Array.isArray(b.roads) ? b.roads.slice(0, 600).filter((e: RoadEl) => e?.type === "way" && Array.isArray(e.geometry)) : [];
  const lv = level(await listActivities(), (await wallet()).xp).level;
  const result = await spawnAround({ lat, lng }, roads, lv);
  const w = await wallet();
  return NextResponse.json({ ...result, missions: await listMissions(), wallet: { xp: w.xp, coins: w.coins } });
}

export const POST = withJson(_POST);
