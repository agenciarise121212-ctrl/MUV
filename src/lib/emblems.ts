/**
 * Catálogo central de brasões (EMBLEMS) do MUV.
 *
 * Os 15 brasões vivem numa única sprite sheet hospedada (3 linhas × 5 colunas),
 * lida da esquerda para a direita e de cima para baixo. Cada entrada aponta para
 * a célula (row, col) da grade e pode ser substituída individualmente por uma
 * URL própria através de `overrideUrl` — sem precisar mexer nos consumidores.
 */

export const EMBLEM_SPRITE = "https://i.imgur.com/QzjUbsz.jpeg";
export const EMBLEM_GRID = { cols: 5, rows: 3 } as const;

export type EmblemKey =
  | "flag-bike-mountain"
  | "medal-bike"
  | "chest-gold"
  | "crystal-purple"
  | "boss-golem"
  | "flag-checkered-flame"
  | "compass"
  | "mountain-route-pin"
  | "shield-star-laurel"
  | "helmet-cycling-blue"
  | "portal-blue"
  | "badge-mtb-trail"
  | "potion-lightning"
  | "trophy-gold"
  | "target-red";

export type EmblemRow = 0 | 1 | 2;
export type EmblemCol = 0 | 1 | 2 | 3 | 4;

export type EmblemDef = {
  key: EmblemKey;
  row: EmblemRow;
  col: EmblemCol;
  /** Rótulo usado em `alt`/`title` e na coleção. */
  label: string;
  /** Cor de acento usada no anel do brasão e nos destaques da interface. */
  accent: string;
  /** Substitui a sprite sheet por um arquivo individual para este brasão. */
  overrideUrl?: string;
};

export const EMBLEMS: Record<EmblemKey, EmblemDef> = {
  // Linha 1
  "flag-bike-mountain": { key: "flag-bike-mountain", row: 0, col: 0, label: "Bandeira de trilha", accent: "#6fb6ff" },
  "medal-bike": { key: "medal-bike", row: 0, col: 1, label: "Medalha de ciclismo", accent: "#ffd43b" },
  "chest-gold": { key: "chest-gold", row: 0, col: 2, label: "Baú de recompensa", accent: "#ffd43b" },
  "crystal-purple": { key: "crystal-purple", row: 0, col: 3, label: "Cristal secreto", accent: "#b197fc" },
  "boss-golem": { key: "boss-golem", row: 0, col: 4, label: "Boss guardião", accent: "#ff6a3d" },
  // Linha 2
  "flag-checkered-flame": { key: "flag-checkered-flame", row: 1, col: 0, label: "Bandeirada de chegada", accent: "#f5f5f2" },
  compass: { key: "compass", row: 1, col: 1, label: "Bússola de exploração", accent: "#d5ff45" },
  "mountain-route-pin": { key: "mountain-route-pin", row: 1, col: 2, label: "Rota de montanha", accent: "#ff6a3d" },
  "shield-star-laurel": { key: "shield-star-laurel", row: 1, col: 3, label: "Escudo de conquistas", accent: "#ffd43b" },
  "helmet-cycling-blue": { key: "helmet-cycling-blue", row: 1, col: 4, label: "Capacete de pedal", accent: "#6fb6ff" },
  // Linha 3
  "portal-blue": { key: "portal-blue", row: 2, col: 0, label: "Portal de exploração", accent: "#6fb6ff" },
  "badge-mtb-trail": { key: "badge-mtb-trail", row: 2, col: 1, label: "Emblema de trilha", accent: "#ff6a3d" },
  "potion-lightning": { key: "potion-lightning", row: 2, col: 2, label: "Impulso de energia", accent: "#d5ff45" },
  "trophy-gold": { key: "trophy-gold", row: 2, col: 3, label: "Troféu lendário", accent: "#ffd43b" },
  "target-red": { key: "target-red", row: 2, col: 4, label: "Alvo de distância", accent: "#ff6a3d" },
};

export const EMBLEM_KEYS = Object.keys(EMBLEMS) as EmblemKey[];

export function getEmblem(key: string | null | undefined): EmblemDef {
  if (!key) return EMBLEMS["flag-bike-mountain"];
  return EMBLEMS[key as EmblemKey] ?? EMBLEMS["flag-bike-mountain"];
}

/** URL efetiva do brasão: override individual ou a sprite sheet compartilhada. */
export function emblemSource(key: string | null | undefined): { url: string; row: EmblemRow; col: EmblemCol; isOverride: boolean } {
  const def = getEmblem(key);
  if (def.overrideUrl) return { url: def.overrideUrl, row: def.row, col: def.col, isOverride: true };
  return { url: EMBLEM_SPRITE, row: def.row, col: def.col, isOverride: false };
}

/** Permite sobrescrever um brasão em runtime (ex.: arte individual enviada depois). */
export function withOverride(key: EmblemKey, url: string | null): Record<EmblemKey, EmblemDef> {
  const next = { ...EMBLEMS };
  if (url) next[key] = { ...next[key], overrideUrl: url };
  else delete next[key].overrideUrl;
  return next;
}

/* --------------------- Categorias visuais dos pontos no mapa --------------------- */

export type QuestCategory =
  | "mission" // bandeira azul
  | "special" // medalha dourada
  | "chest" // baú
  | "secret" // cristal roxo
  | "boss" // personagem 3D grande
  | "explore" // portal / bússola
  | "checkpoint"; // bandeira de corrida

export const CATEGORY_META: Record<QuestCategory, { label: string; emblem: EmblemKey; accent: string }> = {
  mission: { label: "Missão", emblem: "flag-bike-mountain", accent: "#6fb6ff" },
  special: { label: "Missão especial", emblem: "medal-bike", accent: "#ffd43b" },
  chest: { label: "Baú de recompensa", emblem: "chest-gold", accent: "#ffd43b" },
  secret: { label: "Missão secreta", emblem: "crystal-purple", accent: "#b197fc" },
  boss: { label: "Boss geográfico", emblem: "boss-golem", accent: "#ff6a3d" },
  explore: { label: "Ponto de exploração", emblem: "portal-blue", accent: "#6fb6ff" },
  checkpoint: { label: "Checkpoint", emblem: "flag-checkered-flame", accent: "#f5f5f2" },
};

export function categoryEmblem(category: QuestCategory, kind: string): EmblemKey {
  // Afinidade por tipo de objetivo, mantendo a linguagem visual por categoria.
  if (kind === "distance") return "target-red";
  if (kind === "climb") return "mountain-route-pin";
  if (kind === "endurance") return "badge-mtb-trail";
  if (kind === "collectible") return "chest-gold";
  if (kind === "exploration") return "portal-blue";
  // Check-in fotográfico: bússola comunica "descobrir e registrar".
  if (kind === "checkin") return "compass";
  return CATEGORY_META[category]?.emblem ?? "flag-bike-mountain";
}

export function categoryAccent(category: QuestCategory, kind: string): string {
  return getEmblem(categoryEmblem(category, kind)).accent;
}

/* ------------------------- Brasões das conquistas ------------------------- */

/**
 * Associa cada conquista do catálogo ao brasão correspondente.
 * A coluna `emblem_key` do banco, quando preenchida, tem prioridade sobre este
 * mapa — assim uma arte individual pode substituir o padrão sem alterar código.
 */
export const ACHIEVEMENT_EMBLEM: Record<string, EmblemKey> = {
  first_activity: "flag-bike-mountain",
  run_5k: "target-red",
  run_10k: "target-red",
  run_21k: "medal-bike",
  run_total_42: "medal-bike",
  run_total_100: "medal-bike",
  ride_20k: "target-red",
  ride_50k: "target-red",
  ride_100k: "trophy-gold",
  ride_total_500: "medal-bike",
  ride_climb_500: "mountain-route-pin",
  ride_climb_2000: "mountain-route-pin",
  walk_10k_total: "compass",
  walk_50k_total: "compass",
  hike_climb_300: "badge-mtb-trail",
  trail_run_10k: "badge-mtb-trail",
  streak_3: "potion-lightning",
  streak_7: "potion-lightning",
  streak_30: "potion-lightning",
  early_bird: "portal-blue",
  night_owl: "crystal-purple",
  weekend_5: "flag-checkered-flame",
  elev_total_1000: "mountain-route-pin",
  activities_25: "shield-star-laurel",
  photographer: "chest-gold",
  territory_1: "compass",
  territory_5: "shield-star-laurel",
  social_kudos: "chest-gold",
  segment_cr: "trophy-gold",
  challenge_done: "trophy-gold",
};

const CATEGORY_DEFAULT_EMBLEM: Record<string, EmblemKey> = {
  corrida: "target-red",
  ciclismo: "medal-bike",
  caminhada: "compass",
  trilha: "badge-mtb-trail",
  constância: "potion-lightning",
  geral: "flag-bike-mountain",
  social: "chest-gold",
  território: "shield-star-laurel",
  segmento: "trophy-gold",
  desafio: "trophy-gold",
};

/** Resolve o brasão de uma conquista: banco → mapa por chave → mapa por categoria. */
export function emblemForAchievement(achievement: {
  key: string;
  category?: string;
  emblemKey?: string | null;
}): EmblemKey {
  if (achievement.emblemKey && achievement.emblemKey in EMBLEMS) return achievement.emblemKey as EmblemKey;
  const byKey = ACHIEVEMENT_EMBLEM[achievement.key];
  if (byKey) return byKey;
  if (achievement.category && achievement.category in CATEGORY_DEFAULT_EMBLEM) {
    return CATEGORY_DEFAULT_EMBLEM[achievement.category];
  }
  return "shield-star-laurel";
}
