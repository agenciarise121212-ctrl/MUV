import { withJson } from "@/lib/api";
import { NextResponse } from "next/server";
import { generate, wallet, type OsmEl } from "@/lib/rpg";
import { listActivities } from "@/lib/queries";
import { level } from "@/lib/gamification";

// Recebe elementos reais do OpenStreetMap (consultados pelo dispositivo via Overpass) e cria objetivos
async function _POST(req: Request) {
  const b = await req.json();
  const lat = Number(b.lat), lng = Number(b.lng), acc = Number(b.acc);
  if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return NextResponse.json({ error: "Localização inválida." }, { status: 400 });
  if (isFinite(acc) && acc > 150) return NextResponse.json({ error: "Precisão do GPS insuficiente para gerar missões." }, { status: 400 });
  const els: OsmEl[] = Array.isArray(b.elements) ? b.elements.slice(0, 400).filter((e: OsmEl) => e && (e.type === "node" || e.type === "way") && typeof e.id === "number") : [];
  const lv = level(await listActivities(), (await wallet()).xp).level;
  return NextResponse.json(await generate({ lat, lng }, els, lv));
}

export const POST = withJson(_POST);
