import { haversine } from "@/lib/geo";
import { categoryAccent, categoryEmblem, type QuestCategory } from "@/lib/emblems";
import type { Quest, QuestWaypoint } from "@/db/schema";

export type QuestDifficulty = "facil" | "media" | "dificil" | "lendaria";
export type QuestKind = "exploration" | "distance" | "climb" | "endurance" | "secret" | "trail" | "collectible" | "route" | "boss";

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
  state: "available" | "unlocked" | "in_progress" | "completed";
  progress: number;
  hp: number | null;
  checkpointsHit: number[];
  paused: boolean;
  distanceM: number | null;
  capturable: boolean;
  blockedReason: string | null;
};

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
};

/* ------------------------------- Segurança GPS ------------------------------- */

/** Precisão máxima aceita para validar presença física (descarta salto de torre). */
export const MAX_TRUSTED_ACCURACY = 60;
/** Velocidade máxima (km/h) para permitir interação — o ciclista precisa estar parado. */
export const MAX_INTERACTION_SPEED = 4;

export function accuracyOk(accuracyM: number | null | undefined): boolean {
  return typeof accuracyM === "number" && accuracyM > 0 && accuracyM <= MAX_TRUSTED_ACCURACY;
}

export function isStationary(speedKmh: number | null | undefined): boolean {
  return typeof speedKmh !== "number" || speedKmh <= MAX_INTERACTION_SPEED;
}

/**
 * Raio de ativação efetivo. Amplia com a precisão do GPS (com teto) para não
 * exigir precisão cirúrgica em floresta urbana, mas nunca vira captura remota.
 */
export function effectiveRadius(quest: Pick<Quest, "radiusM">, accuracyM: number | null | undefined): number {
  const acc = typeof accuracyM === "number" && accuracyM > 0 ? accuracyM : 0;
  return Math.min(quest.radiusM + acc * 0.8, quest.radiusM * 1.8);
}

export function distanceToQuest(quest: Pick<Quest, "lat" | "lng">, lat: number, lng: number): number | null {
  if (typeof quest.lat !== "number" || typeof quest.lng !== "number") return null;
  return haversine(lat, lng, quest.lat, quest.lng);
}


/** Usado pela UI para saber se a precisão atual permite interação segura. */
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

/** Normaliza distância exibida, evitando poluição visual no painel mobile. */

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
