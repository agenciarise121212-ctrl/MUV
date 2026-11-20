import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import {
  followingCount,
  getUserByUsername,
  isFollowing,
  personalRecordsFor,
  photoGallery,
  territoriesForUser,
  userActivities,
  userStats,
  weeklyVolume,
} from "@/lib/data";
import { achievementsForUser } from "@/lib/gamification";

export const dynamic = "force-dynamic";

export default async function AthletePage({ params }: { params: Promise<{ username: string }> }) {
  const viewer = await requireUser();
  const { username } = await params;
  const user = await getUserByUsername(username);
  if (!user) notFound();

  const isSelf = user.id === viewer.id;
  const [stats, weekly, photos, achievements, activities, prs, territories, social, following] = await Promise.all([
    userStats(user.id),
    weeklyVolume(user.id, 8),
    photoGallery(user.id, 48),
    achievementsForUser(user.id),
    userActivities(user.id, viewer.id, { limit: 12 }),
    personalRecordsFor(user.id),
    territoriesForUser(user.id),
    followingCount(user.id),
    isFollowing(viewer.id, user.id),
  ]);

  return (
    <AppShell user={viewer} title={user.name} backHref="/app">
      <ProfileView
        user={user}
        viewer={viewer}
        stats={stats}
        weekly={weekly}
        photos={photos.map((p) => ({ id: p.id, caption: p.caption }))}
        achievements={achievements.map((a) => ({
          key: a.key,
          name: a.name,
          icon: a.icon,
          description: a.description,
          tier: a.tier,
          xpReward: a.xpReward,
          unlockedAt: a.unlockedAt ? new Date(a.unlockedAt) : null,
          progress: a.progress,
          threshold: a.threshold,
        }))}
        activities={activities.filter((a) => a.user.id === user.id)}
        prs={prs.map((p) => ({ id: p.id, sport: p.sport, label: p.label, value: p.value, unit: p.unit }))}
        territoriesOwned={territories.filter((t) => t.claimed).length}
        social={social}
        isSelf={isSelf}
        following={following}
      />
    </AppShell>
  );
}
