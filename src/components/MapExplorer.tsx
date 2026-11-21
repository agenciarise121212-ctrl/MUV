"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MapCircle, MapLine } from "@/components/MapCanvas";
import MapView from "@/components/MapView";
import { BottomSheet } from "@/components/BottomSheet";
import { Icon } from "@/components/icons.client";
import { formatDistance, formatDuration, formatSpeed } from "@/lib/format";

export type MapTerritory = {
  distanceM?: number;
  id: number;
  name: string;
  region: string;
  emoji: string;
  description: string | null;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  xpReward: number;
  coinsReward: number;
  claimed: boolean;
  owners: number;
  lastOwner: string;
  myDistanceInsideM: number;
};

export type MapSegment = {
  id: number;
  name: string;
  sport: string;
  city: string | null;
  distanceM: number;
  avgGradePct: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  athletes: number;
  bestTime: number;
  myBest: number;
};

type Layers = { territories: boolean; segments: boolean; position: boolean };

export function MapExplorer({ territories, segments }: { territories: MapTerritory[]; segments: MapSegment[] }) {
  const [layers, setLayers] = useState<Layers>({ territories: true, segments: true, position: true });
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState(0);
  const [gpsState, setGpsState] = useState<"idle" | "ok" | "denied">("idle");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<{ kind: "territory" | "segment"; id: number } | null>(null);
  const [listOpen, setListOpen] = useState(false);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsState("denied");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPos([p.coords.longitude, p.coords.latitude]);
        setAccuracy(p.coords.accuracy ?? 0);
        setGpsState("ok");
      },
      () => setGpsState("denied"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const circles: MapCircle[] = useMemo(
    () =>
      layers.territories
        ? territories.map((t) => ({
            center: [t.centerLng, t.centerLat] as [number, number],
            radiusM: t.radiusM,
            color: t.claimed ? "#d5ff45" : "#6fb6ff",
            label: t.name,
          }))
        : [],
    [layers.territories, territories],
  );

  const lines: MapLine[] = useMemo(
    () =>
      layers.segments
        ? segments.map((s) => ({
            coords: [
              [s.startLng, s.startLat],
              [s.endLng, s.endLat],
            ],
            color: "#ff6a3d",
            width: 3,
          }))
        : [],
    [layers.segments, segments],
  );

  const territory = selected?.kind === "territory" ? territories.find((t) => t.id === selected.id) : null;
  const segment = selected?.kind === "segment" ? segments.find((s) => s.id === selected.id) : null;

  const nearby = useMemo(() => {
    if (!pos) return territories;
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    return territories.map((t) => ({ ...t }))
      .map((t) => {
        const dLat = toRad(t.centerLat - pos[1]);
        const dLng = toRad(t.centerLng - pos[0]);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(pos[1])) * Math.cos(toRad(t.centerLat)) * Math.sin(dLng / 2) ** 2;
        return { ...t, distanceM: 2 * R * Math.asin(Math.min(1, Math.sqrt(h))) };
      })
      .sort((a, b) => a.distanceM - b.distanceM);
  }, [pos, territories]);

  return (
    <>
      <div className="fixed inset-x-0 top-0 bottom-0 mx-auto max-w-[480px]">
        <MapView
          className="absolute inset-0"
          lines={lines}
          circles={circles}
          circlesClickable={layers.territories}
          onCircleClick={(index: number) => {
            const t = territories[index];
            if (t) setSelected({ kind: "territory", id: t.id });
          }}
          userPos={layers.position ? pos : null}
          follow
          autoFit={!pos}
        />

        {/* Status GPS */}
        <div className="pointer-events-none absolute left-4 top-[70px] z-10">
          <span
            className="inline-flex items-center gap-1.5 border bg-ink/90 px-2.5 py-1.5 text-[10px] font-display font-bold uppercase tracking-[0.14em]"
            style={{ borderColor: gpsState === "ok" ? "rgba(213,255,69,0.4)" : "var(--color-line)", color: gpsState === "ok" ? "#d5ff45" : "#858b94" }}
          >
            <span className="size-1.5 rounded-full" style={{ background: gpsState === "ok" ? "#d5ff45" : "#858b94" }} />
            {gpsState === "ok" ? `GPS ±${Math.round(accuracy)}m` : gpsState === "denied" ? "GPS off" : "Buscando…"}
          </span>
        </div>

        {/* Controles flutuantes */}
        <div className="absolute right-4 top-[70px] z-10 flex flex-col gap-2">
          <button type="button" onClick={() => setFiltersOpen(true)} className="map-fab" aria-label="Filtros do mapa">
            <Icon.layers className="size-[18px]" />
          </button>
          <button type="button" onClick={() => setListOpen(true)} className="map-fab" aria-label="Lista de explorações">
            <Icon.feed className="size-[18px]" />
          </button>
        </div>

        {/* Legenda compacta */}
        <div className="pointer-events-none absolute bottom-[calc(var(--nav-h)+env(safe-area-inset-bottom,0px)+16px)] left-4 z-10 flex gap-1.5">
          {layers.territories ? (
            <span className="border border-line bg-ink/90 px-2 py-1 text-[9px] font-display font-bold uppercase tracking-[0.12em] text-lime">
              ◼ Territórios {territories.length}
            </span>
          ) : null}
          {layers.segments ? (
            <span className="border border-line bg-ink/90 px-2 py-1 text-[9px] font-display font-bold uppercase tracking-[0.12em] text-flame">
              — Segmentos {segments.length}
            </span>
          ) : null}
        </div>
      </div>

      {/* Filtros */}
      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} eyebrow="Camadas" title="Filtros do mapa">
        <ul className="divide-y divide-line">
          {([
            ["territories", "Territórios", "Regiões que você pode dominar"],
            ["segments", "Segmentos", "Trechos cronometrados da comunidade"],
            ["position", "Minha posição", "Localização em tempo real do GPS"],
          ] as [keyof Layers, string, string][]).map(([key, label, desc]) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                className="flex w-full items-center gap-3 py-3.5 text-left"
              >
                <span className={`grid size-5 shrink-0 place-items-center border ${layers[key] ? "border-lime bg-lime text-ink" : "border-line"}`}>
                  {layers[key] ? <Icon.check className="size-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold">{label}</span>
                  <span className="block text-[11px] text-muted">{desc}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <Link href="/app/record" className="btn btn-primary mt-4 w-full">
          <Icon.record className="size-4" />
          Gravar atividade aqui
        </Link>
      </BottomSheet>

      {/* Lista de explorações */}
      <BottomSheet open={listOpen} onClose={() => setListOpen(false)} eyebrow="Exploração" title="Territórios e segmentos">
        <p className="eyebrow mb-2">Territórios {pos ? "por proximidade" : ""}</p>
        <ul className="divide-y divide-line border-y border-line">
          {nearby.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected({ kind: "territory", id: t.id });
                  setListOpen(false);
                }}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <Icon.pin className={`size-[18px] shrink-0 ${t.claimed ? "text-lime" : "text-sky"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{t.name}</span>
                  <span className="tabular block text-[11px] text-muted">
                    {t.region}{" "}
                    {typeof t.distanceM === "number" ? `· ${formatDistance(t.distanceM)} de você` : ""}
                    {t.claimed ? " · dominado" : ` · ${t.owners} atleta(s)`}
                  </span>
                </span>
                <Icon.chevron className="size-3 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
        <p className="eyebrow mb-2 mt-5">Segmentos</p>
        <ul className="divide-y divide-line border-y border-line">
          {segments.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected({ kind: "segment", id: s.id });
                  setListOpen(false);
                }}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <Icon.route className="size-[18px] shrink-0 text-flame" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{s.name}</span>
                  <span className="tabular block text-[11px] text-muted">
                    {formatDistance(s.distanceM)} · {s.avgGradePct.toFixed(1)}% · {s.athletes} atletas
                  </span>
                </span>
                <Icon.chevron className="size-3 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      {/* Detalhe de território */}
      <BottomSheet
        open={Boolean(territory)}
        onClose={() => setSelected(null)}
        eyebrow={territory?.claimed ? "Território dominado" : "Território livre"}
        title={territory?.name ?? ""}
      >
        {territory ? (
          <>
            <p className="text-[13px] leading-relaxed text-muted">{territory.description ?? territory.region}</p>
            <div className="mt-4 grid grid-cols-3 gap-px border border-line bg-line">
              <Stat value={formatDistance(territory.radiusM, 0)} label="raio" />
              <Stat value={`+${territory.xpReward}`} label="XP" />
              <Stat value={`+${territory.coinsReward}`} label="moedas" />
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-4">
              <Row label="Status" value={territory.claimed ? "Dominado por você" : "Livre"} accent={territory.claimed ? "#d5ff45" : undefined} />
              <Row label="Atletas" value={String(territory.owners)} />
              {territory.lastOwner ? <Row label="Último domínio" value={territory.lastOwner} /> : null}
              <Row label="Seu trajeto dentro" value={formatDistance(territory.myDistanceInsideM)} />
            </div>
            <Link href="/app/territories" className="btn btn-dark mt-4 w-full">
              Ver todos os territórios
            </Link>
          </>
        ) : null}
      </BottomSheet>

      {/* Detalhe de segmento */}
      <BottomSheet open={Boolean(segment)} onClose={() => setSelected(null)} eyebrow="Segmento" title={segment?.name ?? ""}>
        {segment ? (
          <>
            <p className="text-[13px] text-muted">
              {segment.city} · trecho cronometrado pela comunidade
            </p>
            <div className="mt-4 grid grid-cols-3 gap-px border border-line bg-line">
              <Stat value={formatDistance(segment.distanceM)} label="distância" />
              <Stat value={`${segment.avgGradePct.toFixed(1)}%`} label="inclinação" />
              <Stat value={segment.bestTime ? formatDuration(segment.bestTime) : "—"} label="recorde" />
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-4">
              <Row label="Atletas" value={String(segment.athletes)} />
              <Row label="Seu melhor" value={segment.myBest ? formatDuration(segment.myBest) : "sem esforço"} accent={segment.myBest ? "#d5ff45" : undefined} />
            </div>
            <Link href={`/app/segments/${segment.id}`} className="btn btn-primary mt-4 w-full">
              Ver ranking completo
            </Link>
          </>
        ) : null}
      </BottomSheet>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-graphite px-3 py-3 text-center">
      <p className="metric text-[16px] font-black text-lime">{value}</p>
      <p className="mt-0.5 text-[9px] font-display font-bold uppercase tracking-[0.14em] text-muted">{label}</p>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">{label}</span>
      <span className="metric text-[13px] font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function formatSpeedForMap(v: number) {
  return formatSpeed(v);
}
