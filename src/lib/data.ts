import { and, desc, eq, gte, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activities,
  activityPhotos,
  challengeParticipants,
  challenges,
  comments,
  follows,
  kudos,
  personalRecords,
  rewardRedemptions,
  rewards,
  segmentEfforts,
  segments,
  territoryClaims,
  territories,
  users,
  type TrackPoint,
} from "@/db/schema";
import { weekStart } from "@/lib/geo";

export type MiniPoint = { lat: number; lng: number };

export function decimate(track: TrackPoint[], max = 260): MiniPoint[] {
  if (track.length <= max) return track.map((p) => ({ lat: p.lat, lng: p.lng }));
  const step = Math.ceil(track.length / max);
  const out: MiniPoint[] = [];
  for (let i = 0; i < track.length; i += step) out.push({ lat: track[i].lat, lng: track[i].lng });
  const last = track[track.length - 1];
  out.push({ lat: last.lat, lng: last.lng });
  return out;
}

const activityColumns = {
  id: activities.id,
  userId: activities.userId,
  sport: activities.sport,
  subtype: activities.subtype,
  name: activities.name,
  notes: activities.notes,
  location: activities.location,
  startedAt: activities.startedAt,
  elapsedSec: activities.elapsedSec,
  movingSec: activities.movingSec,
  distanceM: activities.distanceM,
  avgSpeedKmh: activities.avgSpeedKmh,
  maxSpeedKmh: activities.maxSpeedKmh,
  paceSecPerKm: activities.paceSecPerKm,
  elevGainM: activities.elevGainM,
  elevLossM: activities.elevLossM,
  calories: activities.calories,
  isIndoor: activities.isIndoor,
  commute: activities.commute,
  visibility: activities.visibility,
  status: activities.status,
  gpsPoints: activities.gpsPoints,
  avgAccuracyM: activities.avgAccuracyM,
  maxElevM: activities.maxElevM,
  pauses: activities.pauses,
  autoPauses: activities.autoPauses,
  device: activities.device,
  track: activities.track,
  authorName: users.name,
  authorUsername: users.username,
  authorAvatar: users.avatarColor,
};

export type FeedItem = {
  id: number;
  sport: string;
  name: string;
  notes: string | null;
  location: string | null;
  startedAt: string;
  elapsedSec: number;
  movingSec: number;
  distanceM: number;
  avgSpeedKmh: number;
  paceSecPerKm: number;
  elevGainM: number;
  calories: number;
  isIndoor: boolean;
  gpsPoints: number;
  avgAccuracyM: number;
  user: { id: number; name: string; username: string; avatarColor: string };
  kudosCount: number;
  commentCount: number;
  myKudos: boolean;
  photoIds: number[];
  photoCount: number;
  route: MiniPoint[];
};

export async function feedForUser(currentUserId: number, scope: "following" | "me" | "global", limit = 20): Promise<FeedItem[]> {
  let where = and(eq(activities.status, "published"), eq(activities.blockedFromRanking, false), eq(activities.visibility, "public"));
  if (scope === "me") {
    where = and(eq(activities.userId, currentUserId), eq(activities.status, "published"), eq(activities.blockedFromRanking, false));
  } else if (scope === "following") {
    const following = await db
      .select({ id: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, currentUserId));
    const ids = following.map((f) => f.id).concat(currentUserId);
    where = and(eq(activities.status, "published"), eq(activities.blockedFromRanking, false), inArray(activities.userId, ids));
  }
  return queryFeed(where, currentUserId, limit);
}

export async function userActivities(userId: number, currentUserId: number, opts: { sport?: string; category?: string; limit?: number } = {}): Promise<FeedItem[]> {
  const conditions = [eq(activities.userId, userId), eq(activities.status, "published"), eq(activities.blockedFromRanking, false)];
  if (opts.sport) conditions.push(eq(activities.sport, opts.sport));
  const rows = await db
    .select(activityColumns)
    .from(activities)
    .innerJoin(users, eq(users.id, activities.userId))
    .where(and(...conditions))
    .orderBy(desc(activities.startedAt))
    .limit(opts.limit ?? 50);
  const filtered = opts.category ? rows.filter((r) => categoryOf(r.sport) === opts.category) : rows;
  return decorateFeed(filtered, currentUserId);
}

function categoryOf(sport: string): string {
  if (sport.startsWith("ride") || sport === "mtb" || sport === "gravel" || sport === "ebike") return "ride";
  if (sport.startsWith("walk") || sport === "hike") return "walk";
  if (sport.startsWith("run")) return "run";
  return "other";
}

async function queryFeed(where: ReturnType<typeof and> | undefined, currentUserId: number, limit: number): Promise<FeedItem[]> {
  const rows = await db
    .select(activityColumns)
    .from(activities)
    .innerJoin(users, eq(users.id, activities.userId))
    .where(where)
    .orderBy(desc(activities.startedAt))
    .limit(limit);
  return decorateFeed(rows, currentUserId);
}

export type FeedRow = {
  id: number;
  userId: number;
  sport: string;
  subtype: string | null;
  name: string;
  notes: string | null;
  location: string | null;
  startedAt: Date;
  elapsedSec: number;
  movingSec: number;
  distanceM: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  paceSecPerKm: number;
  elevGainM: number;
  calories: number;
  isIndoor: boolean;
  visibility: string;
  status: string;
  gpsPoints: number;
  avgAccuracyM: number;
  track: TrackPoint[];
  authorName: string;
  authorUsername: string;
  authorAvatar: string;
};

export async function decorateFeed(rows: FeedRow[], currentUserId: number): Promise<FeedItem[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const kudosRows = await db
    .select({ activityId: kudos.activityId, userId: kudos.userId })
    .from(kudos)
    .where(inArray(kudos.activityId, ids));
  const commentRows = await db
    .select({ activityId: comments.activityId })
    .from(comments)
    .where(inArray(comments.activityId, ids));
  const photoRows = await db
    .select({ id: activityPhotos.id, activityId: activityPhotos.activityId, position: activityPhotos.position })
    .from(activityPhotos)
    .where(inArray(activityPhotos.activityId, ids))
    .orderBy(activityPhotos.position);

  return rows.map((row) => {
    const rowKudos = kudosRows.filter((k) => k.activityId === row.id);
    return {
      id: row.id,
      sport: row.sport,
      name: row.name,
      notes: row.notes,
      location: row.location,
      startedAt: new Date(row.startedAt).toISOString(),
      elapsedSec: row.elapsedSec,
      movingSec: row.movingSec,
      distanceM: row.distanceM,
      avgSpeedKmh: row.avgSpeedKmh,
      paceSecPerKm: row.paceSecPerKm,
      elevGainM: row.elevGainM,
      calories: row.calories,
      isIndoor: row.isIndoor,
      gpsPoints: row.gpsPoints,
      avgAccuracyM: row.avgAccuracyM,
      user: { id: row.userId, name: row.authorName, username: row.authorUsername, avatarColor: row.authorAvatar },
      kudosCount: rowKudos.length,
      commentCount: commentRows.filter((c) => c.activityId === row.id).length,
      myKudos: rowKudos.some((k) => k.userId === currentUserId),
      photoIds: photoRows.filter((p) => p.activityId === row.id).map((p) => p.id),
      photoCount: photoRows.filter((p) => p.activityId === row.id).length,
      route: decimate((row.track ?? []) as TrackPoint[]),
    };
  });
}

export async function feedForActivities(rows: (typeof activities.$inferSelect & { authorName: string; authorUsername: string; authorAvatar: string })[], currentUserId: number) {
  return decorateFeed(rows, currentUserId);
}

export async function getActivity(id: number) {
  const rows = await db
    .select(activityColumns)
    .from(activities)
    .innerJoin(users, eq(users.id, activities.userId))
    .where(eq(activities.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function activityKudosList(activityId: number) {
  return db
    .select({ userId: users.id, name: users.name, username: users.username, avatarColor: users.avatarColor })
    .from(kudos)
    .innerJoin(users, eq(users.id, kudos.userId))
    .where(eq(kudos.activityId, activityId))
    .orderBy(desc(kudos.createdAt));
}

export async function activityComments(activityId: number) {
  return db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: users.id,
      name: users.name,
      username: users.username,
      avatarColor: users.avatarColor,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(eq(comments.activityId, activityId))
    .orderBy(comments.createdAt);
}

export async function activityPhotoIds(activityId: number) {
  return db
    .select({
      id: activityPhotos.id,
      caption: activityPhotos.caption,
      position: activityPhotos.position,
      latitude: activityPhotos.latitude,
      longitude: activityPhotos.longitude,
      kmMark: activityPhotos.kmMark,
      altitudeM: activityPhotos.altitudeM,
      elapsedAtMs: activityPhotos.elapsedAtMs,
    })
    .from(activityPhotos)
    .where(eq(activityPhotos.activityId, activityId))
    .orderBy(activityPhotos.position);
}

export async function activitySegmentEfforts(activityId: number) {
  return db
    .select({
      id: segmentEfforts.id,
      segmentId: segments.id,
      segmentName: segments.name,
      distanceM: segments.distanceM,
      elapsedSec: segmentEfforts.elapsedSec,
      avgSpeedKmh: segmentEfforts.avgSpeedKmh,
      rank: sql<number>`(
        select count(*) + 1 from segment_efforts e2
        where e2.segment_id = segment_efforts.segment_id
          and e2.elapsed_sec < segment_efforts.elapsed_sec
      )::int`,
      total: sql<number>`(
        select count(*) from segment_efforts e3 where e3.segment_id = segment_efforts.segment_id
      )::int`,
    })
    .from(segmentEfforts)
    .innerJoin(segments, eq(segments.id, segmentEfforts.segmentId))
    .where(eq(segmentEfforts.activityId, activityId));
}

export async function activityRecords(activityId: number) {
  return db.select().from(personalRecords).where(eq(personalRecords.activityId, activityId));
}

export async function userStats(userId: number) {
  const rows = await db
    .select({
      sport: activities.sport,
      count: sql<number>`count(*)::int`,
      distanceM: sql<number>`coalesce(sum(${activities.distanceM}), 0)::float`,
      movingSec: sql<number>`coalesce(sum(${activities.movingSec}), 0)::int`,
      elevGainM: sql<number>`coalesce(sum(${activities.elevGainM}), 0)::float`,
      calories: sql<number>`coalesce(sum(${activities.calories}), 0)::int`,
      longestM: sql<number>`coalesce(max(${activities.distanceM}), 0)::float`,
      maxSpeed: sql<number>`coalesce(max(${activities.maxSpeedKmh}), 0)::float`,
      bestPace: sql<number>`coalesce(min(nullif(${activities.paceSecPerKm}, 0)), 0)::float`,
    })
    .from(activities)
    .where(and(eq(activities.userId, userId), eq(activities.status, "published"), eq(activities.blockedFromRanking, false)))
    .groupBy(activities.sport);
  return rows;
}

export async function weeklyVolume(userId: number, weeks = 8) {
  const start = weekStart();
  start.setDate(start.getDate() - (weeks - 1) * 7);
  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${activities.startedAt} - interval '3 days') + interval '3 days', 'YYYY-MM-DD')`,
      distanceM: sql<number>`coalesce(sum(${activities.distanceM}), 0)::float`,
      movingSec: sql<number>`coalesce(sum(${activities.movingSec}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(activities)
    .where(and(eq(activities.userId, userId), gte(activities.startedAt, start)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  return rows;
}

export async function thisWeekStats(userId: number) {
  const start = weekStart();
  const [row] = await db
    .select({
      distanceM: sql<number>`coalesce(sum(${activities.distanceM}), 0)::float`,
      movingSec: sql<number>`coalesce(sum(${activities.movingSec}), 0)::int`,
      elevGainM: sql<number>`coalesce(sum(${activities.elevGainM}), 0)::float`,
      count: sql<number>`count(*)::int`,
      calories: sql<number>`coalesce(sum(${activities.calories}), 0)::int`,
    })
    .from(activities)
    .where(and(eq(activities.userId, userId), gte(activities.startedAt, start)));
  return row ?? { distanceM: 0, movingSec: 0, elevGainM: 0, count: 0, calories: 0 };
}

export async function personalRecordsFor(userId: number) {
  return db
    .select()
    .from(personalRecords)
    .where(eq(personalRecords.userId, userId))
    .orderBy(personalRecords.sport, personalRecords.category);
}

export async function challengesForUser(userId: number) {
  const rows = await db
    .select({
      challenge: challenges,
      participants: sql<number>`(select count(*)::int from challenge_participants cp where cp.challenge_id = challenges.id)`,
      leaderName: sql<string>`coalesce((select u.name from challenge_participants cp join users u on u.id = cp.user_id where cp.challenge_id = challenges.id order by cp.progress desc limit 1), '')`,
    })
    .from(challenges)
    .where(eq(challenges.isPublic, true))
    .orderBy(desc(challenges.endAt));
  const mine = await db
    .select()
    .from(challengeParticipants)
    .where(eq(challengeParticipants.userId, userId));
  const map = new Map(mine.map((m) => [m.challengeId, m]));
  return rows.map((r) => ({
    ...r.challenge,
    participants: r.participants,
    leaderName: r.leaderName,
    joined: map.has(r.challenge.id),
    myProgress: map.get(r.challenge.id)?.progress ?? 0,
    myCompletedAt: map.get(r.challenge.id)?.completedAt ?? null,
  }));
}

export async function challengeLeaderboard(challengeId: number, limit = 20) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      username: users.username,
      avatarColor: users.avatarColor,
      progress: challengeParticipants.progress,
      completedAt: challengeParticipants.completedAt,
    })
    .from(challengeParticipants)
    .innerJoin(users, eq(users.id, challengeParticipants.userId))
    .where(eq(challengeParticipants.challengeId, challengeId))
    .orderBy(desc(challengeParticipants.progress))
    .limit(limit);
}

export async function territoriesForUser(userId: number) {
  const rows = await db
    .select({
      territory: territories,
      owners: sql<number>`(select count(*)::int from territory_claims tc where tc.territory_id = territories.id)`,
      lastOwner: sql<string>`coalesce((select u.name from territory_claims tc join users u on u.id = tc.user_id where tc.territory_id = territories.id order by tc.claimed_at desc limit 1), '')`,
    })
    .from(territories)
    .orderBy(territories.name);
  const mine = await db.select().from(territoryClaims).where(eq(territoryClaims.userId, userId));
  const map = new Map(mine.map((m) => [m.territoryId, m]));
  return rows.map((r) => ({
    ...r.territory,
    owners: r.owners,
    lastOwner: r.lastOwner,
    claimed: map.has(r.territory.id),
    myDistanceInsideM: map.get(r.territory.id)?.distanceInsideM ?? 0,
    claimedAt: map.get(r.territory.id)?.claimedAt ?? null,
  }));
}

export async function rewardsForUser(userId: number) {
  const catalog = await db.select().from(rewards).orderBy(rewards.cost);
  const mine = await db
    .select()
    .from(rewardRedemptions)
    .where(eq(rewardRedemptions.userId, userId))
    .orderBy(desc(rewardRedemptions.createdAt));
  return { catalog, mine };
}

export async function segmentsWithStats(userId: number) {
  return db
    .select({
      segment: segments,
      efforts: sql<number>`(select count(*)::int from segment_efforts se where se.segment_id = segments.id)`,
      athletes: sql<number>`(select count(distinct se.user_id)::int from segment_efforts se where se.segment_id = segments.id)`,
      myBest: sql<number>`coalesce((select min(se.elapsed_sec) from segment_efforts se where se.segment_id = segments.id and se.user_id = ${userId}), 0)::int`,
      bestTime: sql<number>`coalesce((select min(se.elapsed_sec) from segment_efforts se where se.segment_id = segments.id), 0)::int`,
    })
    .from(segments)
    .orderBy(desc(segments.distanceM));
}

export async function segmentLeaderboard(segmentId: number, limit = 30) {
  return db
    .select({
      id: segmentEfforts.id,
      userId: users.id,
      name: users.name,
      username: users.username,
      avatarColor: users.avatarColor,
      elapsedSec: segmentEfforts.elapsedSec,
      avgSpeedKmh: segmentEfforts.avgSpeedKmh,
      activityId: segmentEfforts.activityId,
      createdAt: segmentEfforts.createdAt,
    })
    .from(segmentEfforts)
    .innerJoin(users, eq(users.id, segmentEfforts.userId))
    .where(eq(segmentEfforts.segmentId, segmentId))
    .orderBy(segmentEfforts.elapsedSec)
    .limit(limit);
}

export async function photoGallery(userId: number, limit = 60) {
  return db
    .select({
      id: activityPhotos.id,
      activityId: activityPhotos.activityId,
      caption: activityPhotos.caption,
      createdAt: activityPhotos.createdAt,
      sport: activities.sport,
      activityName: activities.name,
    })
    .from(activityPhotos)
    .innerJoin(activities, eq(activities.id, activityPhotos.activityId))
    .where(eq(activities.userId, userId))
    .orderBy(desc(activityPhotos.createdAt))
    .limit(limit);
}

export async function getUserByUsername(username: string) {
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0] ?? null;
}

export async function isFollowing(followerId: number, followingId: number) {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followingId, followingId)))
    .limit(1);
  return rows.length > 0;
}

export async function suggestedAthletes(userId: number, limit = 6) {
  const followingRows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, userId));
  const following = new Set(followingRows.map((f) => f.id).concat(userId));
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      avatarColor: users.avatarColor,
      city: users.city,
      activities: sql<number>`(select count(*)::int from activities a where a.user_id = users.id and a.status = 'published' and a.blocked_from_ranking = false)`,
      distanceM: sql<number>`coalesce((select sum(a.distance_m) from activities a where a.user_id = users.id and a.status = 'published' and a.blocked_from_ranking = false), 0)::float`,
    })
    .from(users)
    .orderBy(desc(users.xp))
    .limit(limit + 8);
  return rows.filter((r) => !following.has(r.id)).slice(0, limit);
}

export async function followingCount(userId: number) {
  const [f] = await db.select({ n: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followerId, userId));
  const [w] = await db.select({ n: sql<number>`count(*)::int` }).from(follows).where(eq(follows.followingId, userId));
  return { following: f?.n ?? 0, followers: w?.n ?? 0 };
}

export async function kudosLeaderboard(limit = 5) {
  return db
    .select({
      userId: activities.userId,
      name: users.name,
      username: users.username,
      avatarColor: users.avatarColor,
      kudos: sql<number>`(select count(*)::int from kudos k where k.activity_id in (select id from activities a where a.user_id = activities.user_id))`,
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.userId))
    .groupBy(activities.userId, users.name, users.username, users.avatarColor)
    .orderBy(desc(sql`3`))
    .limit(limit);
}

export async function recentPublicActivities(limit = 12) {
  return db
    .select(activityColumns)
    .from(activities)
    .innerJoin(users, eq(users.id, activities.userId))
    .where(and(eq(activities.status, "published"), eq(activities.blockedFromRanking, false), or(eq(activities.visibility, "public"), eq(activities.visibility, "followers"))))
    .orderBy(desc(activities.startedAt))
    .limit(limit);
}

export { achievementsForUser } from "@/lib/gamification";
