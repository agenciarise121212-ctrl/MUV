"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDistance, formatDuration, formatPace, formatSpeed, timeAgo } from "@/lib/format";
import { getSport, isRideSport } from "@/lib/sports";
import type { FeedItem } from "@/lib/data";
import { Avatar } from "@/components/Avatar";
import { SportIcon } from "@/components/icons.client";
import { Icon } from "@/components/icons.client";
import { Lightbox } from "@/components/Lightbox";

export function ActivityCard({
  item,
  showAuthor = true,
  onDelete,
}: {
  item: FeedItem;
  showAuthor?: boolean;
  onDelete?: (id: number) => void;
}) {
  const sport = getSport(item.sport);
  const isRide = isRideSport(item.sport);
  const [kudosCount, setKudosCount] = useState(item.kudosCount);
  const [kudosActive, setKudosActive] = useState(item.myKudos);
  const [commentCount, setCommentCount] = useState(item.commentCount);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState(item.photoIds.map((id) => ({ id, caption: null as string | null })));
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [shared, setShared] = useState(false);

  async function toggleKudos() {
    if (busy) return;
    setBusy(true);
    const optimistic = !kudosActive;
    setKudosActive(optimistic);
    setKudosCount((c) => c + (optimistic ? 1 : -1));
    try {
      const res = await fetch(`/api/activities/${item.id}/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "kudos" }),
      });
      const json = (await res.json()) as { ok: boolean; active?: boolean; count?: number };
      if (json.ok && typeof json.count === "number") {
        setKudosActive(Boolean(json.active));
        setKudosCount(json.count);
      }
    } catch {
      setKudosActive(!optimistic);
      setKudosCount((c) => c + (optimistic ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/app/activities/${item.id}`;
    const text = `${item.name} · ${formatDistance(item.distanceM)} · ${formatDuration(item.movingSec, true)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: item.name, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShared(true);
        window.setTimeout(() => setShared(false), 1800);
      }
    } catch {
      /* usuário cancelou */
    }
  }

  return (
    <article className="rise surface hover-lift overflow-hidden">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        {showAuthor ? <Avatar name={item.user.name} color={item.user.avatarColor} size={34} href={`/app/athletes/${item.user.username}`} /> : null}
        <div className="min-w-0 flex-1">
          {showAuthor ? (
            <Link href={`/app/athletes/${item.user.username}`} className="truncate text-[13px] font-semibold">
              {item.user.name}
            </Link>
          ) : null}
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] font-display font-bold uppercase tracking-[0.14em] text-muted">
            <SportIcon sport={item.sport} className="size-[15px]" />
            {sport.label}
            <span className="text-line">|</span>
            {timeAgo(item.startedAt)}
            {item.location ? <span className="truncate normal-case tracking-normal">· {item.location}</span> : null}
          </p>
        </div>
        {onDelete ? (
          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="grid size-8 place-items-center border border-line text-muted transition-colors hover:border-flame hover:text-flame"
            aria-label="Excluir atividade"
          >
            <Icon.trash className="size-4" />
          </button>
        ) : null}
      </header>

      <Link href={`/app/activities/${item.id}`} className="block">
        <div className="px-4 pt-4">
          <p className="display-2 text-[16px] normal-case">{item.name}</p>
        </div>
        <div className="mt-3">
          {item.route.length > 1 ? (
            <RoutePreview item={item} color={sport.color} />
          ) : (
            <div className="mx-4 grid h-[110px] place-items-center border border-line bg-graphite-2 text-[11px] text-muted">
              {item.isIndoor ? "Atividade indoor · sem GPS" : "Sem trajeto GPS registrado"}
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 divide-x divide-line border-t border-line">
          <Cell label="Distância" value={formatDistance(item.distanceM)} accent={sport.color} />
          {isRide ? (
            <Cell label="Vel. média" value={`${formatSpeed(item.avgSpeedKmh)}`} />
          ) : (
            <Cell label="Pace" value={formatPace(item.paceSecPerKm)} />
          )}
          <Cell label="Tempo" value={formatDuration(item.movingSec, true)} />
          <Cell label="Ganho" value={`${Math.round(item.elevGainM)}m`} />
        </div>
      </Link>

      {photos.length > 0 ? (
        <div className="px-4 py-3">
          <PhotoStripInline photos={photos} onOpen={setLightbox} />
        </div>
      ) : null}

      {item.notes ? <p className="px-4 pb-3 text-[13px] leading-relaxed text-muted">{item.notes}</p> : null}

      <footer className="flex items-center gap-1 border-t border-line px-2 py-1.5">
        <button
          type="button"
          onClick={toggleKudos}
          className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-display font-bold uppercase tracking-[0.1em] transition-colors ${
            kudosActive ? "text-lime" : "text-muted hover:text-paper"
          }`}
        >
          <Icon.heart className="size-4" filled={kudosActive} />
          <span className="tabular">{kudosCount}</span>
        </button>
        <Link
          href={`/app/activities/${item.id}#comentarios`}
          className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-display font-bold uppercase tracking-[0.1em] text-muted transition-colors hover:text-paper"
        >
          <Icon.comment className="size-4" />
          <span className="tabular">{commentCount}</span>
        </Link>
        <button
          type="button"
          onClick={share}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 text-[11px] font-display font-bold uppercase tracking-[0.1em] text-muted transition-colors hover:text-paper"
        >
          <Icon.share className="size-4" />
          {shared ? "copiado" : "compartilhar"}
        </button>
      </footer>

      <Lightbox photos={photos} index={lightbox} onClose={() => setLightbox(null)} onIndexChange={setLightbox} />
    </article>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="px-3 py-3">
      <p className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="metric mt-1 text-[15px] font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </div>
  );
}

function PhotoStripInline({
  photos,
  onOpen,
}: {
  photos: { id: number; caption: string | null }[];
  onOpen: (index: number) => void;
}) {
  const shown = photos.slice(0, 4);
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {shown.map((p, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.id}
          src={`/api/photos/${p.id}`}
          alt="Foto da atividade"
          onClick={(e) => {
            e.preventDefault();
            onOpen(i);
          }}
          className="h-[92px] w-[92px] shrink-0 cursor-zoom-in object-cover"
        />
      ))}
      {photos.length > shown.length ? (
        <div className="grid h-[92px] w-[92px] shrink-0 place-items-center border border-line bg-graphite-2 text-[12px] font-semibold text-muted">
          +{photos.length - shown.length}
        </div>
      ) : null}
    </div>
  );
}

function RoutePreview({ item, color }: { item: FeedItem; color: string }) {
  const width = 520;
  const height = 150;
  const pts = projectRoute(item.route, width, height);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const first = pts[0];
  const last = pts[pts.length - 1];
  return (
    <div className="relative h-[150px] w-full border-y border-line bg-graphite-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
        <path d={d} fill="none" stroke="#101112" strokeWidth={10} strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
        <path d={d} fill="none" stroke={color} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
        {first ? <circle cx={first.x} cy={first.y} r={6} fill="#d5ff45" stroke="#101112" strokeWidth={2} /> : null}
        {last ? <circle cx={last.x} cy={last.y} r={6} fill="#ffffff" stroke="#101112" strokeWidth={2} /> : null}
      </svg>
      <span className="absolute bottom-2 right-3 bg-ink/80 px-2 py-1 text-[10px] text-muted">
        {item.gpsPoints} pontos GPS · ±{Math.round(item.avgAccuracyM)} m
      </span>
    </div>
  );
}

function projectRoute(route: { lat: number; lng: number }[], width: number, height: number) {
  if (route.length === 0) return [] as { x: number; y: number }[];
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const pad = 14;
  const lats = route.map((p) => p.lat);
  const lngs = route.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos(toRad(midLat)) * 111320;
  const ky = 110540;
  const minLng = Math.min(...lngs);
  const maxLat = Math.max(...lats);
  const local = route.map((p) => ({ x: (p.lng - minLng) * kx, y: (maxLat - p.lat) * ky }));
  const minX = Math.min(...local.map((p) => p.x));
  const maxX = Math.max(...local.map((p) => p.x));
  const minY = Math.min(...local.map((p) => p.y));
  const maxY = Math.max(...local.map((p) => p.y));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  return local.map((p) => ({ x: (p.x - minX) * scale + offX, y: (p.y - minY) * scale + offY }));
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="tabular text-base font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
    </div>
  );
}
