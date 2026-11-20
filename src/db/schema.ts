import { pgTable, serial, text, integer, doublePrecision, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export type TrackPoint = { lat: number; lng: number; alt: number | null; t: number; acc: number; spd: number | null };

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  sport: text("sport").notNull(),
  title: text("title").notNull(),
  caption: text("caption").notNull().default(""),
  status: text("status").notNull().default("draft"), // draft | published
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  elapsedSec: integer("elapsed_sec").notNull().default(0),
  movingSec: integer("moving_sec").notNull().default(0),
  distanceM: doublePrecision("distance_m").notNull().default(0),
  elevGainM: doublePrecision("elev_gain_m").notNull().default(0),
  maxAltM: doublePrecision("max_alt_m"),
  minAltM: doublePrecision("min_alt_m"),
  avgSpeed: doublePrecision("avg_speed").notNull().default(0), // m/s (moving)
  maxSpeed: doublePrecision("max_speed").notNull().default(0),
  calories: integer("calories").notNull().default(0),
  points: jsonb("points").$type<TrackPoint[]>().notNull().default([]),
  extra: jsonb("extra").$type<Record<string, string | number>>().notNull().default({}),
  kudos: integer("kudos").notNull().default(0),
  // anti-trapaça: "suspect" não gera XP, não conta para missões/bosses/desafios/rankings
  integrity: text("integrity").notNull().default("valid"),
  integrityReasons: jsonb("integrity_reasons").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityPhotos = pgTable("activity_photos", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  data: text("data").notNull(), // data URL (jpeg, compressed client-side)
  position: integer("position").notNull().default(0),
  isCover: boolean("is_cover").notNull().default(false),
  // diário de rota: onde/quando a foto foi tirada durante o treino (opcional)
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  kmMark: doublePrecision("km_mark"),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  author: text("author").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ───────── RPG geográfico — Operação Evolução ─────────
export type GeoPoint = { lat: number; lng: number; name?: string };
export type BossChallenge = { kind: "reach" | "distance" | "climb" | "route"; label: string; value: number; damage: number; done: boolean };
export type MissionReq = {
  distanceM?: number; elevGainM?: number; targetAltM?: number;
  checkpoints?: GeoPoint[]; // percurso: validado na ordem contra o trajeto GPS registrado
  path?: [number, number][]; // geometria real (OSM) quando disponível
  challenges?: BossChallenge[];
};

export const geoMissions = pgTable("geo_missions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // exploration | distance | climb | endurance | secret | trail | collectible | chest | boss | route
  category: text("category"), // boss: climb | endurance | exploration | legendary
  title: text("title").notNull(),
  description: text("description").notNull(),
  emblem: text("emblem").notNull(),
  lat: doublePrecision("lat"), // null = missão não-geográfica (distância/resistência)
  lng: doublePrecision("lng"),
  radiusM: integer("radius_m").notNull().default(35),
  difficulty: integer("difficulty").notNull().default(1), // 1..4
  xp: integer("xp").notNull().default(100),
  coins: integer("coins").notNull().default(10),
  item: text("item"), // chave de emblema concedida como item de inventário
  status: text("status").notNull().default("available"), // available | unlocked | in_progress | paused | completed
  req: jsonb("req").$type<MissionReq>().notNull().default({}),
  progress: jsonb("progress").$type<{ visited?: number[]; meters?: number; activityIds?: number[] }>().notNull().default({}),
  hp: integer("hp"),
  hpMax: integer("hp_max"),
  verified: boolean("verified").notNull().default(false), // percurso confirmado por dados OSM
  osmRef: text("osm_ref"),
  tier: text("tier"), // short | medium | long (alcance a partir do jogador)
  template: text("template"), // modelo recorrente (consistência)
  expiresAt: timestamp("expires_at", { withTimezone: true }), // bosses especiais e rotação
  photo: text("photo"), // check-in fotográfico: foto comprimida que concluiu a missão
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Livro-razão de recompensas: `source` único impede recompensa duplicada
export const rewardLedger = pgTable("reward_ledger", {
  id: serial("id").primaryKey(),
  source: text("source").notNull().unique(), // ex.: mission:12, boss:4:reach
  xp: integer("xp").notNull().default(0),
  coins: integer("coins").notNull().default(0),
  item: text("item"),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Cache de pontos de vias públicas (OSM) — fallback quando a API externa falha
export const roadPoints = pgTable("road_points", {
  id: serial("id").primaryKey(),
  cell: text("cell").notNull(), // grade ~1.1 km para consulta rápida
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  name: text("name"),
  highway: text("highway").notNull(),
  osmWay: text("osm_way").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
