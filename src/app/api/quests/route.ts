import { requireApiUser } from "@/lib/auth";
import { captureQuest, generateDynamicQuests, loadQuestBoard, rotateQuests, setQuestPaused, startQuest } from "@/lib/quests";
import { sportsFromHistory } from "@/lib/quest-context";

export const dynamic = "force-dynamic";

type Payload = {
  action?: "sync" | "capture" | "start" | "pause" | "generate";
  questId?: number;
  paused?: boolean;
  lat?: number;
  lng?: number;
  accuracyM?: number;
  speedKmh?: number;
  /** Foto real do check-in fotográfico (data URL comprimido no cliente). */
  photo?: { dataUrl?: string; mimeType?: string };
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
  const seed = url.searchParams.get("seed") === "1";
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const accuracy = Number(url.searchParams.get("accuracyM"));
  const speed = Number(url.searchParams.get("speedKmh"));
  const position =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng, accuracyM: Number.isFinite(accuracy) ? accuracy : null, speedKmh: Number.isFinite(speed) ? speed : null }
      : null;

  let board = await loadQuestBoard(user.id, position);

  // Primeira abertura (ou mapa vazio após rotação): popula objetivos ao redor
  // do atleta ancorados em vias públicas reais.
  if (seed || board.quests.length === 0) {
    const ctx = await sportsFromHistory(user.id);
    await generateDynamicQuests(
      user,
      {
        lat: position?.lat ?? ctx.fallbackLat,
        lng: position?.lng ?? ctx.fallbackLng,
        level: Math.max(1, levelOf(user.xp)),
        xp: user.xp,
        totalKm: ctx.totalKm,
        totalElev: ctx.totalElev,
        favoriteKind: ctx.favoriteKind,
      },
      8,
    );
    board = await loadQuestBoard(user.id, position);
  }

  return Response.json({ ok: true, ...board, source: board.quests.length > 0 ? "ok" : "empty" });
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
    const ctx = await sportsFromHistory(user.id);
    const result = await generateDynamicQuests(
      user,
      {
        lat: position?.lat ?? ctx.fallbackLat,
        lng: position?.lng ?? ctx.fallbackLng,
        level: Math.max(1, levelOf(user.xp)),
        xp: user.xp,
        totalKm: ctx.totalKm,
        totalElev: ctx.totalElev,
        favoriteKind: ctx.favoriteKind,
      },
      8,
    );
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
    // Check-in fotográfico: a foto precisa existir e ter coordenada coerente.
    const photo =
      body.photo?.dataUrl && typeof body.photo.dataUrl === "string"
        ? {
            dataUrl: body.photo.dataUrl,
            mimeType: body.photo.mimeType ?? "image/webp",
            lat: position.lat,
            lng: position.lng,
          }
        : null;
    const result = await captureQuest(user, questId, position, photo);
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
