// Catálogo central de brasões 3D — sprite sheet 3 linhas × 5 colunas (1536×1024)
export const SPRITE_URL = "https://i.imgur.com/QzjUbsz.jpeg";
export const SPRITE_COLS = 5;
export const SPRITE_ROWS = 3;

export type EmblemDef = { row: number; col: number; label: string; overrideUrl?: string; scale?: number; padding?: number };

export const EMBLEMS = {
  "flag-bike-mountain":   { row: 0, col: 0, label: "Bandeira de missão" },
  "medal-bike":           { row: 0, col: 1, label: "Medalha de ciclismo" },
  "chest-gold":           { row: 0, col: 2, label: "Baú de ouro" },
  "crystal-purple":       { row: 0, col: 3, label: "Cristal secreto" },
  "boss-golem":           { row: 0, col: 4, label: "Boss" },
  "flag-checkered-flame": { row: 1, col: 0, label: "Checkpoint" },
  "compass":              { row: 1, col: 1, label: "Bússola" },
  "mountain-route-pin":   { row: 1, col: 2, label: "Rota de montanha" },
  "shield-star-laurel":   { row: 1, col: 3, label: "Escudo de resistência" },
  "helmet-cycling-blue":  { row: 1, col: 4, label: "Capacete" },
  "portal-blue":          { row: 2, col: 0, label: "Portal de exploração" },
  "badge-mtb-trail":      { row: 2, col: 1, label: "Emblema de trilha" },
  "potion-lightning":     { row: 2, col: 2, label: "Poção de energia" },
  "trophy-gold":          { row: 2, col: 3, label: "Troféu" },
  "target-red":           { row: 2, col: 4, label: "Alvo" },
} satisfies Record<string, EmblemDef>;

export type EmblemKey = keyof typeof EMBLEMS;
export const isEmblem = (k: string): k is EmblemKey => k in EMBLEMS;

// Para trocar um brasão por um link individual do Imgur:
//   EMBLEMS["chest-gold"].overrideUrl = "https://i.imgur.com/XXXX.png"
// (edite diretamente o objeto acima adicionando `overrideUrl: "..."`).
// `scale` (padrão 1) e `padding` (px na célula original, padrão 6) ajustam o recorte.
export function emblemDef(k: string): EmblemDef { return (EMBLEMS as Record<string, EmblemDef>)[k] ?? EMBLEMS["flag-bike-mountain"]; }

// Linguagem visual por tipo de objetivo
export const TYPE_EMBLEM: Record<string, EmblemKey> = {
  exploration: "flag-bike-mountain", special: "medal-bike", chest: "chest-gold", collectible: "chest-gold", secret: "crystal-purple",
  boss: "boss-golem", checkpoint: "flag-checkered-flame", portal: "portal-blue", climb: "mountain-route-pin", endurance: "shield-star-laurel",
  distance: "medal-bike", trail: "badge-mtb-trail", route: "compass", photo: "compass",
};
// Variações visuais de boss (mesma arte 3D, tratamento de cor próprio)
export const BOSS_STYLE: Record<string, { name: string; filter: string }> = {
  climb: { name: "Titã — Guardião da Montanha", filter: "none" },
  endurance: { name: "Colosso de Gelo", filter: "hue-rotate(180deg) saturate(1.2)" },
  exploration: { name: "Golem da Floresta", filter: "hue-rotate(85deg)" },
  legendary: { name: "Lorde Lendário", filter: "hue-rotate(-25deg) saturate(1.6) brightness(1.1) drop-shadow(0 0 6px #D5FF45)" },
};
