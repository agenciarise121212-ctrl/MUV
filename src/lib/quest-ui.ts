import { categoryAccent, categoryEmblem, type QuestCategory } from "@/lib/emblems";
import { haversine } from "@/lib/geo";
import type { Quest, QuestWaypoint } from "@/db/schema";
import type { RingTier } from "@/lib/roads";

export type QuestDifficulty = "facil" | "media" | "dificil" | "lendaria";
export type QuestKind =
  | "exploration"
  | "distance"
  | "climb"
  | "endurance"
  | "secret"
  | "trail"
  | "collectible"
  | "route"
  | "boss"
  | "checkin";

export const DIFFICULTY_META: Record<QuestDifficulty, { label: string; accent: string }> = {
  facil: { label: "Fácil", accent: "#63e6be" },
  media: { label: "Média", accent: "#6fb6ff" },
  dificil: { label: "Difícil", accent: "#ff6a3d" },
  lendaria: { label: "Lendária", accent: "#ffd43b" },
};

export const KIND_LABEL: Record<QuestKind, string> = {
  exploration: "Missão de exploração",
  distance: "Missão de distância",
  climb: "Missão de subida",
  endurance: "Missão de resistência",
  secret: "Missão secreta",
  trail: "Missão de trilha",
  collectible: "Coleção",
  route: "Rota de aventura",
  boss: "Boss geográfico",
  checkin: "Check-in fotográfico",
};

export const TIER_LABEL: Record<RingTier, string> = {
  curto: "Curto alcance",
  medio: "Médio alcance",
  longo: "Longo alcance",
};

/* ----------------------------- Segurança GPS ----------------------------- */

export const MAX_TRUSTED_ACCURACY = 60;
export const MAX_INTERACTION_SPEED = 4;

export function accuracyOk(accuracyM: number | null | undefined): boolean {
  return typeof accuracyM === "number" && accuracyM > 0 && accuracyM <= MAX_TRUSTED_ACCURACY;
}

export function isStationary(speedKmh: number | null | undefined): boolean {
  return typeof speedKmh !== "number" || speedKmh <= MAX_INTERACTION_SPEED;
}

export function effectiveRadius(quest: Pick<Quest, "radiusM">, accuracyM: number | null | undefined): number {
  const acc = typeof accuracyM === "number" && accuracyM > 0 ? accuracyM : 0;
  return Math.min(quest.radiusM + acc * 0.8, quest.radiusM * 1.8);
}

export function distanceToQuest(quest: Pick<Quest, "lat" | "lng">, lat: number, lng: number): number | null {
  if (typeof quest.lat !== "number" || typeof quest.lng !== "number") return null;
  return haversine(lat, lng, quest.lat, quest.lng);
}

export type QuestView = {
  id: number;
  key: string;
  name: string;
  description: string;
  kind: QuestKind;
  kindLabel: string;
  category: QuestCategory;
  difficulty: QuestDifficulty;
  difficultyLabel: string;
  accent: string;
  emblem: string;
  sport: string | null;
  lat: number | null;
  lng: number | null;
  radiusM: number;
  targetValue: number;
  unit: string;
  xpReward: number;
  coinsReward: number;
  waypoints: QuestWaypoint[];
  bossKind: string | null;
  bossMaxHp: number;
  origin: string;
  verified: boolean;
  safetyNote: string | null;
  tier: RingTier;
  tierLabel: string;
  roadName: string | null;
  roadType: string | null;
  roadSafe: boolean;
  isSpecial: boolean;
  prerequisite: number;
  /** true quando a missão exige foto real no local (check-in fotográfico). */
  requiresPhoto: boolean;
  spawnedAt: string | null;
  expiresAt: string | null;
  timeLeftSec: number | null;
  expired: boolean;
  state: "available" | "unlocked" | "in_progress" | "completed";
  progress: number;
  hp: number | null;
  checkpointsHit: number[];
  paused: boolean;
  distanceM: number | null;
  capturable: boolean;
  blockedReason: string | null;
};

export function timeRemaining(expiresAt: string | Date | null | undefined, now = Date.now()): number | null {
  if (!expiresAt) return null;
  const target = typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt.getTime();
  return Math.max(0, Math.round((target - now) / 1000));
}

export function formatCountdown(totalSec: number | null): string | null {
  if (totalSec === null) return null;
  if (totalSec <= 0) return "expirado";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}min`;
  return `${m}min`;
}

export function toQuestView(
  quest: Quest,
  progress:
    | { state: string; progress: number; hp: number | null; checkpointsHit: number[]; paused: boolean }
    | undefined,
  position: { lat: number; lng: number; accuracyM?: number | null; speedKmh?: number | null } | null,
): QuestView {
  const kind = quest.kind as QuestKind;
  const category = quest.category as QuestCategory;
  const difficulty = quest.difficulty as QuestDifficulty;
  const state = (progress?.state ?? "available") as QuestView["state"];
  const dist = position && typeof quest.lat === "number" ? distanceToQuest(quest, position.lat, position.lng) : null;
  const inRange = dist !== null && dist <= effectiveRadius(quest, position?.accuracyM ?? null);
  const accuracyOkFlag = accuracyOk(position?.accuracyM ?? null);
  const tier = (quest.tier ?? "medio") as RingTier;
  const expiresAt = quest.expiresAt ? new Date(quest.expiresAt).toISOString() : null;
  const left = timeRemaining(expiresAt);

  let capturable = false;
  let blockedReason: string | null = null;

  // Check-in fotográfico: exige foto real tirada no local, além da presença.
  const photoCheck = Boolean((quest as { requiresPhoto?: boolean }).requiresPhoto);

  if (state !== "completed" && quest.lat !== null) {
    if (left !== null && left <= 0) {
      blockedReason = "Tempo esgotado. Este objetivo vai rotacionar para outro local.";
    } else if (!accuracyOkFlag) {
      blockedReason = "Sinal de GPS impreciso — aproxime-se em céu aberto para validar presença.";
    } else if (!inRange) {
      blockedReason = `Aproxime-se: faltam ${Math.max(0, Math.round((dist ?? 0) - effectiveRadius(quest, position?.accuracyM ?? null)))} m.`;
    } else if (!photoCheck && position?.speedKmh != null && !isStationary(position.speedKmh)) {
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
    tier,
    tierLabel: TIER_LABEL[tier],
    roadName: quest.roadName ?? null,
    roadType: quest.roadType ?? null,
    roadSafe: !quest.roadType || !["trunk", "trunk_link", "primary", "primary_link"].includes(quest.roadType),
    isSpecial: quest.isSpecial,
    prerequisite: quest.prerequisite,
    requiresPhoto: Boolean(quest.requiresPhoto),
    spawnedAt: quest.spawnedAt ? new Date(quest.spawnedAt).toISOString() : null,
    expiresAt,
    timeLeftSec: left,
    expired: left !== null && left <= 0,
    state,
    progress: progress?.progress ?? 0,
    hp: progress?.hp ?? (quest.bossMaxHp > 0 ? quest.bossMaxHp : null),
    checkpointsHit: progress?.checkpointsHit ?? [],
    paused: progress?.paused ?? false,
    distanceM: dist === null ? null : Math.round(dist),
    capturable,
    blockedReason,
  };
}

export const QUEST_STAT_LABEL: Record<QuestView["state"], string> = {
  available: "Disponível",
  unlocked: "Desbloqueada",
  in_progress: "Em andamento",
  completed: "Concluída",
};

export function questProgressLabel(view: QuestView): string {
  if (view.state === "completed") return "Concluída";
  if (view.kind === "boss") return `${view.hp ?? 0}/${view.bossMaxHp} HP`;
  if (view.kind === "route") return `${view.checkpointsHit.length}/${view.waypoints.length} checkpoints`;
  if (view.targetValue > 0) {
    const value = view.unit === "m" ? `${(view.progress / 1000).toFixed(1)} km` : `${Math.round(view.progress)} m`;
    const goal = view.unit === "m" ? `${(view.targetValue / 1000).toFixed(1)} km` : `${Math.round(view.targetValue)} m`;
    return `${value} / ${goal}`;
  }
  return view.state === "unlocked" ? "Pronta para capturar" : "Disponível";
}

export function formatQuestDistance(meters: number | null): string {
  if (meters === null) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

export function gpsReadiness(accuracyM: number | null | undefined): { ok: boolean; label: string; accent: string } {
  if (!accuracyOk(accuracyM)) {
    return {
      ok: false,
      label: accuracyM === 0 || accuracyM == null ? "Aguardando GPS" : `GPS fraco ±${Math.round(accuracyM ?? 0)} m`,
      accent: "#ff6a3d",
    };
  }
  if ((accuracyM ?? 0) <= 10) return { ok: true, label: `GPS ótimo ±${Math.round(accuracyM ?? 0)} m`, accent: "#d5ff45" };
  if ((accuracyM ?? 0) <= 25) return { ok: true, label: `GPS bom ±${Math.round(accuracyM ?? 0)} m`, accent: "#63e6be" };
  return { ok: true, label: `GPS regular ±${Math.round(accuracyM ?? 0)} m`, accent: "#ffd43b" };
}
