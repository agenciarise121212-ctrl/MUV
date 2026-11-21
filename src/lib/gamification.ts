import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  achievements,
  challengeParticipants,
  challenges,
  personalRecords,
  segmentEfforts,
  segments,
  territoryClaims,
  territories,
  userAchievements,
  users,
  activityPhotos,
  kudos,
  type Activity,
  type TrackPoint,
  type User,
} from "@/db/schema";
import { computeSplits, distanceInsideCircle, haversine, matchSegment } from "@/lib/geo";
import { getSport } from "@/lib/sports";
import { levelFromXp } from "@/lib/levels";

export { LEVELS, levelFromXp } from "@/lib/levels";
export type { LevelDef } from "@/lib/levels";

export function xpForActivity(activity: {
  sport: string;
  distanceM: number;
  movingSec: number;
  elevGainM: number;
}): number {
  const sport = getSport(activity.sport);
  const perKm = sport.category === "ride" ? 11 : sport.category === "run" ? 16 : 10;
  const km = activity.distanceM / 1000;
  const minutes = activity.movingSec / 60;
  const xp = 18 + km * perKm + activity.elevGainM * 0.6 + minutes * 0.4;
  return Math.max(10, Math.round(xp));
}

export function coinsForXp(xp: number): number {
  return Math.max(2, Math.round(xp / 10));
}

export type AchievementSeed = {
  key: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  metric: string;
  sport: string | null;
  threshold: number;
  unit: string;
  tier: string;
  xpReward: number;
  coinsReward: number;
};

/** Catálogo de conquistas do app (distância, elevação, constância, ciclismo, trilhas, fotos, territórios). */
export const ACHIEVEMENT_CATALOG: AchievementSeed[] = [
  { key: "first_activity", name: "Primeiro movimento", description: "Registre sua primeira atividade.", category: "geral", icon: "🌱", metric: "activities", sport: null, threshold: 1, unit: "atividades", tier: "bronze", xpReward: 120, coinsReward: 10 },
  { key: "run_5k", name: "Cinco quilômetros", description: "Complete uma corrida de 5 km.", category: "corrida", icon: "🏃", metric: "longest_run_m", sport: "run", threshold: 5000, unit: "m", tier: "bronze", xpReward: 150, coinsReward: 15 },
  { key: "run_10k", name: "Dez voando", description: "Complete uma corrida de 10 km.", category: "corrida", icon: "🔟", metric: "longest_run_m", sport: "run", threshold: 10000, unit: "m", tier: "prata", xpReward: 250, coinsReward: 25 },
  { key: "run_21k", name: "Meia maratona", description: "Complete 21,1 km em uma única corrida.", category: "corrida", icon: "🥈", metric: "longest_run_m", sport: "run", threshold: 21100, unit: "m", tier: "ouro", xpReward: 500, coinsReward: 60 },
  { key: "run_total_42", name: "Maratonista", description: "Acumule 42 km de corrida.", category: "corrida", icon: "🏅", metric: "sport_distance_m", sport: "run", threshold: 42195, unit: "m", tier: "ouro", xpReward: 400, coinsReward: 40 },
  { key: "run_total_100", name: "Cem km de asfalto", description: "Acumule 100 km de corrida.", category: "corrida", icon: "💯", metric: "sport_distance_m", sport: "run", threshold: 100000, unit: "m", tier: "ouro", xpReward: 700, coinsReward: 80 },
  { key: "ride_20k", name: "Primeiro pedal", description: "Complete um pedal de 20 km.", category: "ciclismo", icon: "🚴", metric: "longest_ride_m", sport: "ride", threshold: 20000, unit: "m", tier: "bronze", xpReward: 150, coinsReward: 15 },
  { key: "ride_50k", name: "Cinquenta na estrada", description: "Complete um pedal de 50 km.", category: "ciclismo", icon: "🛣️", metric: "longest_ride_m", sport: "ride", threshold: 50000, unit: "m", tier: "prata", xpReward: 300, coinsReward: 30 },
  { key: "ride_100k", name: "Pedal centenário", description: "Complete 100 km em um único pedal.", category: "ciclismo", icon: "🥇", metric: "longest_ride_m", sport: "ride", threshold: 100000, unit: "m", tier: "ouro", xpReward: 800, coinsReward: 100 },
  { key: "ride_total_500", name: "500 km de pedal", description: "Acumule 500 km de ciclismo.", category: "ciclismo", icon: "⚙️", metric: "sport_distance_m", sport: "ride", threshold: 500000, unit: "m", tier: "ouro", xpReward: 900, coinsReward: 110 },
  { key: "ride_climb_500", name: "Alpinista de pedal", description: "Acumule 500 m de ganho em ciclismo.", category: "ciclismo", icon: "⛰️", metric: "sport_elev_m", sport: "ride", threshold: 500, unit: "m", tier: "prata", xpReward: 300, coinsReward: 30 },
  { key: "ride_climb_2000", name: "Montanha vencida", description: "Acumule 2.000 m de ganho em ciclismo.", category: "ciclismo", icon: "🏔️", metric: "sport_elev_m", sport: "ride", threshold: 2000, unit: "m", tier: "ouro", xpReward: 800, coinsReward: 90 },
  { key: "walk_10k_total", name: "Passo firme", description: "Acumule 10 km de caminhada.", category: "caminhada", icon: "🚶", metric: "sport_distance_m", sport: "walk", threshold: 10000, unit: "m", tier: "bronze", xpReward: 150, coinsReward: 15 },
  { key: "walk_50k_total", name: "Andarilho", description: "Acumule 50 km de caminhada.", category: "caminhada", icon: "🧭", metric: "sport_distance_m", sport: "walk", threshold: 50000, unit: "m", tier: "prata", xpReward: 350, coinsReward: 35 },
  { key: "hike_climb_300", name: "Cume alcançado", description: "Acumule 300 m de ganho em trilhas.", category: "trilha", icon: "🥾", metric: "sport_elev_m", sport: "hike", threshold: 300, unit: "m", tier: "prata", xpReward: 300, coinsReward: 30 },
  { key: "trail_run_10k", name: "Trail 10k", description: "Complete 10 km de trail running.", category: "trilha", icon: "⛰️", metric: "longest_sport_m", sport: "run_trail", threshold: 10000, unit: "m", tier: "ouro", xpReward: 450, coinsReward: 45 },
  { key: "streak_3", name: "Três dias seguidos", description: "Atividades em 3 dias consecutivos.", category: "constância", icon: "🔥", metric: "streak", sport: null, threshold: 3, unit: "dias", tier: "bronze", xpReward: 200, coinsReward: 20 },
  { key: "streak_7", name: "Semana perfeita", description: "Atividades em 7 dias consecutivos.", category: "constância", icon: "🔥", metric: "streak", sport: null, threshold: 7, unit: "dias", tier: "prata", xpReward: 450, coinsReward: 45 },
  { key: "streak_30", name: "Mês imparável", description: "Atividades em 30 dias consecutivos.", category: "constância", icon: "☄️", metric: "streak", sport: null, threshold: 30, unit: "dias", tier: "ouro", xpReward: 1200, coinsReward: 150 },
  { key: "early_bird", name: "Aurora", description: "Conclua uma atividade antes das 6h.", category: "constância", icon: "🌅", metric: "early_activity", sport: null, threshold: 1, unit: "treinos", tier: "bronze", xpReward: 120, coinsReward: 12 },
  { key: "night_owl", name: "Coruja do pedal", description: "Conclua uma atividade depois das 22h.", category: "constância", icon: "🌙", metric: "night_activity", sport: null, threshold: 1, unit: "treinos", tier: "bronze", xpReward: 120, coinsReward: 12 },
  { key: "weekend_5", name: "Guerreiro de fim de semana", description: "5 atividades em sábados ou domingos.", category: "constância", icon: "🎉", metric: "weekend_activities", sport: null, threshold: 5, unit: "treinos", tier: "prata", xpReward: 250, coinsReward: 25 },
  { key: "elev_total_1000", name: "Mil metros verticais", description: "Acumule 1.000 m de ganho total.", category: "geral", icon: "🧗", metric: "elev_total_m", sport: null, threshold: 1000, unit: "m", tier: "prata", xpReward: 350, coinsReward: 35 },
  { key: "activities_25", name: "Vinte e cinco", description: "Complete 25 atividades.", category: "geral", icon: "📚", metric: "activities", sport: null, threshold: 25, unit: "atividades", tier: "prata", xpReward: 400, coinsReward: 40 },
  { key: "photographer", name: "Fotógrafo de trilha", description: "Publique 10 fotos em atividades.", category: "social", icon: "📸", metric: "photos", sport: null, threshold: 10, unit: "fotos", tier: "prata", xpReward: 300, coinsReward: 30 },
  { key: "territory_1", name: "Território dominado", description: "Domine seu primeiro território.", category: "território", icon: "🗺️", metric: "territories", sport: null, threshold: 1, unit: "territórios", tier: "prata", xpReward: 400, coinsReward: 40 },
  { key: "territory_5", name: "Cartógrafo", description: "Domine 5 territórios.", category: "território", icon: "🧭", metric: "territories", sport: null, threshold: 5, unit: "territórios", tier: "ouro", xpReward: 900, coinsReward: 100 },
  { key: "social_kudos", name: "Torcedor", description: "Receba 25 kudos nas suas atividades.", category: "social", icon: "👏", metric: "kudos_received", sport: null, threshold: 25, unit: "kudos", tier: "bronze", xpReward: 200, coinsReward: 20 },
  { key: "segment_cr", name: "Rei do segmento", description: "Seja o mais rápido em um segmento.", category: "segmento", icon: "👑", metric: "segment_crs", sport: null, threshold: 1, unit: "CRs", tier: "ouro", xpReward: 600, coinsReward: 70 },
  { key: "challenge_done", name: "Desafio concluído", description: "Conclua um desafio.", category: "desafio", icon: "🏆", metric: "challenges_completed", sport: null, threshold: 1, unit: "desafios", tier: "prata", xpReward: 350, coinsReward: 35 },
];

export const ACHIEVEMENT_BY_KEY = new Map(ACHIEVEMENT_CATALOG.map((a) => [a.key, a]));

export async function ensureAchievementCatalog(): Promise<void> {
  const existing = await db.select({ key: achievements.key }).from(achievements);
  const known = new Set(existing.map((r) => r.key));
  const missing = ACHIEVEMENT_CATALOG.filter((a) => !known.has(a.key));
  if (missing.length > 0) {
    await db.insert(achievements).values(missing).onConflictDoNothing();
  }
}

type Context = {
  activities: number;
  totalDistanceM: number;
  totalElevM: number;
  sportDistanceM: Record<string, number>;
  sportElevM: Record<string, number>;
  longestRunM: number;
  longestRideM: number;
  longestSportM: Record<string, number>;
  streak: number;
  photos: number;
  territories: number;
  kudosReceived: number;
  segmentCrs: number;
  challengesCompleted: number;
  earlyActivity: number;
  nightActivity: number;
  weekendActivities: number;
};

async function buildContext(userId: number, activity: Activity | null): Promise<Context> {
  const [overall] = await db
    .select({
      count: sql<number>`count(*)::int`,
      distance: sql<number>`coalesce(sum(${activities.distanceM}), 0)::float`,
      elev: sql<number>`coalesce(sum(${activities.elevGainM}), 0)::float`,
    })
    .from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.status, "published")));

  const perSport = await db
    .select({
      sport: activities.sport,
      count: sql<number>`count(*)::int`,
      distance: sql<number>`coalesce(sum(${activities.distanceM}), 0)::float`,
      elev: sql<number>`coalesce(sum(${activities.elevGainM}), 0)::float`,
      longest: sql<number>`coalesce(max(${activities.distanceM}), 0)::float`,
    })
    .from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.status, "published")))
    .groupBy(activities.sport);

  const [photoAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityPhotos)
    .where(eq(activityPhotos.userId, userId));

  const [kudosAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kudos)
    .innerJoin(activities, eq(activities.id, kudos.activityId))
    .where(eq(activities.userId, userId));

  const [territoryAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(territoryClaims)
    .where(eq(territoryClaims.userId, userId));

  const [challengeAgg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(challengeParticipants)
    .where(and(eq(challengeParticipants.userId, userId), sql`${challengeParticipants.completedAt} is not null`));

  const crResult = await db.execute(sql`
    with best as (
      select segment_id, min(elapsed_sec) as best_sec
      from segment_efforts group by segment_id
    )
    select count(*)::int as n
    from best b
    join segment_efforts s on s.segment_id = b.segment_id and s.elapsed_sec = b.best_sec
    where s.user_id = ${userId}
  `);
  const crRows = (crResult as unknown as { rows: { n: number }[] }).rows ?? [];
  const crAgg = { count: crRows[0]?.n ?? 0 };

  const sportDistanceM: Record<string, number> = {};
  const sportElevM: Record<string, number> = {};
  const longestSportM: Record<string, number> = {};
  let longestRunM = 0;
  let longestRideM = 0;
  for (const row of perSport) {
    sportDistanceM[row.sport] = row.distance;
    sportElevM[row.sport] = row.elev;
    longestSportM[row.sport] = row.longest;
    const cat = getSport(row.sport).category;
    if (cat === "run") longestRunM = Math.max(longestRunM, row.longest);
    if (cat === "ride") longestRideM = Math.max(longestRideM, row.longest);
  }

  const since = new Date(Date.now() - 45 * 86400000);
  const dayRows = await db
    .select({ day: sql<string>`to_char(${activities.startedAt}, 'YYYY-MM-DD')` })
    .from(activities)
    .where(and(eq(activities.userId, userId), gte(activities.startedAt, since)))
    .groupBy(sql`to_char(${activities.startedAt}, 'YYYY-MM-DD')`);
  const daySet = new Set(dayRows.map((r) => r.day));
  let streak = 0;
  const cursor = new Date();
  if (!daySet.has(cursor.toISOString().slice(0, 10))) cursor.setDate(cursor.getDate() - 1);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (!daySet.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  let earlyActivity = 0;
  let nightActivity = 0;
  let weekendActivities = 0;
  const hourRows = await db
    .select({ startedAt: activities.startedAt })
    .from(activities)
    .where(eq(activities.userId, userId));
  for (const row of hourRows) {
    const h = new Date(row.startedAt).getHours();
    if (h < 6) earlyActivity += 1;
    if (h >= 22) nightActivity += 1;
    const wd = new Date(row.startedAt).getDay();
    if (wd === 0 || wd === 6) weekendActivities += 1;
  }

  return {
    activities: overall?.count ?? 0,
    totalDistanceM: overall?.distance ?? 0,
    totalElevM: overall?.elev ?? 0,
    sportDistanceM,
    sportElevM,
    longestRunM,
    longestRideM,
    longestSportM,
    streak,
    photos: photoAgg?.count ?? 0,
    territories: territoryAgg?.count ?? 0,
    kudosReceived: kudosAgg?.count ?? 0,
    segmentCrs: crAgg?.count ?? 0,
    challengesCompleted: challengeAgg?.count ?? 0,
    earlyActivity,
    nightActivity,
    weekendActivities,
  };
}

function metricValue(metric: string, ctx: Context, seed: AchievementSeed): number {
  switch (metric) {
    case "activities":
      return ctx.activities;
    case "longest_run_m":
      return ctx.longestRunM;
    case "longest_ride_m":
      return ctx.longestRideM;
    case "sport_distance_m":
      return seed.sport ? (ctx.sportDistanceM[seed.sport] ?? 0) : ctx.totalDistanceM;
    case "sport_elev_m":
      return seed.sport ? (ctx.sportElevM[seed.sport] ?? 0) : ctx.totalElevM;
    case "longest_sport_m":
      return seed.sport ? (ctx.longestSportM[seed.sport] ?? 0) : 0;
    case "elev_total_m":
      return ctx.totalElevM;
    case "streak":
      return ctx.streak;
    case "photos":
      return ctx.photos;
    case "territories":
      return ctx.territories;
    case "kudos_received":
      return ctx.kudosReceived;
    case "segment_crs":
      return ctx.segmentCrs;
    case "challenges_completed":
      return ctx.challengesCompleted;
    case "early_activity":
      return ctx.earlyActivity;
    case "night_activity":
      return ctx.nightActivity;
    case "weekend_activities":
      return ctx.weekendActivities;
    default:
      return 0;
  }
}

export type ActivitySummary = {
  xpEarned: number;
  coinsEarned: number;
  totalXp: number;
  totalCoins: number;
  level: { level: number; title: string; pct: number };
  newAchievements: { key: string; name: string; icon: string; description: string; xpReward: number }[];
  territoriesClaimed: { name: string; emoji: string; distanceInsideM: number }[];
  records: { label: string; value: string; unit: string; formatted: string }[];
  challenges: { name: string; progress: number; target: number; unit: string; completed: boolean }[];
  segmentEfforts: { segment: string; elapsedSec: number; cr: boolean }[];
};

/** Roda toda a gamificação após publicar uma atividade. */
export async function processActivity(user: User, activity: Activity, opts: { photosCount?: number; isNew?: boolean } = {}): Promise<ActivitySummary> {
  await ensureAchievementCatalog();
  const summary: ActivitySummary = {
    xpEarned: 0,
    coinsEarned: 0,
    totalXp: user.xp,
    totalCoins: user.coins,
    level: { level: 1, title: "Nômade", pct: 0 },
    newAchievements: [],
    territoriesClaimed: [],
    records: [],
    challenges: [],
    segmentEfforts: [],
  };

  if (opts.isNew) {
    const gained = xpForActivity(activity);
    summary.xpEarned += gained;
    summary.coinsEarned += coinsForXp(gained);
  }

  // Territórios: distância real percorrida dentro do círculo do território.
  const track = (activity.track ?? []) as TrackPoint[];
  if (track.length > 3) {
    const allTerritories = await db.select().from(territories);
    for (const t of allTerritories) {
      const inside = distanceInsideCircle(track, t.centerLat, t.centerLng, t.radiusM);
      if (inside >= 250) {
        const existing = await db
          .select({ id: territoryClaims.id })
          .from(territoryClaims)
          .where(and(eq(territoryClaims.territoryId, t.id), eq(territoryClaims.userId, user.id)))
          .limit(1);
        if (existing.length === 0) {
          await db.insert(territoryClaims).values({
            territoryId: t.id,
            userId: user.id,
            activityId: activity.id,
            distanceInsideM: inside,
          });
          summary.xpEarned += t.xpReward;
          summary.coinsEarned += t.coinsReward;
          summary.territoriesClaimed.push({ name: t.name, emoji: t.emoji, distanceInsideM: inside });
        } else {
          await db
            .update(territoryClaims)
            .set({ distanceInsideM: inside, activityId: activity.id })
            .where(eq(territoryClaims.id, existing[0].id));
        }
      }
    }
  }

  // Segmentos: esforços reais compatíveis com largada/chegada do segmento.
  const cat = getSport(activity.sport).category;
  const segRows = await db.select().from(segments);
  for (const seg of segRows) {
    if (getSport(seg.sport).category !== cat) continue;
    const elapsed = matchSegment(track, seg);
    if (elapsed === null) continue;
    const distanceKm = seg.distanceM / 1000;
    await db
      .insert(segmentEfforts)
      .values({
        segmentId: seg.id,
        activityId: activity.id,
        userId: user.id,
        elapsedSec: elapsed,
        avgSpeedKmh: distanceKm / (elapsed / 3600),
      })
      .onConflictDoNothing();

    const leaders = await db
      .select({ userId: segmentEfforts.userId, elapsedSec: segmentEfforts.elapsedSec })
      .from(segmentEfforts)
      .where(eq(segmentEfforts.segmentId, seg.id))
      .orderBy(segmentEfforts.elapsedSec)
      .limit(1);
    const isCr = leaders.length > 0 && leaders[0].userId === user.id && leaders[0].elapsedSec === elapsed;
    summary.segmentEfforts.push({ segment: seg.name, elapsedSec: elapsed, cr: isCr });
    if (isCr) {
      summary.xpEarned += 150;
      summary.coinsEarned += 15;
    }
  }

  // Recordes pessoais por modalidade.
  const prs = evaluateRecords(activity);
  for (const pr of prs) {
    const existing = await db
      .select()
      .from(personalRecords)
      .where(and(eq(personalRecords.userId, user.id), eq(personalRecords.sport, pr.sport), eq(personalRecords.category, pr.category)))
      .limit(1);
    const better =
      existing.length === 0 ||
      (pr.direction === "max" ? pr.value > existing[0].value : pr.value < existing[0].value);
    if (better) {
      if (existing.length === 0) {
        await db.insert(personalRecords).values({
          userId: user.id,
          sport: pr.sport,
          category: pr.category,
          label: pr.label,
          value: pr.value,
          unit: pr.unit,
          activityId: activity.id,
        });
      } else {
        await db
          .update(personalRecords)
          .set({ value: pr.value, activityId: activity.id, setAt: new Date() })
          .where(eq(personalRecords.id, existing[0].id));
      }
      summary.records.push({ label: pr.label, value: pr.formatted, unit: pr.unit, formatted: pr.formatted });
      summary.xpEarned += 40;
      summary.coinsEarned += 4;
    }
  }

  // Desafios em que o usuário participa.
  const myChallenges = await db
    .select({ challenge: challenges, participant: challengeParticipants })
    .from(challengeParticipants)
    .innerJoin(challenges, eq(challenges.id, challengeParticipants.challengeId))
    .where(eq(challengeParticipants.userId, user.id));

  for (const row of myChallenges) {
    const c = row.challenge;
    if (c.sport && c.sport !== activity.sport) continue;
    const start = new Date(c.startAt);
    const end = new Date(c.endAt);
    if (activity.startedAt < start || activity.startedAt > end) continue;
    let delta = 0;
    if (c.metric === "distance_m") delta = activity.distanceM;
    else if (c.metric === "elev_gain_m") delta = activity.elevGainM;
    else if (c.metric === "moving_sec") delta = activity.movingSec;
    else if (c.metric === "activities_count") delta = 1;
    const progress = row.participant.progress + delta;
    const completed = progress >= c.target;
    await db
      .update(challengeParticipants)
      .set({ progress, completedAt: completed ? (row.participant.completedAt ?? new Date()) : row.participant.completedAt })
      .where(eq(challengeParticipants.id, row.participant.id));
    summary.challenges.push({
      name: c.name,
      progress,
      target: c.target,
      unit: c.unit,
      completed: completed && !row.participant.completedAt,
    });
    if (completed && !row.participant.completedAt) {
      summary.xpEarned += 250;
      summary.coinsEarned += 30;
    }
  }

  // Conquistas.
  const ctx = await buildContext(user.id, activity);
  if (opts.photosCount) ctx.photos += opts.photosCount;
  if (summary.territoriesClaimed.length > 0) ctx.territories += summary.territoriesClaimed.length;
  const catalog = await db.select().from(achievements);
  const unlockedKeys = new Set(
    (
      await db
        .select({ key: userAchievements.achievementKey })
        .from(userAchievements)
        .where(eq(userAchievements.userId, user.id))
    ).map((r) => r.key),
  );
  for (const seed of catalog) {
    if (unlockedKeys.has(seed.key)) continue;
    const value = metricValue(seed.metric, ctx, seed);
    if (value >= seed.threshold) {
      await db.insert(userAchievements).values({
        userId: user.id,
        achievementKey: seed.key,
        progress: seed.threshold,
        activityId: activity.id,
      });
      summary.xpEarned += seed.xpReward;
      summary.coinsEarned += seed.coinsReward;
      summary.newAchievements.push({
        key: seed.key,
        name: seed.name,
        icon: seed.icon,
        description: seed.description,
        xpReward: seed.xpReward,
      });
    }
  }

  if (summary.xpEarned !== 0 || summary.coinsEarned !== 0) {
    const [updated] = await db
      .update(users)
      .set({
        xp: sql`${users.xp} + ${summary.xpEarned}`,
        coins: sql`greatest(0, ${users.coins} + ${summary.coinsEarned})`,
      })
      .where(eq(users.id, user.id))
      .returning({ xp: users.xp, coins: users.coins });
    summary.totalXp = updated?.xp ?? user.xp;
    summary.totalCoins = updated?.coins ?? user.coins;
  } else {
    summary.totalXp = user.xp;
    summary.totalCoins = user.coins;
  }
  const lvl = levelFromXp(summary.totalXp);
  summary.level = { level: lvl.level, title: lvl.title, pct: lvl.pct };
  return summary;
}

type PrResult = {
  sport: string;
  category: string;
  label: string;
  value: number;
  unit: string;
  direction: "max" | "min";
  formatted: string;
};

function bestWindow(splits: { km: number; distanceM: number; seconds: number }[], meters: number): number | null {
  if (splits.length === 0) return null;
  const prefix: number[] = [0];
  for (const s of splits) prefix.push(prefix[prefix.length - 1] + s.seconds);
  const perKm = 1000;
  const windows = Math.floor(meters / perKm);
  if (windows < 1 || splits.length < windows) return null;
  let best: number | null = null;
  for (let i = 0; i + windows <= splits.length; i += 1) {
    const elapsed = prefix[i + windows] - prefix[i];
    const covered = splits.slice(i, i + windows).reduce((sum, s) => sum + s.distanceM, 0);
    if (covered < meters * 0.95) continue;
    if (best === null || elapsed < best) best = elapsed;
  }
  return best;
}

/** Recordes pessoais calculados com dados reais da atividade. */
export function evaluateRecords(activity: Activity): PrResult[] {
  const sport = getSport(activity.sport);
  const out: PrResult[] = [];
  const splits = computeSplits((activity.track ?? []) as TrackPoint[]);
  const km = activity.distanceM / 1000;

  out.push({
    sport: activity.sport,
    category: "longest_distance_m",
    label: `Maior distância · ${sport.label}`,
    value: Math.round(activity.distanceM),
    unit: "m",
    direction: "max",
    formatted: `${km.toFixed(2)} km`,
  });

  if (sport.category === "ride") {
    if (activity.movingSec > 0 && km >= 5) {
      out.push({
        sport: activity.sport,
        category: "best_avg_speed_kmh",
        label: "Melhor velocidade média",
        value: Number((km / (activity.movingSec / 3600)).toFixed(2)),
        unit: "km/h",
        direction: "max",
        formatted: `${(km / (activity.movingSec / 3600)).toFixed(1)} km/h`,
      });
    }
    if (activity.maxSpeedKmh > 0) {
      out.push({
        sport: activity.sport,
        category: "top_speed_kmh",
        label: "Velocidade máxima",
        value: Number(activity.maxSpeedKmh.toFixed(2)),
        unit: "km/h",
        direction: "max",
        formatted: `${activity.maxSpeedKmh.toFixed(1)} km/h`,
      });
    }
    if (activity.elevGainM >= 100) {
      out.push({
        sport: activity.sport,
        category: "biggest_climb_m",
        label: "Maior ganho de elevação",
        value: Math.round(activity.elevGainM),
        unit: "m",
        direction: "max",
        formatted: `${Math.round(activity.elevGainM)} m`,
      });
    }
    const t20 = bestWindow(splits, 20000);
    if (t20) {
      out.push({
        sport: activity.sport,
        category: "fastest_20k_sec",
        label: "20 km mais rápidos",
        value: t20,
        unit: "s",
        direction: "min",
        formatted: `${Math.floor(t20 / 3600)}h${String(Math.floor((t20 % 3600) / 60)).padStart(2, "0")}`,
      });
    }
  }

  if (sport.category === "run") {
    for (const target of [1000, 5000, 10000]) {
      const t = bestWindow(splits, target);
      if (t) {
        out.push({
          sport: activity.sport,
          category: `fastest_${target / 1000}k_sec`,
          label: `${target / 1000} km mais rápidos`,
          value: t,
          unit: "s",
          direction: "min",
          formatted: `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`,
        });
      }
    }
    if (activity.elevGainM >= 100) {
      out.push({
        sport: activity.sport,
        category: "biggest_climb_m",
        label: "Maior ganho de elevação",
        value: Math.round(activity.elevGainM),
        unit: "m",
        direction: "max",
        formatted: `${Math.round(activity.elevGainM)} m`,
      });
    }
  }

  return out;
}

/** Pontos de interesse: territórios próximos de uma coordenada. */
export function isInside(lat: number, lng: number, centerLat: number, centerLng: number, radiusM: number): boolean {
  return haversine(lat, lng, centerLat, centerLng) <= radiusM;
}

export async function achievementsForUser(userId: number) {
  const catalog = await db.select().from(achievements);
  const mine = await db.select().from(userAchievements).where(eq(userAchievements.userId, userId));
  const mineByKey = new Map(mine.map((m) => [m.achievementKey, m]));
  return catalog.map((c) => {
    const unlocked = mineByKey.get(c.key);
    return {
      ...c,
      unlockedAt: unlocked?.unlockedAt ?? null,
      progress: unlocked?.progress ?? 0,
    };
  });
}

export async function challengeProgressFor(userId: number, challengeIds: number[]) {
  if (challengeIds.length === 0) return new Map<number, { progress: number; completedAt: Date | null }>();
  const rows = await db
    .select()
    .from(challengeParticipants)
    .where(and(eq(challengeParticipants.userId, userId), inArray(challengeParticipants.challengeId, challengeIds)));
  return new Map(rows.map((r) => [r.challengeId, { progress: r.progress, completedAt: r.completedAt }]));
}
