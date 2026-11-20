import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { ProfileView } from "@/components/ProfileView";
import {
  followingCount,
  personalRecordsFor,
  photoGallery,
  territoriesForUser,
  userActivities,
  userStats,
  weeklyVolume,
} from "@/lib/data";
import { achievementsForUser } from "@/lib/gamification";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const [stats, weekly, photos, achievements, activities, prs, territories, social] = await Promise.all([
    userStats(user.id),
    weeklyVolume(user.id, 8),
    photoGallery(user.id, 48),
    achievementsForUser(user.id),
    userActivities(user.id, user.id, { limit: 10 }),
    personalRecordsFor(user.id),
    territoriesForUser(user.id),
    followingCount(user.id),
  ]);

  return (
    <AppShell user={user} title="Meu perfil" backHref="/app">
      <ProfileView
        user={user}
        viewer={user}
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
        activities={activities}
        prs={prs.map((p) => ({ id: p.id, sport: p.sport, label: p.label, value: p.value, unit: p.unit }))}
        territoriesOwned={territories.filter((t) => t.claimed).length}
        social={social}
        isSelf
        following
      />
    </AppShell>
  );
}
