import { requireApiUser } from "@/lib/auth";
import { captureQuest, generateDynamicQuests, loadQuestBoard, setQuestPaused, startQuest } from "@/lib/quests";

export const dynamic = "force-dynamic";

type Payload = {
  action?: "sync" | "capture" | "start" | "pause" | "generate";
  questId?: number;
  paused?: boolean;
  lat?: number;
  lng?: number;
  accuracyM?: number;
  speedKmh?: number;
};

function readPosition(body: Payload | null) {
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    lat,
    lng,
    // O navegador nunca informa velocidade junto da posição de forma confiável:
    // o cliente envia a velocidade calculada pela gravação real, quando houver.
    accuracyM: Number.isFinite(Number(body?.accuracyM)) ? Number(body?.accuracyM) : null,
    speedKmh: Number.isFinite(Number(body?.speedKmh)) ? Number(body?.speedKmh) : null,
  };
}

export async function GET(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const url = new URL(request.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const accuracy = Number(url.searchParams.get("accuracyM"));
  const speed = Number(url.searchParams.get("speedKmh"));
  const position =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng, accuracyM: Number.isFinite(accuracy) ? accuracy : null, speedKmh: Number.isFinite(speed) ? speed : null }
      : null;

  const board = await loadQuestBoard(user.id, position);
  return Response.json({ ok: true, ...board });
}

export async function POST(request: Request) {
  const user = await requireApiUser();
  if (!user) return Response.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body?.action) return Response.json({ ok: false, error: "Ação inválida" }, { status: 400 });
  const position = readPosition(body);

  if (body.action === "sync") {
    const board = await loadQuestBoard(user.id, position);
    return Response.json({ ok: true, ...board });
  }

  if (body.action === "generate") {
    const result = await generateDynamicQuests(user, {
      lat: position?.lat ?? -23.5505,
      lng: position?.lng ?? -46.6333,
      level: Math.max(1, levelOf(user.xp)),
      xp: user.xp,
      totalKm: 0,
      totalElev: 0,
      favoriteKind: "ride",
    });
    const board = await loadQuestBoard(user.id, position);
    return Response.json({ ok: true, ...result, ...board });
  }

  const questId = Number(body.questId);
  if (!Number.isInteger(questId)) return Response.json({ ok: false, error: "Missão inválida" }, { status: 400 });

  if (body.action === "start") {
    const started = await startQuest(user.id, questId);
    if (!started) return Response.json({ ok: false, error: "Não foi possível iniciar" }, { status: 400 });
    const board = await loadQuestBoard(user.id, position);
    return Response.json({ ok: true, ...board });
  }

  if (body.action === "pause") {
    const changed = await setQuestPaused(user.id, questId, Boolean(body.paused));
    if (!changed) return Response.json({ ok: false, error: "Missão não iniciada" }, { status: 400 });
    const board = await loadQuestBoard(user.id, position);
    return Response.json({ ok: true, ...board });
  }

  if (body.action === "capture") {
    if (!position) return Response.json({ ok: false, error: "Localização ausente ou inválida" }, { status: 400 });
    const result = await captureQuest(user, questId, position);
    if (!result.ok) return Response.json({ ok: false, error: result.reason, quest: result.quest }, { status: 422 });
    const board = await loadQuestBoard(user.id, position);
    return Response.json({ ok: true, captured: { xp: result.xp, coins: result.coins, level: result.level, quest: result.quest }, ...board });
  }

  return Response.json({ ok: false, error: "Ação desconhecida" }, { status: 400 });
}

function levelOf(xp: number): number {
  // Import local para não puxar o bundle do cliente para o servidor.
  const levels = [0, 600, 1800, 4000, 7500, 13000, 22000, 36000];
  let level = 1;
  levels.forEach((min, i) => {
    if (xp >= min) level = i + 1;
  });
  return level;
}
