import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { PhotoGrid } from "@/components/Lightbox";
import { RouteDiary, type GeoPhoto } from "@/components/RouteDiary";
import { Card, Pill } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { IconSat, SportIcon } from "@/components/icons";
import { ClaimTerritoriesButton, CommentComposer, CommentList, DeleteActivityButton } from "@/components/actions";
import {
  activityComments,
  activityKudosList,
  activityPhotoIds,
  activityRecords,
  activitySegmentEfforts,
  getActivity,
} from "@/lib/data";
import { computeSplits } from "@/lib/geo";
import { formatDistance, formatDuration, formatNumber, formatPace, formatSpeed, formatDateTime } from "@/lib/format";
import { getSport, isRideSport } from "@/lib/sports";

export const dynamic = "force-dynamic";

export default async function ActivityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const activity = await getActivity(id);
  if (!activity) notFound();
  if (activity.visibility === "private" && activity.userId !== user.id) notFound();

  const sport = getSport(activity.sport);
  const isRide = isRideSport(activity.sport);
  const track = (activity.track ?? []) as { lat: number; lng: number; t: number; alt?: number }[];
  const [photos, kudosList, commentList, efforts, records] = await Promise.all([
    activityPhotoIds(id),
    activityKudosList(id),
    activityComments(id),
    activitySegmentEfforts(id),
    activityRecords(id),
  ]);
  const splits = computeSplits(track);
  const lineCoords = track.map((p) => [p.lng, p.lat] as [number, number]);
  const startPin = lineCoords[0];
  const endPin = lineCoords[lineCoords.length - 1];
  const isOwner = activity.userId === user.id;
  // Fotos cravadas no trajeto (com coordenadas do instante da captura).
  const geoPhotos: GeoPhoto[] = photos
    .filter((ph) => ph.latitude !== null && ph.longitude !== null)
    .map((ph) => ({
      id: ph.id,
      latitude: ph.latitude,
      longitude: ph.longitude,
      kmMark: ph.kmMark,
      caption: ph.caption,
      elapsedAtMs: ph.elapsedAtMs,
    }));

  return (
    <AppShell user={user} title={sport.label} backHref="/app/activities">
      <section className="border border-line bg-graphite">
        <div className="flex items-start justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SportIcon sport={activity.sport} className="size-5 text-lime" />
              <p className="text-[10px] font-display font-bold uppercase tracking-[0.16em] text-muted">{sport.label}</p>
            </div>
            <h1 className="display-2 mt-2 text-[19px] normal-case">{activity.name}</h1>
            <p className="tabular mt-1.5 text-[12px] text-muted">
              {formatDateTime(activity.startedAt)}
              {activity.location ? ` · ${activity.location}` : ""}
            </p>
            <Link href={`/app/athletes/${activity.authorUsername}`} className="mt-3 inline-flex items-center gap-2">
              <Avatar name={activity.authorName} color={activity.authorAvatar} size={26} />
              <span className="text-[12px] font-semibold">{activity.authorName}</span>
            </Link>
          </div>
          <div className="flex flex-col items-end gap-2.5">
            <Pill tone={activity.status === "draft" ? "flame" : "lime"}>
              {activity.status === "draft" ? "Rascunho" : activity.visibility === "private" ? "Privada" : "Publicada"}
            </Pill>
            {isOwner ? <DeleteActivityButton activityId={activity.id} /> : null}
          </div>
        </div>
      </section>

      <div className="mt-3">
        {lineCoords.length > 1 ? (
          <RouteDiary
            photos={geoPhotos}
            track={track.map((p) => ({ lat: p.lat, lng: p.lng, t: p.t }))}
            sportColor={sport.color}
            sportLabel={sport.label}
            city={activity.location}
            athleteName={activity.authorName}
            athleteColor={activity.authorAvatar}
            totalDistanceM={activity.distanceM}
            startedAt={new Date(activity.startedAt).toISOString()}
          />
        ) : (
          <div className="grid h-40 place-items-center border border-line bg-graphite-2 text-[13px] text-muted">
            {activity.isIndoor ? "Atividade indoor · sem trajeto GPS" : "Sem trajeto GPS registrado"}
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-px border border-line bg-line">
        <Metric label="Distância" value={formatDistance(activity.distanceM)} accent={sport.color} big />
        <Metric label="Tempo em movimento" value={formatDuration(activity.movingSec, true)} big />
        <Metric label="Tempo total" value={formatDuration(activity.elapsedSec, true)} />
        {isRide ? (
          <>
            <Metric label="Velocidade média" value={`${formatSpeed(activity.avgSpeedKmh)} km/h`} />
            <Metric label="Velocidade máxima" value={`${formatSpeed(activity.maxSpeedKmh)} km/h`} />
          </>
        ) : (
          <>
            <Metric label="Pace médio" value={`${formatPace(activity.paceSecPerKm)} /km`} />
            <Metric label="Calorias" value={`${formatNumber(activity.calories)} kcal`} />
          </>
        )}
        <Metric label="Ganho de elevação" value={`${formatNumber(activity.elevGainM)} m`} accent="#d5ff45" />
        <Metric label="Altitude máxima" value={`${formatNumber(Math.max(...track.map((p) => p.alt ?? 0), 0))} m`} />
        <Metric label="Pontos GPS" value={formatNumber(activity.gpsPoints)} />
        <Metric label="Precisão média" value={`±${Math.round(activity.avgAccuracyM)} m`} />
        <Metric label="Pausas" value={`${activity.pauses} manuais · ${activity.autoPauses} auto`} />
        <Metric label="Equipamento" value={activity.device ?? "GPS do dispositivo"} />
      </div>

      {photos.length > 0 ? (
        <section className="mt-6">
          <h2 className="display-2 mb-3 text-[15px]">
            {geoPhotos.length > 0 ? "Outras fotos" : "Fotos da atividade"} ({photos.length})
          </h2>
          <PhotoGrid photos={photos} sport={sport.key} />
          {photos.some((p) => p.caption) ? (
            <ul className="mt-2 space-y-1">
              {photos
                .filter((p) => p.caption)
                .map((p) => (
                  <li key={p.id} className="text-[12px] text-muted">
                    📸 {p.caption}
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {splits.length > 0 ? (
        <section className="mt-6">
          <h2 className="display-2 mb-3 text-[15px]">Splits por quilômetro</h2>
          <Card className="divide-y divide-line">
            {splits.map((s) => (
              <div key={s.km} className="flex items-center gap-3 px-4 py-2.5">
                <span className="tabular w-10 text-[12px] font-bold text-muted">km {s.km}</span>
                <span className="tabular flex-1 text-[14px] font-semibold">{formatPace(s.paceSecPerKm)} /km</span>
                <span className="tabular text-[12px] text-muted">{formatDuration(s.seconds)}</span>
                <span className="tabular text-[12px] text-sky">+{Math.round(s.elevGainM)} m</span>
              </div>
            ))}
          </Card>
        </section>
      ) : null}

      {efforts.length > 0 ? (
        <section className="mt-6">
          <h2 className="display-2 mb-3 text-[15px]">Segmentos enfrentados</h2>
          <div className="space-y-2">
            {efforts.map((e) => (
              <Link key={e.id} href={`/app/segments/${e.segmentId}`} className="surface hover-lift block p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[14px] font-semibold">{e.segmentName}</p>
                  <Pill tone={e.rank === 1 ? "gold" : "muted"}>{e.rank}º / {e.total}</Pill>
                </div>
                <p className="tabular mt-1 text-[12px] text-muted">
                  {formatDistance(e.distanceM)} · {formatDuration(e.elapsedSec)} ·{" "}
                  {formatSpeed(e.avgSpeedKmh)} km/h
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {records.length > 0 ? (
        <section className="mt-6">
          <h2 className="display-2 mb-3 text-[15px]">Recordes marcados neste treino</h2>
          <div className="space-y-2">
            {records.map((r) => (
              <Card key={r.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-[13px] font-semibold">{r.label}</span>
                <span className="tabular text-sm font-black text-lime">{r.unit === "m" ? formatDistance(r.value) : `${r.value} ${r.unit}`}</span>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="display-2 mb-3 text-[15px]">Kudos e comentários</h2>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {kudosList.slice(0, 8).map((k) => (
                <Avatar key={k.userId} name={k.name} color={k.avatarColor} size={26} href={`/app/athletes/${k.username}`} />
              ))}
            </div>
            <span className="metric text-[12px] font-bold text-muted">{kudosList.length}</span>
          </div>
          <div id="comentarios" className="mt-4">
            <CommentList
              comments={commentList.map((c) => ({
                id: c.id,
                body: c.body,
                createdAt: new Date(c.createdAt).toISOString(),
                userId: c.userId,
                name: c.name,
                username: c.username,
                avatarColor: c.avatarColor,
              }))}
            />
          </div>
          <div className="mt-4">
            <CommentComposer activityId={activity.id} />
          </div>
        </Card>
      </section>

      {isOwner ? (
        <section className="mt-6">
          <Card className="p-4">
            <p className="display-2 text-[14px]">Territórios</p>
            <p className="mt-1 text-[12px] text-muted">
              Reavalie seus últimos trajetos reais para dominar territórios próximos e ganhar XP.
            </p>
            <div className="mt-3">
              <ClaimTerritoriesButton />
            </div>
          </Card>
        </section>
      ) : null}

      {activity.status === "draft" ? (
        <Link
          href={`/app/activities/${activity.id}/save`}
          className="mt-4 block rounded-2xl bg-lime py-3.5 text-center text-base font-black text-ink"
        >
          Concluir publicação e adicionar fotos
        </Link>
      ) : null}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted">
        <IconSat className="size-3.5" /> Dados coletados pelo GPS real do dispositivo
      </p>
    </AppShell>
  );
}

function Metric({ label, value, accent, big }: { label: string; value: string; accent?: string; big?: boolean }) {
  return (
    <div className="bg-graphite px-3.5 py-3">
      <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`metric mt-1 font-bold ${big ? "text-[26px] leading-none" : "text-[16px]"}`} style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </div>
  );
}
