"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BottomSheet } from "@/components/BottomSheet";
import { renderStampedPhoto, downloadStamped } from "@/lib/stamp";
import { Icon } from "@/components/icons.client";

/** Foto georreferenciada exibida sobre o trajeto. */
export type GeoPhoto = {
  id: number;
  latitude: number | null;
  longitude: number | null;
  kmMark: number | null;
  caption: string | null;
  elapsedAtMs: number | null;
};

type Props = {
  photos: GeoPhoto[];
  /** Trilha real gravada (para posicionar fotos sem coordenada e animar o replay). */
  track: { lat: number; lng: number; t: number }[];
  sportColor: string;
  sportLabel: string;
  city: string | null;
  athleteName: string;
  athleteColor: string | null;
  totalDistanceM: number;
  startedAt: string;
};

/** Duração do replay animado (ms). */
const REPLAY_MS = 8000;
/** Tempo de destaque da foto durante o replay (ms). */
const PHOTO_FLASH_MS = 1500;

/** Converte lat/lng em coordenadas locais (m) para desenhar a linha do trajeto. */
function project(track: { lat: number; lng: number }[], w: number, h: number, pad = 14) {
  if (track.length === 0) return [];
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lats = track.map((p) => p.lat);
  const lngs = track.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos(toRad(midLat)) * 111320;
  const ky = 110540;
  const minLng = Math.min(...lngs);
  const maxLat = Math.max(...lats);
  const local = track.map((p) => ({ x: (p.lng - minLng) * kx, y: (maxLat - p.lat) * ky }));
  const minX = Math.min(...local.map((p) => p.x));
  const maxX = Math.max(...local.map((p) => p.x));
  const minY = Math.min(...local.map((p) => p.y));
  const maxY = Math.max(...local.map((p) => p.y));
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const offX = (w - spanX * scale) / 2;
  const offY = (h - spanY * scale) / 2;
  return local.map((p) => ({ x: (p.x - minX) * scale + offX, y: (p.y - minY) * scale + offY }));
}

export function RouteDiary({
  photos,
  track,
  sportColor,
  sportLabel,
  city,
  athleteName,
  athleteColor,
  totalDistanceM,
  startedAt,
}: Props) {
  const [openPhoto, setOpenPhoto] = useState<GeoPhoto | null>(null);
  const [stamped, setStamped] = useState<{ dataUrl: string; bytes: number } | null>(null);
  const [stamping, setStamping] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [flashPhoto, setFlashPhoto] = useState<GeoPhoto | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  const width = 520;
  const height = 280;
  const pts = useMemo(() => project(track, width, height), [track]);
  const path = useMemo(
    () => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" "),
    [pts],
  );

  /** Índice da trilha mais próximo de cada foto — para posicionar o marcador. */
  const photoMarkers = useMemo(() => {
    if (track.length === 0) return [];
    return photos
      .filter((p) => p.latitude !== null && p.longitude !== null)
      .map((p) => {
        let bestIdx = 0;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < track.length; i += 1) {
          const latDiff = (track[i].lat - (p.latitude as number)) * 111320;
          const lngDiff =
            (track[i].lng - (p.longitude as number)) * 111320 * Math.cos((track[i].lat * Math.PI) / 180);
          const d = Math.hypot(latDiff, lngDiff);
          if (d < bestDistance) {
            bestDistance = d;
            bestIdx = i;
          }
        }
        const pt = pts[bestIdx];
        return { photo: p, point: pt, idx: bestIdx };
      })
      .filter((m) => m.point);
  }, [photos, track, pts]);

  /* ------------------------------- Replay animado ------------------------------- */

  const stopReplay = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setReplaying(false);
    setProgress(0);
    setFlashPhoto(null);
  }, []);

  const startReplay = useCallback(() => {
    if (pts.length < 2) return;
    setReplaying(true);
    startRef.current = performance.now();
    const photosByIndex = photoMarkers;

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / REPLAY_MS);
      setProgress(t);

      // Índice atual do marcador na trilha.
      const idx = Math.min(pts.length - 1, Math.floor(t * (pts.length - 1)));
      const ratio = (t * (pts.length - 1)) / Math.max(1, pts.length - 1);
      // Foto cuja posição proporcional foi alcançada agora.
      const hit = photosByIndex.find((m) => {
        const pr = m.idx / Math.max(1, pts.length - 1);
        return Math.abs(ratio - pr) < 0.012;
      });
      setFlashPhoto(hit ? hit.photo : (current) => current);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        window.setTimeout(() => setFlashPhoto(null), PHOTO_FLASH_MS);
        window.setTimeout(() => {
          setReplaying(false);
          setProgress(0);
          setFlashPhoto(null);
        }, PHOTO_FLASH_MS);
        rafRef.current = null;
      }
      void ratio;
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [pts.length, photoMarkers]);

  useEffect(() => () => stopReplay(), [stopReplay]);

  /* --------------------------------- Carimbo --------------------------------- */

  async function stamp(photo: GeoPhoto) {
    setStamping(true);
    try {
      const result = await renderStampedPhoto({
        photoDataUrl: `/api/photos/${photo.id}`,
        kmMark: photo.kmMark,
        distanceM: totalDistanceM,
        city,
        takenAt: startedAt,
        sportLabel,
        athleteName,
        athleteColor,
      });
      setStamped(result);
    } catch {
      setStamped(null);
    } finally {
      setStamping(false);
    }
  }

  const head = pts[Math.floor(progress * (pts.length - 1))] ?? pts[0];

  return (
    <>
      <div className="relative overflow-hidden border border-line">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ aspectRatio: `${width} / ${height}` }}>
          <rect width={width} height={height} fill="#0b1016" />
          <path d={path} fill="none" stroke="#101112" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
          <path d={path} fill="none" stroke={sportColor} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />

          {/* Marcadores das fotos cravadas no trajeto */}
          {photoMarkers.map((m) => (
            <g
              key={m.photo.id}
              onClick={() => setOpenPhoto(m.photo)}
              style={{ cursor: "pointer" }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") setOpenPhoto(m.photo);
              }}
            >
              <circle cx={m.point.x} cy={m.point.y} r={13} fill={sportColor} opacity={0.16} />
              <circle cx={m.point.x} cy={m.point.y} r={8} fill="#101112" stroke={sportColor} strokeWidth={2} />
              <g transform={`translate(${m.point.x - 5}, ${m.point.y - 6}) scale(0.42)`}>
                <path
                  d="M4 8.6h3.2l1.4-2.2h7.6l1.4 2.2h3.2V19H3.6V8.6Z"
                  fill="none"
                  stroke={sportColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <circle cx="12" cy="13.4" r="3.1" fill="none" stroke={sportColor} strokeWidth={2} />
              </g>
            </g>
          ))}

          {/* Marcador animado do replay */}
          {replaying && head ? (
            <g>
              <circle cx={head.x} cy={head.y} r={16} fill={sportColor} opacity={0.28} />
              <circle cx={head.x} cy={head.y} r={7} fill={sportColor} stroke="#101112" strokeWidth={2} />
            </g>
          ) : null}
        </svg>

        {/* Controle Play / Replay */}
        {pts.length > 1 ? (
          <button
            type="button"
            onClick={() => (replaying ? stopReplay() : startReplay())}
            className="absolute bottom-3 right-3 flex items-center gap-2 border border-line bg-ink/92 px-3 py-2 text-[10px] font-display font-bold uppercase tracking-[0.14em] text-lime backdrop-blur-md"
            aria-label={replaying ? "Parar replay" : "Reproduzir percurso"}
          >
            {replaying ? <Icon.stop className="size-3.5" /> : <Icon.play className="size-3.5" />}
            {replaying ? "Parar" : "Replay"}
          </button>
        ) : null}

        {/* Destaque suave da foto durante o replay */}
        {flashPhoto ? (
          <div className="fade pointer-events-none absolute bottom-3 left-3 flex items-center gap-2.5 border border-line bg-ink/92 p-2 backdrop-blur-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${flashPhoto.id}`} alt="Foto do trajeto" className="size-14 object-cover" />
            <div className="min-w-0 pr-1">
              <p className="metric text-[12px] font-black text-lime">
                {flashPhoto.kmMark !== null ? `${flashPhoto.kmMark.toFixed(1)} km` : "—"}
              </p>
              <p className="truncate text-[10px] text-muted">{flashPhoto.caption ?? "Registro do trajeto"}</p>
            </div>
          </div>
        ) : null}
      </div>

      {photoMarkers.length > 0 ? (
        <p className="mt-2 text-[10px] text-muted">
          {photoMarkers.length} foto{photoMarkers.length > 1 ? "s" : ""} cravada{photoMarkers.length > 1 ? "s" : ""} no trajeto ·
          toque no marcador para abrir
        </p>
      ) : null}

      {/* Modal da foto + carimbo MUV */}
      <BottomSheet
        open={openPhoto !== null}
        onClose={() => {
          setOpenPhoto(null);
          setStamped(null);
        }}
        eyebrow="Diário de rota"
        title={
          openPhoto?.kmMark !== null && openPhoto?.kmMark !== undefined
            ? `Foto no km ${openPhoto.kmMark.toFixed(1)}`
            : "Foto do trajeto"
        }
      >
        {openPhoto ? (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${openPhoto.id}`} alt={openPhoto.caption ?? "Foto do trajeto"} className="w-full object-contain" />
            <div className="mt-3 grid grid-cols-3 gap-px border border-line bg-line text-center">
              <Cell label="Km" value={openPhoto.kmMark !== null ? openPhoto.kmMark.toFixed(1) : "—"} accent />
              <Cell
                label="Altitude"
                value={openPhoto.latitude !== null ? "registrada" : "—"}
              />
              <Cell label="Foto" value={`#${openPhoto.id}`} />
            </div>
            {openPhoto.caption ? <p className="mt-3 text-[12px] leading-relaxed text-muted">{openPhoto.caption}</p> : null}

            <button
              type="button"
              disabled={stamping}
              onClick={() => void stamp(openPhoto)}
              className="btn btn-primary mt-4 w-full"
            >
              <Icon.camera className="size-4" />
              {stamping ? "Gerando carimbo…" : "Baixar com Carimbo MUV"}
            </button>

            {stamped ? (
              <div className="mt-3 border border-lime/40 bg-lime/8 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={stamped.dataUrl} alt="Foto com carimbo MUV" className="w-full object-contain" />
                <button
                  type="button"
                  onClick={() => downloadStamped(stamped.dataUrl, `muv-${openPhoto.id}.jpg`)}
                  className="btn btn-dark mt-2.5 w-full"
                >
                  Salvar imagem
                </button>
                <p className="mt-1.5 text-[10px] text-muted">
                  Pronta para Stories ou WhatsApp · {Math.round(stamped.bytes / 1024)} KB
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-graphite px-2 py-3">
      <p className={`metric text-[14px] font-black ${accent ? "text-lime" : ""}`}>{value}</p>
      <p className="mt-0.5 text-[9px] font-display font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
    </div>
  );
}
