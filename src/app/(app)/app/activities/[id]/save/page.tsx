import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { activities } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { SaveFlow } from "@/components/SaveFlow";
import { activityPhotoIds } from "@/lib/data";
import { formatDistance, formatDuration } from "@/lib/format";
import { getSport } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function SaveActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const rows = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.userId, user.id)))
    .limit(1);
  const activity = rows[0];
  if (!activity) notFound();

  const photos = await activityPhotoIds(id);
  const sport = getSport(activity.sport);

  return (
    <AppShell user={user} title={`${sport.emoji} Finalizar publicação`} backHref={`/app/activities/${activity.id}`} hideNav>
      <SaveFlow
        activity={{
          id: activity.id,
          sport: activity.sport,
          name: activity.name,
          notes: activity.notes,
          location: activity.location,
          visibility: activity.visibility,
          distanceM: activity.distanceM,
          movingSec: activity.movingSec,
          elapsedSec: activity.elapsedSec,
          elevGainM: activity.elevGainM,
          calories: activity.calories,
          avgSpeedKmh: activity.avgSpeedKmh,
          paceSecPerKm: activity.paceSecPerKm,
          gpsPoints: activity.gpsPoints,
          isIndoor: activity.isIndoor,
        }}
        initialPhotos={photos}
        alreadyPublished={activity.status === "published"}
      />
      <p className="mt-2 text-center text-[11px] text-muted">
        Gravado em {formatDuration(activity.elapsedSec, true)} · {formatDistance(activity.distanceM)} ·{" "}
        {activity.gpsPoints} pontos GPS reais
      </p>
    </AppShell>
  );
}
