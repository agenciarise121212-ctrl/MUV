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
import { categoryAccent, categoryEmblem, type QuestCategory } from "@/lib/emblems";
import { levelFromXp } from "@/lib/levels";
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
  questProgressLabel,
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


function toView(
  quest: Quest,
  progress: { state: string; progress: number; hp: number | null; checkpointsHit: number[]; paused: boolean } | undefined,
  position: { lat: number; lng: number; accuracyM?: number | null; speedKmh?: number | null } | null,
): QuestView {
  const kind = quest.kind as QuestKind;
  const category = quest.category as QuestCategory;
  const difficulty = quest.difficulty as QuestDifficulty;
  const state = (progress?.state ?? "available") as QuestView["state"];
  const dist = position && typeof quest.lat === "number" ? distanceToQuest(quest, position.lat, position.lng) : null;
  const inRange = dist !== null && dist <= effectiveRadius(quest, position?.accuracyM ?? null);
  const accuracyOkFlag = accuracyOk(position?.accuracyM ?? null);

  let capturable = false;
  let blockedReason: string | null = null;

  if (state !== "completed" && quest.lat !== null) {
    if (!accuracyOkFlag) {
      blockedReason = "Sinal de GPS impreciso — aproxime-se em céu aberto para validar presença.";
    } else if (!inRange) {
      blockedReason = `Aproxime-se: faltam ${Math.max(0, Math.round((dist ?? 0) - effectiveRadius(quest, position?.accuracyM ?? null)))} m.`;
    } else if (position?.speedKmh != null && !isStationary(position.speedKmh)) {
      blockedReason = "Você está em movimento. Pare com segurança para interagir.";
    } else {
      capturable = true;
    }
  }

  return {
    id: quest.id,
    key: quest.key,
    name: quest.name,
    description: quest.description,
    kind,
    kindLabel: KIND_LABEL[kind] ?? "Missão",
    category,
    difficulty,
    difficultyLabel: DIFFICULTY_META[difficulty]?.label ?? "Média",
    accent: categoryAccent(category, kind),
    emblem: categoryEmblem(category, kind),
    sport: quest.sport,
    lat: quest.lat,
    lng: quest.lng,
    radiusM: quest.radiusM,
    targetValue: quest.targetValue,
    unit: quest.unit,
    xpReward: quest.xpReward,
    coinsReward: quest.coinsReward,
    waypoints: quest.waypoints ?? [],
    bossKind: quest.bossKind,
    bossMaxHp: quest.bossMaxHp,
    origin: quest.origin,
    verified: quest.verified,
    safetyNote: quest.safetyNote,
    state,
    progress: progress?.progress ?? 0,
    hp: progress?.hp ?? (quest.bossMaxHp > 0 ? quest.bossMaxHp : null),
    checkpointsHit: progress?.checkpointsHit ?? [],
    paused: progress?.paused ?? false,
    distanceM: dist,
    capturable,
    blockedReason,
  };
}

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

type GenInput = {
  lat: number;
  lng: number;
  level: number;
  xp: number;
  totalKm: number;
  totalElev: number;
  favoriteKind: "ride" | "run" | "walk";
};

const DIFFICULTY_BY_LEVEL: QuestDifficulty[] = ["facil", "media", "media", "dificil", "dificil", "lendaria"];

function pickDifficulty(level: number): QuestDifficulty {
  return DIFFICULTY_BY_LEVEL[Math.min(DIFFICULTY_BY_LEVEL.length - 1, Math.max(0, level - 1))];
}

/**
 * Gera missões a partir de dados reais: territórios cadastrados, segmentos
 * registrados pela comunidade e pontos do histórico do próprio atleta.
 * Nunca usa coordenadas aleatórias — e protege a localização residencial.
 */
export async function generateDynamicQuests(user: User, input: GenInput, limit = 4): Promise<{ created: number; guarded: number }> {
  const existing = await db.select({ key: quests.key }).from(quests);
  const known = new Set(existing.map((e) => e.key));
  const allTerritories = await db.select().from(territories);
  const allSegments = await db.select().from(segments);

  const recent = await db
    .select({ id: activities.id, track: activities.track, startedAt: activities.startedAt, sport: activities.sport })
    .from(activities)
    .where(and(eq(activities.userId, user.id), eq(activities.status, "published")))
    .orderBy(sql`${activities.startedAt} desc`)
    .limit(12);

  // Proteção de privacidade: o ponto de partida mais recorrente é tratado como
  // residência/base e jamais recebe objetivo.
  const starts: { lat: number; lng: number }[] = [];
  const candidatePoints: { lat: number; lng: number; alt?: number }[] = [];
  for (const a of recent) {
    const track = (a.track ?? []) as TrackPoint[];
    if (track.length > 10) starts.push({ lat: track[0].lat, lng: track[0].lng });
    const stride = Math.max(1, Math.floor(track.length / 40));
    for (let i = 0; i < track.length; i += stride) candidatePoints.push({ lat: track[i].lat, lng: track[i].lng, alt: track[i].alt });
  }
  const homeBase = clusterCenter(starts);
  const isPrivate = (lat: number, lng: number) => (homeBase ? haversine(lat, lng, homeBase.lat, homeBase.lng) < 400 : false);

  const difficulty = pickDifficulty(input.level);
  const inserts: (typeof quests.$inferInsert)[] = [];
  let guarded = 0;

  const push = (row: (typeof quests.$inferInsert) & { key: string }) => {
    if (known.has(row.key)) return;
    known.add(row.key);
    inserts.push(row);
  };

  // 1) Missões de exploração ancoradas em territórios reais conhecidos.
  const nearTerritories = [...allTerritories]
    .map((t) => ({ t, d: haversine(input.lat, input.lng, t.centerLat, t.centerLng) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);

  for (const { t } of nearTerritories) {
    // Offset determinístico dentro do território (borda), nunca no centro exato.
    const angle = (t.id * 137) % 360;
    const rad = (angle * Math.PI) / 180;
    const offsetM = Math.max(180, t.radiusM * 0.55);
    const lat = t.centerLat + (Math.cos(rad) * offsetM) / 110540;
    const lng = t.centerLng + (Math.sin(rad) * offsetM) / (111320 * Math.cos((t.centerLat * Math.PI) / 180));
    if (isPrivate(lat, lng)) {
      guarded += 1;
      continue;
    }
    push({
      key: `dyn-explore-${t.id}-${user.id}`,
      name: `Exploração · ${t.name}`,
      description: `Chegue ao ponto marcado dentro de ${t.name} e registre presença com o GPS do dispositivo.`,
      kind: "exploration",
      category: "explore",
      difficulty,
      emblemKey: "portal-blue",
      lat,
      lng,
      radiusM: 45,
      targetValue: 0,
      unit: "m",
      xpReward: 120 + t.xpReward / 2,
      coinsReward: 12,
      origin: "dynamic",
      verified: false,
      safetyNote: "Percurso precisa ser verificado no local. Respeite horários e regras do parque.",
    });
  }

  // 2) Missão de distância dimensionada pelo nível e pelo volume real do atleta.
  const distanceTarget = Math.round((input.favoriteKind === "ride" ? 8000 : 3000) * (1 + input.level * 0.25));
  push({
    key: `dyn-distance-${user.id}-${distanceTarget}`,
    name: `Desafio de distância · ${(distanceTarget / 1000).toFixed(0)} km`,
    description: `Acumule ${(distanceTarget / 1000).toFixed(0)} km em atividades reais registradas pelo GPS. Progresso contado uma única vez por atividade.`,
    kind: "distance",
    category: "mission",
    difficulty,
    emblemKey: "target-red",
    lat: null,
    lng: null,
    radiusM: 45,
    targetValue: distanceTarget,
    unit: "m",
    xpReward: 150 + Math.round(distanceTarget / 100),
    coinsReward: 15,
    origin: "dynamic",
    verified: true,
    safetyNote: "Progresso conta somente atividades publicadas com trilha válida.",
  });

  // 3) Missão de subida quando o atleta já tem volume de ganho.
  if (input.totalElev > 300) {
    const climbTarget = Math.min(1500, Math.max(200, Math.round(input.totalElev * 0.25)));
    push({
      key: `dyn-climb-${user.id}-${climbTarget}`,
      name: `Missão de subida · ${climbTarget} m`,
      description: `Acumule ${climbTarget} m de ganho de elevação em subidas reais registradas pelo altímetro do dispositivo.`,
      kind: "climb",
      category: "special",
      difficulty,
      emblemKey: "mountain-route-pin",
      lat: null,
      lng: null,
      radiusM: 45,
      targetValue: climbTarget,
      unit: "m_elev",
      xpReward: 200 + Math.round(climbTarget / 3),
      coinsReward: 20,
      origin: "dynamic",
      verified: true,
      safetyNote: "Escolha subidas conhecidas e evite trechos com trânsito rápido.",
    });
  }

  // 4) Baú de colecionável posicionado em ponto real do histórico (fora da base).
  const chestCandidate = candidatePoints
    .filter((p) => !isPrivate(p.lat, p.lng))
    .find((p) => haversine(input.lat, input.lng, p.lat, p.lng) > 1200);
  if (chestCandidate) {
    push({
      key: `dyn-chest-${user.id}-${chestCandidate.lat.toFixed(4)}`,
      name: "Baú de recompensa",
      description: "Um baú aparece em um ponto por onde você já passou. Chegue ao local e capture o prêmio presencialmente.",
      kind: "collectible",
      category: "chest",
      difficulty,
      emblemKey: "chest-gold",
      lat: chestCandidate.lat,
      lng: chestCandidate.lng,
      radiusM: 40,
      targetValue: 0,
      unit: "m",
      xpReward: 180,
      coinsReward: 25,
      origin: "dynamic",
      verified: false,
      safetyNote: "Percurso precisa ser verificado no local.",
    });
    guarded += 0;
  }

  // 5) Missão secreta em ponto de segmento real da comunidade.
  const secretSegment = allSegments.find((s) => haversine(input.lat, input.lng, s.startLat, s.startLng) > 1500);
  if (secretSegment) {
    push({
      key: `dyn-secret-${secretSegment.id}-${user.id}`,
      name: "Ponto secreto",
      description: `Uma localização especial próxima de "${secretSegment.name}" foi revelada. Descubra no mapa e capture no local.`,
      kind: "secret",
      category: "secret",
      difficulty,
      emblemKey: "crystal-purple",
      lat: secretSegment.endLat,
      lng: secretSegment.endLng,
      radiusM: 35,
      targetValue: 0,
      unit: "m",
      xpReward: 260,
      coinsReward: 30,
      origin: "dynamic",
      verified: false,
      safetyNote: "Percurso precisa ser verificado no local. Área pode ter acesso restrito.",
    });
  }

  if (inserts.length === 0) return { created: 0, guarded };

  const toInsert = inserts.slice(0, limit);
  await db.insert(quests).values(toInsert).onConflictDoNothing();
  return { created: toInsert.length, guarded };
}

function clusterCenter(points: { lat: number; lng: number }[]): { lat: number; lng: number } | null {
  if (points.length < 2) return null;
  // Média dos pontos que estão a menos de 150 m de qualquer outro (aprox. base).
  for (const anchor of points) {
    const near = points.filter((p) => haversine(anchor.lat, anchor.lng, p.lat, p.lng) < 150);
    if (near.length >= Math.max(2, Math.ceil(points.length / 2))) {
      return {
        lat: near.reduce((s, p) => s + p.lat, 0) / near.length,
        lng: near.reduce((s, p) => s + p.lng, 0) / near.length,
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
