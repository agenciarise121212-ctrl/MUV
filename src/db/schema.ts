import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

/** Raw binary storage used to keep activity photos inside PostgreSQL. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/** A single GPS sample captured by the recorder (real device GPS, never simulated). */
export type TrackPoint = {
  t: number;
  lat: number;
  lng: number;
  acc?: number;
  alt?: number;
  spd?: number;
};

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  bio: varchar("bio", { length: 280 }),
  city: varchar("city", { length: 120 }),
  avatarColor: varchar("avatar_color", { length: 24 }).notNull().default("volt"),
  weightKg: doublePrecision("weight_kg").default(72),
  sex: varchar("sex", { length: 12 }).default("m"),
  restingHr: integer("resting_hr").default(60),
  maxHr: integer("max_hr").default(190),
  autoPause: boolean("auto_pause").notNull().default(true),
  xp: integer("xp").notNull().default(0),
  coins: integer("coins").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: varchar("token", { length: 64 }).primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: integer("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("follows_pair_unique").on(t.followerId, t.followingId)],
);

export const activities = pgTable(
  "activities",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sport: varchar("sport", { length: 32 }).notNull(),
    subtype: varchar("subtype", { length: 48 }),
    name: varchar("name", { length: 140 }).notNull(),
    notes: text("notes"),
    location: varchar("location", { length: 160 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    elapsedSec: integer("elapsed_sec").notNull().default(0),
    movingSec: integer("moving_sec").notNull().default(0),
    distanceM: doublePrecision("distance_m").notNull().default(0),
    avgSpeedKmh: doublePrecision("avg_speed_kmh").notNull().default(0),
    maxSpeedKmh: doublePrecision("max_speed_kmh").notNull().default(0),
    paceSecPerKm: doublePrecision("pace_sec_per_km").notNull().default(0),
    elevGainM: doublePrecision("elev_gain_m").notNull().default(0),
    elevLossM: doublePrecision("elev_loss_m").notNull().default(0),
    maxElevM: doublePrecision("max_elev_m").notNull().default(0),
    calories: integer("calories").notNull().default(0),
    avgHr: integer("avg_hr"),
    maxHr: integer("max_hr"),
    maxGradePct: doublePrecision("max_grade_pct").notNull().default(0),
    pauses: integer("pauses").notNull().default(0),
    autoPauses: integer("auto_pauses").notNull().default(0),
    gpsPoints: integer("gps_points").notNull().default(0),
    avgAccuracyM: doublePrecision("avg_accuracy_m").notNull().default(0),
    /** Veredito de integridade: valid | suspicious | invalid. */
    integrityStatus: varchar("integrity_status", { length: 16 }).notNull().default("valid"),
    /** Motivo legível quando o percurso não é validado. */
    integrityReason: varchar("integrity_reason", { length: 400 }),
    /** Métricas de integridade (velocidade sustentada, saltos, amostras descartadas). */
    integrityMetrics: jsonb("integrity_metrics").$type<Record<string, number>>().notNull().default({}),
    /** Maior velocidade média sustentada detectada (km/h). */
    maxSustainedKmh: doublePrecision("max_sustained_kmh").notNull().default(0),
    /** Amostras de GPS descartadas por precisão ruim ou salto impossível. */
    discardedPoints: integer("discarded_points").notNull().default(0),
    /** Excluída de rankings, desafios e territórios por integridade comprometida. */
    blockedFromRanking: boolean("blocked_from_ranking").notNull().default(false),
    device: varchar("device", { length: 120 }),
    weather: varchar("weather", { length: 60 }),
    isIndoor: boolean("is_indoor").notNull().default(false),
    commute: boolean("commute").notNull().default(false),
    visibility: varchar("visibility", { length: 16 }).notNull().default("public"),
    status: varchar("status", { length: 16 }).notNull().default("published"),
    track: jsonb("track").$type<TrackPoint[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("activities_user_idx").on(t.userId), index("activities_sport_idx").on(t.sport)],
);

export const activityPhotos = pgTable(
  "activity_photos",
  {
    id: serial("id").primaryKey(),
    /** Nulo em fotos de check-in de missão (não pertencem a uma atividade). */
    activityId: integer("activity_id").references(() => activities.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mimeType: varchar("mime_type", { length: 40 }).notNull().default("image/jpeg"),
    data: bytea("data").notNull(),
    width: integer("width").notNull().default(0),
    height: integer("height").notNull().default(0),
    caption: varchar("caption", { length: 200 }),
    position: integer("position").notNull().default(0),
    /** Latitude no instante da foto — crava a imagem no trajeto. */
    latitude: doublePrecision("latitude"),
    /** Longitude no instante da foto. */
    longitude: doublePrecision("longitude"),
    /** Quilômetro do treino no instante da foto. */
    kmMark: doublePrecision("km_mark"),
    /** Altitude (m) no instante da foto, quando disponível. */
    altitudeM: doublePrecision("altitude_m"),
    /** Carimbo de tempo do treino (ms desde o início), para o replay. */
    elapsedAtMs: integer("elapsed_at_ms"),
    /** true quando a foto concluir um check-in fotográfico de missão. */
    checkinQuestId: integer("checkin_quest_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("photos_activity_idx").on(t.activityId), index("photos_geo_idx").on(t.latitude, t.longitude)],
);

export const kudos = pgTable(
  "kudos",
  {
    id: serial("id").primaryKey(),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("kudos_pair_unique").on(t.activityId, t.userId)],
);

export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: varchar("body", { length: 600 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_activity_idx").on(t.activityId)],
);

/** Conquistas (achievements) catalog. Seeded once, evaluated on every published activity. */
export const achievements = pgTable("achievements", {
  key: varchar("key", { length: 60 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 280 }).notNull(),
  category: varchar("category", { length: 32 }).notNull(),
  icon: varchar("icon", { length: 12 }).notNull().default("🏅"),
  metric: varchar("metric", { length: 48 }).notNull(),
  sport: varchar("sport", { length: 32 }),
  threshold: doublePrecision("threshold").notNull(),
  unit: varchar("unit", { length: 20 }).notNull().default("km"),
  tier: varchar("tier", { length: 16 }).notNull().default("bronze"),
  xpReward: integer("xp_reward").notNull().default(100),
  coinsReward: integer("coins_reward").notNull().default(10),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementKey: varchar("achievement_key", { length: 60 })
      .notNull()
      .references(() => achievements.key, { onDelete: "cascade" }),
    progress: doublePrecision("progress").notNull().default(0),
    activityId: integer("activity_id"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("user_achievement_unique").on(t.userId, t.achievementKey)],
);

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  description: varchar("description", { length: 400 }),
  sport: varchar("sport", { length: 32 }),
  metric: varchar("metric", { length: 32 }).notNull().default("distance_m"),
  target: doublePrecision("target").notNull(),
  unit: varchar("unit", { length: 20 }).notNull().default("km"),
  emoji: varchar("emoji", { length: 12 }).notNull().default("🏆"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull().defaultNow(),
  endAt: timestamp("end_at", { withTimezone: true }).notNull(),
  creatorId: integer("creator_id").references(() => users.id, { onDelete: "set null" }),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const challengeParticipants = pgTable(
  "challenge_participants",
  {
    id: serial("id").primaryKey(),
    challengeId: integer("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    progress: doublePrecision("progress").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("challenge_participant_unique").on(t.challengeId, t.userId)],
);

/** Territórios exclusivos do app: regiões que podem ser dominadas por atividades reais. */
export const territories = pgTable("territories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  region: varchar("region", { length: 120 }).notNull(),
  description: varchar("description", { length: 400 }),
  emoji: varchar("emoji", { length: 12 }).notNull().default("🗺️"),
  centerLat: doublePrecision("center_lat").notNull(),
  centerLng: doublePrecision("center_lng").notNull(),
  radiusM: doublePrecision("radius_m").notNull().default(1500),
  xpReward: integer("xp_reward").notNull().default(250),
  coinsReward: integer("coins_reward").notNull().default(25),
});

export const territoryClaims = pgTable(
  "territory_claims",
  {
    id: serial("id").primaryKey(),
    territoryId: integer("territory_id")
      .notNull()
      .references(() => territories.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityId: integer("activity_id"),
    distanceInsideM: doublePrecision("distance_inside_m").notNull().default(0),
    claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("territory_claim_unique").on(t.territoryId, t.userId)],
);

/** Recompensas resgatáveis com moedas conquistadas no app. */
export const rewards = pgTable("rewards", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  description: varchar("description", { length: 300 }),
  category: varchar("category", { length: 40 }).notNull().default("kit"),
  emoji: varchar("emoji", { length: 12 }).notNull().default("🎁"),
  cost: integer("cost").notNull().default(100),
  partner: varchar("partner", { length: 120 }),
  stock: integer("stock").notNull().default(50),
});

export const rewardRedemptions = pgTable("reward_redemptions", {
  id: serial("id").primaryKey(),
  rewardId: integer("reward_id")
    .notNull()
    .references(() => rewards.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 32 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("pendente"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const segments = pgTable("segments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 140 }).notNull(),
  description: varchar("description", { length: 300 }),
  sport: varchar("sport", { length: 32 }).notNull().default("ride"),
  city: varchar("city", { length: 120 }),
  distanceM: doublePrecision("distance_m").notNull().default(0),
  avgGradePct: doublePrecision("avg_grade_pct").notNull().default(0),
  startLat: doublePrecision("start_lat").notNull(),
  startLng: doublePrecision("start_lng").notNull(),
  endLat: doublePrecision("end_lat").notNull(),
  endLng: doublePrecision("end_lng").notNull(),
  path: jsonb("path").$type<TrackPoint[]>().notNull().default([]),
  creatorId: integer("creator_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const segmentEfforts = pgTable(
  "segment_efforts",
  {
    id: serial("id").primaryKey(),
    segmentId: integer("segment_id")
      .notNull()
      .references(() => segments.id, { onDelete: "cascade" }),
    activityId: integer("activity_id")
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    elapsedSec: integer("elapsed_sec").notNull(),
    avgSpeedKmh: doublePrecision("avg_speed_kmh").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("segment_effort_unique").on(t.segmentId, t.activityId)],
);

/** Recordes pessoais por modalidade (PRs de ciclismo, corrida, caminhada...). */
export const personalRecords = pgTable(
  "personal_records",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sport: varchar("sport", { length: 32 }).notNull(),
    category: varchar("category", { length: 48 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    value: doublePrecision("value").notNull(),
    unit: varchar("unit", { length: 20 }).notNull(),
    activityId: integer("activity_id"),
    setAt: timestamp("set_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("pr_unique").on(t.userId, t.sport, t.category)],
);

/** Ponto de controle de uma rota de missão (validado contra a trilha GPS real). */
export type QuestWaypoint = { lat: number; lng: number; label: string; order: number };

export const quests = pgTable(
  "quests",
  {
    id: serial("id").primaryKey(),
    key: varchar("key", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 140 }).notNull(),
    description: varchar("description", { length: 500 }).notNull(),
    /** exploration | distance | climb | endurance | secret | trail | collectible | route | boss */
    kind: varchar("kind", { length: 24 }).notNull(),
    /** mission | special | chest | secret | boss | explore | checkpoint */
    category: varchar("category", { length: 24 }).notNull(),
    /** facil | media | dificil | lendaria */
    difficulty: varchar("difficulty", { length: 16 }).notNull().default("media"),
    emblemKey: varchar("emblem_key", { length: 40 }).notNull().default("flag-bike-mountain"),
    sport: varchar("sport", { length: 32 }),
    /** Coordenadas do objetivo. Nulas em missões exclusivamente por métrica. */
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    /** Raio de ativação em metros (captura presencial). */
    radiusM: doublePrecision("radius_m").notNull().default(45),
    /** Meta da missão: metros, metros de ganho ou checkpoints. */
    targetValue: doublePrecision("target_value").notNull().default(0),
    unit: varchar("unit", { length: 16 }).notNull().default("m"),
    xpReward: integer("xp_reward").notNull().default(150),
    coinsReward: integer("coins_reward").notNull().default(15),
    waypoints: jsonb("waypoints").$type<QuestWaypoint[]>().notNull().default([]),
    bossKind: varchar("boss_kind", { length: 24 }),
    bossMaxHp: integer("boss_max_hp").notNull().default(0),
    /** Origem da missão: catalogue | gerada por dinâmica. */
    origin: varchar("origin", { length: 16 }).notNull().default("catalogue"),
    /** Anel de distância do objetivo: curto | medio | longo (escala de recompensa). */
    tier: varchar("tier", { length: 12 }).notNull().default("medio"),
    /** Via pública onde o objetivo está ancorado (nome OSM, quando disponível). */
    roadName: varchar("road_name", { length: 140 }),
    /** Tipo de via OSM usado para validar que o ponto é transitável. */
    roadType: varchar("road_type", { length: 32 }),
    /** Boss especial desbloqueado por pré-requisitos. */
    isSpecial: boolean("is_special").notNull().default(false),
    /** Desafios pré-requisitos para invocar este boss especial. */
    prerequisite: integer("prerequisite").notNull().default(0),
    /** Momento em que o objetivo apareceu no mapa. */
    spawnedAt: timestamp("spawned_at", { withTimezone: true }),
    /** Prazo de rotação: após expirar, o objetivo é trocado por outro local. */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** true quando a missão exige foto real no local (check-in fotográfico). */
    requiresPhoto: boolean("requires_photo").notNull().default(false),
    /** Indica se a área/percurso é de acesso confirmado. */
    verified: boolean("verified").notNull().default(false),
    safetyNote: varchar("safety_note", { length: 240 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quests_kind_idx").on(t.kind), index("quests_active_idx").on(t.isActive)],
);

export const questProgress = pgTable(
  "quest_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questId: integer("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "cascade" }),
    /** available | unlocked | in_progress | completed */
    state: varchar("state", { length: 16 }).notNull().default("available"),
    progress: doublePrecision("progress").notNull().default(0),
    /** HP restante em bosses. */
    hp: integer("hp"),
    /** Índices de checkpoints já validados no percurso real. */
    checkpointsHit: jsonb("checkpoints_hit").$type<number[]>().notNull().default([]),
    /** Atividades reais já creditadas — evita recompensa duplicada. */
    creditedActivities: jsonb("credited_activities").$type<number[]>().notNull().default([]),
    activityId: integer("activity_id"),
    capturedLat: doublePrecision("captured_lat"),
    capturedLng: doublePrecision("captured_lng"),
    accuracyM: doublePrecision("accuracy_m"),
    paused: boolean("paused").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("quest_progress_unique").on(t.userId, t.questId)],
);

export type Quest = typeof quests.$inferSelect;
export type QuestProgress = typeof questProgress.$inferSelect;

export type User = typeof users.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type ActivityPhoto = typeof activityPhotos.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;
export type Territory = typeof territories.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type Segment = typeof segments.$inferSelect;
