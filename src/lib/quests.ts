import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  quests,
  questProgress,
  segments,
  segmentEfforts,
  territories,
  users,
  type Activity,
  type Quest,
  type QuestWaypoint,
  type TrackPoint,
  type User,
} from "@/db/schema";
import { elevationStats, haversine, totalDistance } from "@/lib/geo";
import { activityPhotos } from "@/db/schema";
import { categoryAccent, categoryEmblem, type QuestCategory } from "@/lib/emblems";
import { levelFromXp } from "@/lib/levels";
import {
  RINGS,
  TIER_REWARD,
  anchorRoadPoints,
  fallbackRoadPoints,
  pickRoadPointInRing,
  ringForDistance,
  type RoadPoint,
  type RingTier,
} from "@/lib/roads";
import {
  DIFFICULTY_META,
  KIND_LABEL,
  QUEST_STAT_LABEL,
  MAX_INTERACTION_SPEED,
  MAX_TRUSTED_ACCURACY,
  accuracyOk,
  effectiveRadius,
  formatQuestDistance,
  gpsReadiness,
  isStationary,
  distanceToQuest,
  toQuestView,
  type QuestDifficulty,
  type QuestKind,
  type QuestView,
} from "@/lib/quest-ui";

export * from "@/lib/quest-ui";


/* --------------------------- Validação de percurso --------------------------- */

export type RouteValidation = {
  hits: number[];
  nextIndex: number;
  complete: boolean;
  /** true quando o destino foi alcançado mas o percurso completo não foi validado. */
  reachedDestinationOnly: boolean;
};

/**
 * Valida checkpoints de uma rota contra a trilha GPS real, em ordem.
 * Um checkpoint só é aceito se um ponto gravado cair dentro do raio dele
 * (raio ampliado pela precisão do GPS). Chegar ao destino não conclui a rota.
 */
export function validateRoute(
  track: TrackPoint[],
  waypoints: QuestWaypoint[],
  accuracyM: number | null | undefined,
  alreadyHit: number[] = [],
): RouteValidation {
  const acc = typeof accuracyM === "number" && accuracyM > 0 ? accuracyM : 15;
  const hit = new Set(alreadyHit);
  let cursor = 0;
  const ordered = [...waypoints].sort((a, b) => a.order - b.order);

  for (const point of track) {
    for (let i = cursor; i < ordered.length; i += 1) {
      const wp = ordered[i];
      if (hit.has(wp.order)) {
        cursor = Math.min(cursor + 1, ordered.length);
        continue;
      }
      const radius = Math.min(45 + acc * 0.8, 90);
      if (haversine(point.lat, point.lng, wp.lat, wp.lng) <= radius) {
        hit.add(wp.order);
        cursor = i + 1;
        break;
      }
    }
  }

  const allHit = ordered.length > 0 && ordered.every((wp) => hit.has(wp.order));
  const destination = ordered[ordered.length - 1];
  const reachedDestination =
    Boolean(destination) && track.some((p) => haversine(p.lat, p.lng, destination.lat, destination.lng) <= 60 + acc);

  return {
    hits: [...hit].sort((a, b) => a - b),
    nextIndex: ordered.findIndex((wp) => !hit.has(wp.order)),
    complete: allHit,
    reachedDestinationOnly: reachedDestination && !allHit,
  };
}

/* ------------------------------ Leitura de dados ------------------------------ */


const toView = toQuestView;

export type QuestEvent =
  | { type: "near"; questId: number; name: string; emblem: string; distanceM: number; accent: string }
  | { type: "unlock"; questId: number; name: string; emblem: string; accent: string }
  | { type: "captured"; questId: number; name: string; emblem: string; xp: number; coins: number; accent: string }
  | { type: "boss-damage"; questId: number; name: string; hp: number; maxHp: number; accent: string }
  | { type: "route-checkpoint"; questId: number; name: string; hit: number; total: number; accent: string };

/* --------------------- Sincronização de progresso (GPS + atividades) --------------------- */

type SyncParams = {
  position?: { lat: number; lng: number; accuracyM?: number | null; speedKmh?: number | null } | null;
  /** Atividade real recém-publicada, usada para creditar distância/subida. */
  activity?: Activity | null;
};

export async function loadQuestBoard(userId: number, position: SyncParams["position"] = null): Promise<{ quests: QuestView[]; events: QuestEvent[] }> {
  const rows = await db
    .select({ quest: quests, progress: questProgress })
    .from(quests)
    .leftJoin(questProgress, and(eq(questProgress.questId, quests.id), eq(questProgress.userId, userId)))
    .where(eq(quests.isActive, true));

  const events: QuestEvent[] = [];
  const views: QuestView[] = [];

  for (const row of rows) {
    const view = toView(row.quest, row.progress ?? undefined, position ?? null);
    views.push(view);

    if (position && view.state !== "completed" && view.distanceM !== null) {
      if (inRangeOfQuest(row.quest, position)) {
        events.push({
          type: "near",
          questId: row.quest.id,
          name: row.quest.name,
          emblem: view.emblem,
          distanceM: Math.round(view.distanceM ?? 0),
          accent: view.accent,
        });
        if (view.state === "available") {
          events.push({ type: "unlock", questId: row.quest.id, name: row.quest.name, emblem: view.emblem, accent: view.accent });
        }
      }
    }
  }

  return { quests: views, events };
}

function inRangeOfQuest(
  quest: Quest,
  position: { lat: number; lng: number; accuracyM?: number | null },
): boolean {
  if (typeof quest.lat !== "number" || typeof quest.lng !== "number") return false;
  return haversine(position.lat, position.lng, quest.lat, quest.lng) <= effectiveRadius(quest, position.accuracyM ?? null);
}

/** Aplica o progresso de uma atividade real publicada às missões compatíveis. */
export async function creditActivityToQuests(user: User, activity: Activity): Promise<QuestEvent[]> {
  const rows = await db
    .select({ quest: quests, progress: questProgress })
    .from(quests)
    .leftJoin(questProgress, and(eq(questProgress.questId, quests.id), eq(questProgress.userId, user.id)))
    .where(eq(quests.isActive, true));

  const track = (activity.track ?? []) as TrackPoint[];
  const activityDistance = Math.round(activity.distanceM);
  const activityGain = Math.round(activity.elevGainM);
  const events: QuestEvent[] = [];

  for (const row of rows) {
    const quest = row.quest;
    const state = row.progress?.state ?? "available";
    if (state === "completed") continue;

    const credited = row.progress?.creditedActivities ?? [];
    if (credited.includes(activity.id)) continue;
    if (quest.sport) {
      const cat = quest.sport;
      const activityCat = activity.sport;
      if (cat !== activityCat && !sameFamily(cat, activityCat)) continue;
    }

    const target = quest.targetValue;
    const updates: Partial<typeof questProgress.$inferInsert> = {
      creditedActivities: [...credited, activity.id],
      updatedAt: new Date(),
    };
    let progress = row.progress?.progress ?? 0;
    let hp = row.progress?.hp ?? (quest.bossMaxHp > 0 ? quest.bossMaxHp : null);
    let nextState = state === "available" ? "in_progress" : state;
    let damage = 0;

    if (quest.kind === "distance" && target > 0) {
      progress = Math.min(target, progress + activityDistance);
    } else if (quest.kind === "climb" && target > 0) {
      progress = Math.min(target, progress + activityGain);
    } else if (quest.kind === "endurance" && target > 0) {
      if (activityDistance < target) continue;
      progress = Math.max(progress, activityDistance);
    } else if (quest.kind === "route" && (quest.waypoints ?? []).length > 0) {
      const validation = validateRoute(track, quest.waypoints, 15, row.progress?.checkpointsHit ?? []);
      if (validation.hits.length === (row.progress?.checkpointsHit ?? []).length) continue;
      updates.checkpointsHit = validation.hits;
      progress = validation.hits.length;
      events.push({
        type: "route-checkpoint",
        questId: quest.id,
        name: quest.name,
        hit: validation.hits.length,
        total: quest.waypoints.length,
        accent: categoryAccent(quest.category as QuestCategory, quest.kind),
      });
    } else if (quest.kind === "boss" && quest.bossMaxHp > 0) {
      const qualifies =
        (quest.bossKind === "climb" && activityGain >= target && target > 0) ||
        (quest.bossKind === "endurance" && activityDistance >= target && target > 0) ||
        (quest.bossKind === "exploration" && track.length > 40) ||
        (quest.bossKind === "legendary" && activityDistance >= Math.max(target, 10000));
      if (!qualifies) continue;
      damage = 1;
      hp = Math.max(0, (row.progress?.hp ?? quest.bossMaxHp) - damage);
      progress = quest.bossMaxHp - hp;
      events.push({
        type: "boss-damage",
        questId: quest.id,
        name: quest.name,
        hp,
        maxHp: quest.bossMaxHp,
        accent: categoryAccent(quest.category as QuestCategory, quest.kind),
      });
    } else {
      continue;
    }

    const metricDone = target > 0 ? progress >= target : false;
    const routeDone = quest.kind === "route" ? (row.progress?.checkpointsHit ?? []).length === 0 ? false : undefined : undefined;
    void routeDone;

    if (quest.kind === "route") {
      const validation = validateRoute(track, quest.waypoints, 15, updates.checkpointsHit ?? row.progress?.checkpointsHit ?? []);
      if (validation.complete) nextState = "unlocked";
      else nextState = "in_progress";
    } else if (quest.kind === "boss") {
      nextState = hp === 0 ? "unlocked" : "in_progress";
    } else if (metricDone) {
      nextState = "unlocked";
    } else {
      nextState = "in_progress";
    }

    updates.progress = progress;
    updates.hp = hp;
    updates.state = nextState;
    updates.startedAt = row.progress?.startedAt ?? new Date();

    if (row.progress) {
      await db.update(questProgress).set(updates).where(eq(questProgress.id, row.progress.id));
    } else {
      await db.insert(questProgress).values({
        userId: user.id,
        questId: quest.id,
        progress,
        hp,
        state: nextState,
        creditedActivities: updates.creditedActivities ?? [],
        checkpointsHit: updates.checkpointsHit ?? [],
        startedAt: new Date(),
      });
    }
    void damage;
  }

  return events;
}

function sameFamily(a: string, b: string): boolean {
  const family = (s: string) =>
    s.startsWith("ride") || s === "mtb" || s === "gravel" || s === "ebike"
      ? "ride"
      : s.startsWith("walk") || s === "hike"
        ? "walk"
        : s.startsWith("run")
          ? "run"
          : s;
  return family(a) === family(b);
}

/* ------------------------------- Captura presencial ------------------------------- */

export type CaptureResult =
  | { ok: true; quest: QuestView; xp: number; coins: number; completed: boolean; events: QuestEvent[]; level: { level: number; title: string; pct: number } }
  | { ok: false; reason: string; quest?: QuestView };

export async function captureQuest(
  user: User,
  questId: number,
  position: { lat: number; lng: number; accuracyM?: number | null; speedKmh?: number | null },
  photo?: { dataUrl: string; mimeType: string; lat: number; lng: number } | null,
): Promise<CaptureResult> {
  const rows = await db.select().from(quests).where(eq(quests.id, questId)).limit(1);
  const quest = rows[0];
  if (!quest || !quest.isActive) return { ok: false, reason: "Missão indisponível." };

  const existing = await db
    .select()
    .from(questProgress)
    .where(and(eq(questProgress.questId, questId), eq(questProgress.userId, user.id)))
    .limit(1);
  const progress = existing[0];
  if (progress?.state === "completed") return { ok: false, reason: "Missão já concluída.", quest: toView(quest, progress, null) };

  // Presença física obrigatória: precisa ter coordenadas, GPS confiável e estar parado.
  if (typeof quest.lat !== "number" || typeof quest.lng !== "number") {
    return { ok: false, reason: "Esta missão é concluída por métrica registrada, não por captura no mapa." };
  }
  if (!accuracyOk(position.accuracyM ?? null)) {
    return { ok: false, reason: "Sinal de GPS impreciso. Procure céu aberto e aguarde a precisão melhorar." };
  }
  const dist = haversine(position.lat, position.lng, quest.lat, quest.lng);
  if (dist > effectiveRadius(quest, position.accuracyM ?? null)) {
    return { ok: false, reason: `Você está a ${Math.round(dist)} m. Chegue ao raio de ativação para capturar.`, quest: toView(quest, progress, null) };
  }
  if (!isStationary(position.speedKmh ?? null)) {
    return { ok: false, reason: "Interaja somente parado, com segurança.", quest: toView(quest, progress, null) };
  }

  // Missões de rota exigem percurso completo validado.
  if (quest.kind === "route" && (quest.waypoints ?? []).length > 0) {
    const hit = progress?.checkpointsHit ?? [];
    if (hit.length < quest.waypoints.length) {
      return {
        ok: false,
        reason: "Percurso incompleto: o trajeto registrado precisa passar por todos os checkpoints.",
        quest: toView(quest, progress, null),
      };
    }
  }

  // Check-in fotográfico: exige uma foto real tirada no local pelo app.
  if (quest.requiresPhoto && !photo?.dataUrl) {
    return {
      ok: false,
      reason: "Este desafio pede um registro fotográfico: tire uma foto real no local para concluí-lo.",
      quest: toView(quest, progress, null),
    };
  }

  // Boss precisa ter HP zerado por desafios reais.
  if (quest.kind === "boss" && quest.bossMaxHp > 0) {
    const hp = progress?.hp ?? quest.bossMaxHp;
    if (hp > 0) {
      return { ok: false, reason: `O boss ainda tem ${hp} de ${quest.bossMaxHp} HP. Complete os desafios dele.`, quest: toView(quest, progress, null) };
    }
  }

  // Missões de métrica exigem meta atingida por atividade real.
  if (["distance", "climb", "endurance"].includes(quest.kind) && quest.targetValue > 0) {
    const p = progress?.progress ?? 0;
    if (p < quest.targetValue) {
      return { ok: false, reason: "Meta ainda não atingida por atividade real registrada.", quest: toView(quest, progress, null) };
    }
  }

  const nextState = "completed";
  const payload = {
    state: nextState,
    progress: quest.kind === "route" ? quest.waypoints.length : quest.targetValue > 0 ? quest.targetValue : (progress?.progress ?? quest.targetValue),
    hp: quest.bossMaxHp > 0 ? 0 : progress?.hp ?? null,
    paused: false,
    activityId: progress?.activityId ?? null,
    capturedLat: position.lat,
    capturedLng: position.lng,
    accuracyM: position.accuracyM ?? null,
    completedAt: new Date(),
    updatedAt: new Date(),
    startedAt: progress?.startedAt ?? new Date(),
    checkpointsHit: progress?.checkpointsHit ?? [],
    creditedActivities: progress?.creditedActivities ?? [],
  };

  if (progress) {
    await db.update(questProgress).set(payload).where(eq(questProgress.id, progress.id));
  } else {
    await db.insert(questProgress).values({ userId: user.id, questId, ...payload });
  }

  // Foto do check-in: armazenada vinculada ao objetivo concluído.
  if (quest.requiresPhoto && photo?.dataUrl) {
    const decoded = decodePhotoDataUrl(photo.dataUrl);
    if (decoded) {
      await db.insert(activityPhotos).values({
        activityId: null,
        userId: user.id,
        data: decoded.buffer,
        mimeType: decoded.mime,
        caption: `Check-in · ${quest.name}`,
        position: 0,
        latitude: photo.lat ?? position.lat,
        longitude: photo.lng ?? position.lng,
        checkinQuestId: quest.id,
      });
    }
  }

  // Recompensa única: XP e moedas creditadas uma única vez (state passa a completed).
  const [updated] = await db
    .update(users)
    .set({ xp: sql`${users.xp} + ${quest.xpReward}`, coins: sql`${users.coins} + ${quest.coinsReward}` })
    .where(eq(users.id, user.id))
    .returning({ xp: users.xp, coins: users.coins });

  const lvl = levelFromXp(updated?.xp ?? user.xp);
  const accent = categoryAccent(quest.category as QuestCategory, quest.kind);
  return {
    ok: true,
    quest: toView(quest, { ...payload, state: nextState } as typeof progress & { state: string }, null),
    xp: quest.xpReward,
    coins: quest.coinsReward,
    completed: true,
    level: { level: lvl.level, title: lvl.title, pct: lvl.pct },
    events: [
      { type: "captured", questId: quest.id, name: quest.name, emblem: categoryEmblem(quest.category as QuestCategory, quest.kind), xp: quest.xpReward, coins: quest.coinsReward, accent },
    ],
  };
}

export async function setQuestPaused(userId: number, questId: number, paused: boolean): Promise<boolean> {
  const rows = await db
    .select({ id: questProgress.id, state: questProgress.state })
    .from(questProgress)
    .where(and(eq(questProgress.questId, questId), eq(questProgress.userId, userId)))
    .limit(1);
  if (rows.length === 0) return false;
  await db.update(questProgress).set({ paused, updatedAt: new Date() }).where(eq(questProgress.id, rows[0].id));
  return true;
}

export async function startQuest(userId: number, questId: number): Promise<boolean> {
  const existing = await db
    .select({ id: questProgress.id })
    .from(questProgress)
    .where(and(eq(questProgress.questId, questId), eq(questProgress.userId, userId)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(questProgress).set({ state: "in_progress", paused: false, startedAt: new Date(), updatedAt: new Date() }).where(eq(questProgress.id, existing[0].id));
    return true;
  }
  await db.insert(questProgress).values({ userId, questId, state: "in_progress", startedAt: new Date() });
  return true;
}

/* --------------------------- Missões dinâmicas e inteligentes --------------------------- */

const MAX_CHECKIN_BYTES = 3_500_000;

function decodePhotoDataUrl(dataUrl: string): { buffer: Buffer; mime: string } | null {
  const match = /^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_CHECKIN_BYTES) return null;
  return { buffer, mime: match[1] === "image/jpg" ? "image/jpeg" : match[1] };
}

type GenInput = {
  lat: number;
  lng: number;
  level: number;
  xp: number;
  totalKm: number;
  totalElev: number;
  favoriteKind: "ride" | "run" | "walk";
};

type GenResult = { created: number; guarded: number; source: string; degraded: boolean; specialSpawned: boolean };

/** Prefixo de chave das missões dinâmicas — usado para rotação. */
const DYN_PREFIX = "dyn-";
/** Número máximo de objetivos dinâmicos vivos por atleta. */
const MAX_DYNAMIC_ALIVE = 14;
/** Prazo padrão de rotação dos objetivos (horas). */
const ROTATION_HOURS = 24;
/** Prazo dos bosses especiais (horas). */
const SPECIAL_BOSS_HOURS = 6;

const EASY_BOSS_NAMES = [
  { name: "GUARDIÃO · Trilha Fácil", desc: "Um guardião novato patrulha esta via. Vence com um treino curto real e capture no local.", kind: "endurance" as const, hp: 1, target: 4000, emblem: "boss-golem" },
  { name: "SENTINELA · Estrada Vicinal", desc: "Sentinela de estrada vicinal. Complete uma atividade de 5 km para enfraquecê-lo e capture presencialmente.", kind: "endurance" as const, hp: 2, target: 5000, emblem: "boss-golem" },
  { name: "VIGIA · Rota Urbana", desc: "Vigia das ruas urbanas. Um pedal de 4 km tira seu HP e libera a captura.", kind: "endurance" as const, hp: 1, target: 4000, emblem: "boss-golem" },
  { name: "RASTREADOR · Ciclovia", desc: "Rastreador da ciclovia. Derrote com 3 km reais e capture no ponto marcado.", kind: "endurance" as const, hp: 2, target: 3000, emblem: "boss-golem" },
];

const SPECIAL_BOSS_NAMES = [
  { name: "TITÃ · Soberano da Serra", desc: "Boss especial invocado pelo seu desempenho. Exige ganho de elevação real e captura presencial no local.", kind: "climb" as const, hp: 3, target: 400, emblem: "boss-golem", bossKind: "climb" },
  { name: "COLOSSO · Rei da Resistência", desc: "Boss especial de resistência. Uma atividade longa real derruba seu HP por completo.", kind: "endurance" as const, hp: 4, target: 15000, emblem: "boss-golem", bossKind: "legendary" },
  { name: "FÊNIX · Guardiã do Portal", desc: "Boss especial de exploração, disponível por tempo limitado. Registre trajeto real e capture no local.", kind: "exploration" as const, hp: 2, target: 0, emblem: "portal-blue", bossKind: "exploration" },
  { name: "LEVIATÃ · Dominador de Distância", desc: "Boss especial lendário. Exige 20 km acumulados em atividades reais.", kind: "endurance" as const, hp: 5, target: 20000, emblem: "boss-golem", bossKind: "endurance" },
];

const COLLECTIBLE_NAMES = [
  { name: "Baú de recompensa", desc: "Baú ancorado em via pública real. Chegue ao raio de ativação e capture presencialmente.", kind: "collectible" as const, category: "chest" as const, emblem: "chest-gold" },
  { name: "Cristal secreto", desc: "Cristal raro escondido em um caminho público. Capture no local com o GPS do dispositivo.", kind: "secret" as const, category: "secret" as const, emblem: "crystal-purple" },
  { name: "Impulso de energia", desc: "Item de energia ancorado em via real. Capture presencialmente para somar ao inventário.", kind: "collectible" as const, category: "chest" as const, emblem: "potion-lightning" },
  { name: "Medalha de pedal", desc: "Medalha ancorada em via pública. Capture no local para registrar na coleção.", kind: "collectible" as const, category: "special" as const, emblem: "medal-bike" },
  { name: "Troféu de conquista", desc: "Troféu raro em caminho público. Recompensa elevada para longa distância.", kind: "collectible" as const, category: "special" as const, emblem: "trophy-gold" },
];

const ROUTE_NAMES = [
  { name: "Desafio de rota · Bandeirada", desc: "Ponto de chegada em via pública real. Chegue ao raio de ativação para validar.", emblem: "flag-checkered-flame", kind: "exploration" as const, category: "checkpoint" as const },
  { name: "Missão de trilha · Emblema MTB", desc: "Trecho de trilha cadastrado no OpenStreetMap. Registre presença no local.", emblem: "badge-mtb-trail", kind: "trail" as const, category: "mission" as const },
  { name: "Rota de montanha · Pino", desc: "Objetivo de subida ancorado em via real de montanha.", emblem: "mountain-route-pin", kind: "climb" as const, category: "mission" as const },
  { name: "Alvo de distância · Marco", desc: "Marco de distância em via pública. Alcance o ponto para concluir.", emblem: "target-red", kind: "exploration" as const, category: "mission" as const },
  { name: "Bandeira de trilha · Marco inicial", desc: "Marco inicial de trilha em caminho público cadastrado.", emblem: "flag-bike-mountain", kind: "exploration" as const, category: "mission" as const },
];

function expiresAt(hours: number): Date {
  return new Date(Date.now() + hours * 3600000);
}

/** Janela de rotação (24h em UTC): estável dentro da janela, muda entre janelas. */
function rotationStamp(): string {
  return new Date().toISOString().slice(0, 13).replace(/[-:T]/g, "");
}

function scaleReward(tier: RingTier, base: number): { xp: number; coins: number } {
  const meta = TIER_REWARD[tier];
  return {
    xp: Math.round(base * meta.multiplier),
    coins: Math.max(10, Math.round((base / 10) * meta.multiplier)),
  };
}

/**
 * Escolhe um template variando entre os usados. Quando todos já apareceram,
 * a lista é reciclada (começa nova rodada) em vez de devolver null — sem isso,
 * a geração parava de criar missões após esgotar os nomes do primeiro ciclo.
 */
function pickVariety<T>(list: T[], used: Set<string>, keyOf: (item: T) => string): T | null {
  if (list.length === 0) return null;
  const free = list.filter((item) => !used.has(keyOf(item)));
  if (free.length === 0) {
    // Nova rodada: limpa os usados desta lista e recomeça.
    list.forEach((item) => used.delete(keyOf(item)));
    const chosen = list[0];
    used.add(keyOf(chosen));
    return chosen;
  }
  const chosen = free[used.size % free.length];
  used.add(keyOf(chosen));
  return chosen;
}

/**
 * Desativa objetivos dinâmicos expirados ou concluídos há mais de um ciclo,
 * liberando espaço para a próxima rotação em locais diferentes.
 */
export async function rotateQuests(userId: number): Promise<{ deactivated: number }> {
  const now = new Date();
  const stale = new Date(now.getTime() - 48 * 3600000);

  // Expirados por tempo (bosses especiais e objetivos com prazo).
  const expired = await db
    .update(quests)
    .set({ isActive: false })
    .where(
      and(
        eq(quests.isActive, true),
        sql`${quests.origin} = 'dynamic'`,
        sql`${quests.expiresAt} is not null and ${quests.expiresAt} < ${now.toISOString()}::timestamptz`,
      ),
    )
    .returning({ id: quests.id });

  // Concluídos: saem do mapa para abrir espaço.
  const finished = await db
    .update(quests)
    .set({ isActive: false })
    .where(
      and(
        eq(quests.isActive, true),
        sql`${quests.origin} = 'dynamic'`,
        sql`exists (select 1 from quest_progress qp where qp.quest_id = ${quests.id} and qp.user_id = ${userId} and qp.state = 'completed')`,
      ),
    )
    .returning({ id: quests.id });

  // Antigos sem prazo: rotação por idade.
  const staleRows = await db
    .update(quests)
    .set({ isActive: false })
    .where(
      and(
        eq(quests.isActive, true),
        sql`${quests.origin} = 'dynamic'`,
        sql`${quests.expiresAt} is null`,
        sql`${quests.spawnedAt} is not null and ${quests.spawnedAt} < ${stale.toISOString()}::timestamptz`,
      ),
    )
    .returning({ id: quests.id });

  return { deactivated: expired.length + finished.length + staleRows.length };
}

/** Quantos desafios o atleta já concluiu (base para invocar bosses especiais). */
async function completedCount(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(questProgress)
    .where(and(eq(questProgress.userId, userId), sql`${questProgress.state} = 'completed'`));
  return row?.n ?? 0;
}

async function dynamicAlive(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quests)
    .where(and(eq(quests.isActive, true), sql`${quests.origin} = 'dynamic'`));
  return row?.n ?? 0;
}

/** Boss especial já invocado e ainda no prazo. */
async function activeSpecialBoss(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quests)
    .where(
      and(
        eq(quests.isActive, true),
        eq(quests.isSpecial, true),
        sql`${quests.expiresAt} is not null and ${quests.expiresAt} > now()`,
        sql`not exists (select 1 from quest_progress qp where qp.quest_id = ${quests.id} and qp.user_id = ${userId} and qp.state = 'completed')`,
      ),
    );
  return (row?.n ?? 0) > 0;
}

/**
 * Gera objetivos dinâmicos ancorados em vias públicas reais (OpenStreetMap).
 * Nunca usa coordenadas sorteadas: cada ponto vem de uma via do OSM ou,
 * no fallback, de âncoras públicas já cadastradas.
 */
export async function generateDynamicQuests(user: User, input: GenInput, limit = 6): Promise<GenResult> {
  await rotateQuests(user.id);

  // A deduplicação considera apenas objetivos ATIVOS: os desativados pela
  // rotação já saíram do mapa e podem renascer em outro local.
  const known = new Set(
    (
      await db
        .select({ key: quests.key })
        .from(quests)
        .where(and(eq(quests.isActive, true), sql`${quests.origin} = 'dynamic'`))
    ).map((r) => r.key),
  );
  // Janela de rotação: objetivos criados na mesma janela compartilham identidade
  // (regeneração é idempotente). Após a janela virar, a chave muda e o objetivo
  // nasce em outro lugar.
  const epoch = rotationStamp();
  const allTerritories = await db.select().from(territories);
  const allSegments = await db.select().from(segments);

  const anchors = [
    ...allTerritories.map((t) => ({ lat: t.centerLat, lng: t.centerLng, name: t.name, radiusM: t.radiusM })),
    ...allSegments.map((s) => ({ lat: s.startLat, lng: s.startLng, name: s.name, radiusM: 150 })),
  ];

  const anchor = await anchorRoadPoints(
    { lat: input.lat, lng: input.lng },
    { radiusM: 16000, timeoutMs: 6500, anchors },
  );
  const roads = anchor.points;
  if (roads.length === 0) return { created: 0, guarded: 0, source: anchor.source, degraded: anchor.degraded, specialSpawned: false };

  // Proteção de privacidade: base residencial inferida nunca recebe objetivo.
  const recent = await db
    .select({ track: activities.track })
    .from(activities)
    .where(and(eq(activities.userId, user.id), eq(activities.status, "published")))
    .orderBy(sql`${activities.startedAt} desc`)
    .limit(12);
  const starts: { lat: number; lng: number }[] = [];
  for (const a of recent) {
    const track = (a.track ?? []) as TrackPoint[];
    if (track.length > 10) starts.push({ lat: track[0].lat, lng: track[0].lng });
  }
  const homeBase = clusterCenter(starts);
  const isPrivate = (lat: number, lng: number) => (homeBase ? haversine(lat, lng, homeBase.lat, homeBase.lng) < 350 : false);

  const usedRoads = new Set<string>();
  const usedVariety = new Set<string>();
  const inserts: (typeof quests.$inferInsert)[] = [];
  let guarded = 0;
  const nowIso = new Date();

  const push = (row: (typeof quests.$inferInsert) & { key: string }) => {
    if (known.has(row.key)) return false;
    if (isPrivate(row.lat ?? 0, row.lng ?? 0)) {
      guarded += 1;
      return false;
    }
    known.add(row.key);
    inserts.push(row);
    return true;
  };

  const roadTag = (p: RoadPoint | null) => (p ? (p.name ?? `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`) : "sem-via");
  const roadSourceNote =
    anchor.source === "overpass"
      ? "Ponto ancorado em via pública do OpenStreetMap."
      : anchor.source === "fallback"
        ? "Ponto em área pública conhecida — percurso precisa ser verificado no local."
        : "Percurso precisa ser verificado no local.";

  /* -------- 1) Desafios por anel de distância, com recompensa escalonada -------- */
  for (const ring of RINGS) {
    const point = pickRoadPointInRing({ lat: input.lat, lng: input.lng }, roads, ring, usedRoads);
    if (!point) continue;
    const template = pickVariety(ROUTE_NAMES, usedVariety, (t) => t.name);
    if (!template) continue;
    const realDistance = haversine(input.lat, input.lng, point.lat, point.lng);
    const tier = ringForDistance(realDistance);
    const reward = scaleReward(tier, 140);
    const difficulty: QuestDifficulty = tier === "longo" ? "dificil" : tier === "medio" ? "media" : "facil";
    const slug = point.name ? point.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 26) : "via";
    push({
      key: `dyn-route-${epoch}-${slug}-${point.lat.toFixed(4)}`,
      name: `${template.name} · ${point.name ?? "Via pública"}`,
      description: `${template.desc} ${roadSourceNote}`,
      kind: template.kind,
      category: template.category,
      difficulty,
      emblemKey: template.emblem,
      sport: input.favoriteKind === "ride" ? "ride" : input.favoriteKind,
      lat: point.lat,
      lng: point.lng,
      radiusM: 45,
      targetValue: template.kind === "climb" ? Math.max(60, Math.round(input.totalElev * 0.08)) : 0,
      unit: template.kind === "climb" ? "m_elev" : "m",
      xpReward: reward.xp,
      coinsReward: reward.coins,
      origin: "dynamic",
      tier,
      roadName: point.name,
      roadType: point.highway,
      verified: anchor.source === "overpass" && point.safe,
      safetyNote: point.safe ? roadSourceNote : "Via de tráfego rápido: interaja somente parado e fora da pista.",
      spawnedAt: nowIso,
      expiresAt: expiresAt(ROTATION_HOURS),
    });
  }

  /* -------- 2) Colecionáveis escalonados por distância -------- */
  for (const ring of RINGS) {
    const point = pickRoadPointInRing({ lat: input.lat, lng: input.lng }, roads, ring, usedRoads);
    if (!point) continue;
    const template = pickVariety(COLLECTIBLE_NAMES, usedVariety, (t) => t.name);
    if (!template) continue;
    const realDistance = haversine(input.lat, input.lng, point.lat, point.lng);
    const tier = ringForDistance(realDistance);
    const reward = scaleReward(tier, 180);
    const difficulty: QuestDifficulty = tier === "longo" ? "lendaria" : tier === "medio" ? "dificil" : "media";
    const slug = point.name ? point.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 26) : "via";
    push({
      key: `dyn-collect-${epoch}-${slug}-${point.lat.toFixed(4)}`,
      name: `${template.name}${tier === "longo" ? " raro" : ""}`,
      description: `${template.desc} ${roadSourceNote}`,
      kind: template.kind,
      category: template.category,
      difficulty,
      emblemKey: template.emblem,
      sport: null,
      lat: point.lat,
      lng: point.lng,
      radiusM: 40,
      targetValue: 0,
      unit: "m",
      xpReward: reward.xp,
      coinsReward: reward.coins,
      origin: "dynamic",
      tier,
      roadName: point.name,
      roadType: point.highway,
      verified: anchor.source === "overpass" && point.safe,
      safetyNote: point.safe ? roadSourceNote : "Via de tráfego rápido: capture somente parado, fora da pista.",
      spawnedAt: nowIso,
      expiresAt: expiresAt(ROTATION_HOURS),
    });
  }

  /* -------- 2b) Check-ins fotográficos: registro da estrada / ponto de vista -------- */
  const photoTemplates = [
    { name: "Registro da Estrada", desc: "Chegue ao ponto marcado em via pública e registre uma foto real do caminho pelo app.", emblem: "compass" as const },
    { name: "Ponto de Vista", desc: "Alcance o mirante/caminho público e registre uma foto real da vista pelo app.", emblem: "mountain-route-pin" as const },
    { name: "Marco do Percurso", desc: "Chegue ao marco em via pública e registre uma foto real pelo app.", emblem: "chest-gold" as const },
  ];
  for (const ring of [RINGS[0], RINGS[1]]) {
    const point = pickRoadPointInRing({ lat: input.lat, lng: input.lng }, roads, ring, usedRoads);
    if (!point) continue;
    const template = pickVariety(photoTemplates, usedVariety, (t) => t.name);
    if (!template) continue;
    const realDistance = haversine(input.lat, input.lng, point.lat, point.lng);
    const tier = ringForDistance(realDistance);
    const reward = scaleReward(tier, 200);
    const slug = point.name ? point.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 26) : "via";
    push({
      key: `dyn-checkin-${epoch}-${slug}-${point.lat.toFixed(4)}`,
      name: `${template.name} · ${point.name ?? "Via pública"}`,
      description: `${template.desc} ${roadSourceNote}`,
      kind: "checkin",
      category: "explore",
      difficulty: tier === "longo" ? "dificil" : "media",
      emblemKey: template.emblem,
      sport: null,
      lat: point.lat,
      lng: point.lng,
      // Raio amplo: pensado para quem está em movimento e precisa apenas parar com segurança.
      radiusM: 80,
      targetValue: 0,
      unit: "m",
      xpReward: reward.xp,
      coinsReward: reward.coins,
      origin: "dynamic",
      tier,
      roadName: point.name,
      roadType: point.highway,
      requiresPhoto: true,
      verified: anchor.source === "overpass" && point.safe,
      safetyNote: point.safe
        ? "Pare em local seguro antes de fotografar. Nunca fotografe em movimento."
        : "Via de tráfego rápido: pare fora da pista antes de fotografar.",
      spawnedAt: nowIso,
      expiresAt: expiresAt(ROTATION_HOURS),
    });
  }

  /* -------- 3) Bosses comuns (fáceis) sempre presentes -------- */
  const aliveEasyBosses = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(quests)
    .where(
      and(
        eq(quests.isActive, true),
        eq(quests.kind, "boss"),
        eq(quests.isSpecial, false),
        sql`${quests.origin} = 'dynamic'`,
        sql`not exists (select 1 from quest_progress qp where qp.quest_id = ${quests.id} and qp.user_id = ${user.id} and qp.state = 'completed')`,
      ),
    );
  const needEasy = Math.max(0, 2 - (aliveEasyBosses[0]?.n ?? 0));
  for (let i = 0; i < needEasy; i += 1) {
    const ring = i === 0 ? RINGS[0] : RINGS[1];
    const point = pickRoadPointInRing({ lat: input.lat, lng: input.lng }, roads, ring, usedRoads);
    if (!point) continue;
    const template = pickVariety(EASY_BOSS_NAMES, usedVariety, (t) => t.name);
    if (!template) continue;
    const slug = point.name ? point.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 26) : "via";
    push({
      key: `dyn-boss-easy-${epoch}-${slug}-${point.lat.toFixed(4)}`,
      name: template.name,
      description: `${template.desc} ${roadSourceNote}`,
      kind: "boss",
      category: "boss",
      difficulty: "facil",
      emblemKey: template.emblem,
      sport: null,
      lat: point.lat,
      lng: point.lng,
      radiusM: 50,
      targetValue: template.target,
      unit: "m",
      xpReward: 220,
      coinsReward: 24,
      waypoints: [],
      bossKind: "endurance",
      bossMaxHp: template.hp,
      origin: "dynamic",
      tier: ring.tier,
      roadName: point.name,
      roadType: point.highway,
      verified: anchor.source === "overpass" && point.safe,
      safetyNote: point.safe ? roadSourceNote : "Via de tráfego rápido: capture somente parado, fora da pista.",
      spawnedAt: nowIso,
      expiresAt: expiresAt(ROTATION_HOURS * 2),
    });
  }

  /* -------- 4) Boss especial: invocado só após pré-requisitos -------- */
  // Escalonado: 1 desafio concluído invoca o primeiro boss especial; sequências
  // maiores (3 e 6) desbloqueiam invocações novas e mais fortes.
  let specialSpawned = false;
  const done = await completedCount(user.id);
  const hasSpecial = await activeSpecialBoss(user.id);
  const unlockThreshold = done >= 6 ? 6 : done >= 3 ? 3 : done >= 1 ? 1 : null;
  if (!hasSpecial && unlockThreshold !== null) {
    const template = pickVariety(SPECIAL_BOSS_NAMES, usedVariety, (t) => t.name);
    // Bosses especiais aparecem mais longe: exigem deslocamento real.
    const point =
      pickRoadPointInRing({ lat: input.lat, lng: input.lng }, roads, RINGS[2], usedRoads) ??
      pickRoadPointInRing({ lat: input.lat, lng: input.lng }, roads, RINGS[1], usedRoads);
    if (template && point) {
      const realDistance = haversine(input.lat, input.lng, point.lat, point.lng);
      const tier = ringForDistance(realDistance);
      const slug = point.name ? point.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 26) : "via";
      specialSpawned = push({
        key: `dyn-boss-special-${Date.now().toString(36)}-${slug}`,
        name: template.name,
        description: `${template.desc} Invocado após ${done} desafio${done === 1 ? "" : "s"} concluído${done === 1 ? "" : "s"}. Disponível por ${SPECIAL_BOSS_HOURS}h — depois rotaciona para outro local.`,
        kind: "boss",
        category: "boss",
        difficulty: "lendaria",
        emblemKey: template.emblem,
        sport: null,
        lat: point.lat,
        lng: point.lng,
        radiusM: 55,
        targetValue: template.target,
        unit: template.kind === "climb" ? "m_elev" : "m",
        // Bosses especiais pagam bem mais que os comuns e escalam com o anel.
        xpReward: unlockThreshold === 6 ? 1800 : unlockThreshold === 3 ? 1400 : 1100,
        coinsReward: unlockThreshold === 6 ? 210 : unlockThreshold === 3 ? 165 : 130,
        waypoints: [],
        bossKind: template.bossKind,
        bossMaxHp: unlockThreshold === 6 ? 6 : unlockThreshold === 3 ? 5 : template.hp,
        origin: "dynamic",
        tier,
        roadName: point.name,
        roadType: point.highway,
        isSpecial: true,
        prerequisite: unlockThreshold,
        verified: anchor.source === "overpass" && point.safe,
        safetyNote: point.safe
          ? `${roadSourceNote} Boss especial com prazo de ${SPECIAL_BOSS_HOURS}h.`
          : "Via de tráfego rápido: capture somente parado, fora da pista.",
        spawnedAt: nowIso,
        expiresAt: expiresAt(SPECIAL_BOSS_HOURS),
      }) as boolean;
    }
  }

  /* -------- 5) Rota de aventura com checkpoints em vias reais -------- */
  const longPoint =
    pickRoadPointInRing({ lat: input.lat, lng: input.lng }, roads, RINGS[1], usedRoads) ??
    pickRoadPointInRing({ lat: input.lat, lng: input.lng }, roads, RINGS[0], usedRoads);
  if (longPoint) {
    // Checkpoints: vértices de via reais entre o atleta e o destino.
    const corridor = roads
      .map((r) => ({ r, d: haversine(input.lat, input.lng, r.lat, r.lng) }))
      .filter((c) => c.d > 400 && c.d <= haversine(input.lat, input.lng, longPoint.lat, longPoint.lng) * 0.95)
      .sort((a, b) => a.d - b.d);
    const picked: RoadPoint[] = [];
    const step = Math.max(1, Math.floor(corridor.length / 3));
    for (let i = 0; i < corridor.length && picked.length < 3; i += step) picked.push(corridor[i].r);
    picked.push(longPoint);
    if (picked.length >= 2) {
      const slug = longPoint.name ? longPoint.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 26) : "via";
      const waypointList = picked.map((p, idx) => ({
        lat: p.lat,
        lng: p.lng,
        label: p.name ?? `Ponto ${idx + 1}`,
        order: idx,
      }));
      push({
        key: `dyn-route-adventure-${epoch}-${slug}-${longPoint.lat.toFixed(4)}`,
        name: `Rota de aventura · ${longPoint.name ?? "Via pública"}`,
        description: `Rota com ${waypointList.length} checkpoints em vias públicas reais. A missão só conclui se o trajeto registrado passar por todos — chegar perto do destino não basta.`,
        kind: "route",
        category: "mission",
        difficulty: "media",
        emblemKey: "mountain-route-pin",
        sport: input.favoriteKind,
        lat: longPoint.lat,
        lng: longPoint.lng,
        radiusM: 45,
        targetValue: 0,
        unit: "m",
        xpReward: 520,
        coinsReward: 55,
        waypoints: waypointList,
        origin: "dynamic",
        tier: "medio",
        roadName: longPoint.name,
        roadType: longPoint.highway,
        verified: anchor.source === "overpass",
        safetyNote: roadSourceNote,
        spawnedAt: nowIso,
        expiresAt: expiresAt(ROTATION_HOURS * 2),
      });
    }
  }

  /* -------- 6) Limite de objetivos vivos -------- */
  const alive = await dynamicAlive(user.id);
  const room = Math.max(0, MAX_DYNAMIC_ALIVE - alive);
  const toInsert = inserts.slice(0, Math.max(0, Math.min(limit * 2, room)));

  if (toInsert.length > 0) {
    await db.insert(quests).values(toInsert).onConflictDoNothing();
  }

  return {
    created: toInsert.length,
    guarded,
    source: anchor.source,
    degraded: anchor.degraded,
    specialSpawned: Boolean(specialSpawned),
  };
}

function clusterCenter(points: { lat: number; lng: number }[]): { lat: number; lng: number } | null {
  if (points.length < 2) return null;
  for (const anchor of points) {
    const near = points.filter((p) => haversine(anchor.lat, anchor.lng, p.lat, p.lng) < 150);
    if (near.length >= Math.max(2, Math.ceil(points.length / 2))) {
      return {
        lat: near.reduce((sum, p) => sum + p.lat, 0) / near.length,
        lng: near.reduce((sum, p) => sum + p.lng, 0) / near.length,
      };
    }
  }
  return null;
}

/* ------------------------------ Missão de trilha ------------------------------ */

/** Detecta se o atleta já completou o segmento associado à missão. */
export async function checkTrailQuest(userId: number, quest: Quest): Promise<boolean> {
  if (quest.kind !== "trail") return false;
  const all = await db.select().from(segments).where(eq(segments.city, quest.sport ?? ""));
  void all;
  const efforts = await db
    .select({ id: segmentEfforts.id })
    .from(segmentEfforts)
    .innerJoin(segments, eq(segments.id, segmentEfforts.segmentId))
    .where(eq(segmentEfforts.userId, userId))
    .limit(1);
  return efforts.length > 0;
}


/** Normaliza distância exibida, evitando poluição visual no painel mobile. */


export function sumDistance(track: TrackPoint[]): number {
  return Math.round(totalDistance(track));
}

export function trackGain(track: TrackPoint[]): number {
  return Math.round(elevationStats(track).gain);
}

/** Usado pela UI para saber se a precisão atual permite interação segura. */

export async function questsByIds(ids: number[]): Promise<Quest[]> {
  if (ids.length === 0) return [];
  return db.select().from(quests).where(inArray(quests.id, ids));
}
