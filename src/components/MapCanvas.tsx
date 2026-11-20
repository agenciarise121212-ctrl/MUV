"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { EMBLEM_GRID, emblemSource } from "@/lib/emblems";
import type { GeoJSON } from "geojson";
import type { GeoJSONSource, Map as MlMap, StyleSpecification } from "maplibre-gl";

export type MapLine = { coords: [number, number][]; color?: string; width?: number; dash?: boolean };
export type MapCircle = { center: [number, number]; radiusM: number; color?: string; label?: string };

/** Ponto de interesse do mapa renderizado com o brasão 3D correspondente. */
export type MapEmblem = {
  id: number;
  center: [number, number];
  emblemKey: string;
  accent: string;
  /** Destaca visualmente (anel pulsante via camada separada). */
  highlighted?: boolean;
  /** Marcadores concluídos ficam atenuados. */
  dimmed?: boolean;
};

type Props = {
  lines?: MapLine[];
  circles?: MapCircle[];
  markers?: { center: [number, number]; color?: string; label?: string }[];
  emblems?: MapEmblem[];
  /** Raio (km) para agrupar marcadores muito próximos e não poluir o mapa. */
  clusterEmblems?: boolean;
  userPos?: [number, number] | null;
  accuracyM?: number;
  follow?: boolean;
  interactive?: boolean;
  autoFit?: boolean;
  className?: string;
  tileStyle?: "dark" | "voyager";
  onInteract?: () => void;
  circlesClickable?: boolean;
  onCircleClick?: (index: number) => void;
  onEmblemClick?: (id: number) => void;
};

/** Cache local dos recortes da sprite sheet — evita recortar a mesma célula duas vezes. */
const emblemImageCache = new Map<string, ImageData | null>();
let spritePromise: Promise<HTMLImageElement | null> | null = null;

function loadSprite(url: string): Promise<HTMLImageElement | null> {
  if (!spritePromise) {
    spritePromise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
      window.setTimeout(() => (img.complete ? undefined : resolve(null)), 6000);
    });
  }
  return spritePromise;
}

/**
 * Recorta uma célula da sprite sheet em um disco com anel de acento,
 * devolvendo ImageData pronto para `map.addImage`.
 */
async function buildEmblemImage(emblemKey: string, accent: string): Promise<ImageData | null> {
  const cacheKey = `${emblemKey}|${accent}`;
  if (emblemImageCache.has(cacheKey)) return emblemImageCache.get(cacheKey) ?? null;

  const { url, row, col, isOverride } = emblemSource(emblemKey);
  const sprite = await loadSprite(url);
  const size = 72;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const radius = size / 2 - 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#0c0d0e";
  ctx.fillRect(0, 0, size, size);

  if (sprite && !isOverride) {
    const cellW = sprite.naturalWidth / EMBLEM_GRID.cols;
    const cellH = sprite.naturalHeight / EMBLEM_GRID.rows;
    // Inset de 7% para não sangrar arte das células vizinhas.
    const insetX = cellW * 0.07;
    const insetY = cellH * 0.07;
    ctx.drawImage(sprite, col * cellW + insetX, row * cellH + insetY, cellW - insetX * 2, cellH - insetY * 2, 0, 0, size, size);
  } else if (sprite && isOverride) {
    const scale = Math.min(size / sprite.naturalWidth, size / sprite.naturalHeight);
    const w = sprite.naturalWidth * scale;
    const h = sprite.naturalHeight * scale;
    ctx.drawImage(sprite, (size - w) / 2, (size - h) / 2, w, h);
  } else {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius - 1, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, radius + 1.5, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(16,17,18,0.9)";
  ctx.stroke();

  let data: ImageData | null = null;
  try {
    data = ctx.getImageData(0, 0, size, size);
  } catch {
    // Canvas contaminado (CDN sem CORS): cai para um disco colorido com o anel de acento.
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#191b1e";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius * 0.42, 0, Math.PI * 2);
    ctx.fill();
    try {
      data = ctx.getImageData(0, 0, size, size);
    } catch {
      return null;
    }
  }
  emblemImageCache.set(cacheKey, data);
  return data;
}

const TILES: Record<"dark" | "voyager", string> = {
  dark: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
  voyager: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
};

const DEFAULT_CENTER: [number, number] = [-46.6333, -23.5505];

function circlePolygon(center: [number, number], radiusM: number, steps = 72): [number, number][] {
  const [lng, lat] = center;
  const coords: [number, number][] = [];
  const dx = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const dy = radiusM / 110540;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    coords.push([lng + Math.cos(t) * dx, lat + Math.sin(t) * dy]);
  }
  return coords;
}

function featureCollection(features: GeoJSON.Feature[]): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features };
}

/** Registra as imagens dos brasões usados pelos marcadores atuais (com cache). */
async function registerEmblemImages(map: MlMap, emblems: MapEmblem[]) {
  const wanted = new Map<string, string>();
  for (const e of emblems) if (!wanted.has(e.emblemKey)) wanted.set(e.emblemKey, e.accent);
  for (const [key, accent] of wanted) {
    if (map.hasImage(key)) continue;
    const data = await buildEmblemImage(key, accent);
    if (data) map.addImage(key, data, { pixelRatio: 1 });
  }
}

export default function MapCanvas({
  lines = [],
  circles = [],
  markers = [],
  emblems = [],
  clusterEmblems = false,
  userPos = null,
  follow = false,
  interactive = true,
  autoFit = false,
  className = "",
  tileStyle = "dark",
  onInteract,
  circlesClickable = false,
  onCircleClick,
  onEmblemClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const followingRef = useRef(follow);
  const [ready, setReady] = useState(false);
  const [following, setFollowing] = useState(follow);
  const [dragged, setDragged] = useState(false);

  useEffect(() => {
    followingRef.current = follow;
    if (follow) {
      setFollowing(true);
      setDragged(false);
    }
  }, [follow]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const ml = await import("maplibre-gl");
      if (cancelled || !containerRef.current || mapRef.current) return;
      const style: StyleSpecification = {
        version: 8,
        sources: {
          base: {
            type: "raster",
            tiles: [TILES[tileStyle]],
            tileSize: 256,
            attribution: "© OpenStreetMap · © CARTO",
          },
        },
        layers: [{ id: "base", type: "raster", source: "base" }],
      };
      const first = lines[0]?.coords?.[0] ?? DEFAULT_CENTER;
      const map = new ml.Map({
        container: containerRef.current,
        style,
        center: userPos ?? first,
        zoom: autoFit ? 11 : 16,
        interactive,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on("load", () => {
        map.addSource("muv-lines", { type: "geojson", data: featureCollection([]) });
        map.addLayer({
          id: "line-casing",
          type: "line",
          source: "muv-lines",
          paint: { "line-color": "#05070b", "line-width": ["coalesce", ["get", "w"], 9], "line-opacity": 0.65 },
        });
        map.addLayer({
          id: "line-draw",
          type: "line",
          source: "muv-lines",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ["get", "c"], "line-width": ["coalesce", ["get", "w"], 5] },
        });
        map.addSource("muv-areas", { type: "geojson", data: featureCollection([]) });
        map.addLayer({
          id: "area-fill",
          type: "fill",
          source: "muv-areas",
          paint: { "fill-color": ["get", "c"], "fill-opacity": 0.16 },
        });
        map.addLayer({
          id: "area-outline",
          type: "line",
          source: "muv-areas",
          paint: { "line-color": ["get", "c"], "line-width": 1.5, "line-opacity": 0.8 },
        });
        map.addSource("muv-pins", { type: "geojson", data: featureCollection([]) });
        map.addLayer({
          id: "pins",
          type: "circle",
          source: "muv-pins",
          paint: {
            "circle-radius": 6,
            "circle-color": ["get", "c"],
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#05070b",
          },
        });
        map.addSource("muv-emblems", {
          type: "geojson",
          data: featureCollection([]),
          cluster: clusterEmblems,
          clusterRadius: 46,
          clusterMaxZoom: 14,
        });
        map.addLayer({
          id: "emblem-cluster",
          type: "circle",
          source: "muv-emblems",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#191b1e",
            "circle-radius": 17,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#858b94",
          },
        });
        map.addLayer({
          id: "emblem-cluster-count",
          type: "symbol",
          source: "muv-emblems",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 12,
          },
          paint: { "text-color": "#f5f5f2" },
        });
        map.addLayer({
          id: "emblem-halo",
          type: "circle",
          source: "muv-emblems",
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "hi"], true]],
          paint: {
            "circle-color": ["get", "a"],
            "circle-radius": 21,
            "circle-opacity": 0.22,
            "circle-blur": 0.7,
          },
        });
        map.addLayer({
          id: "emblem-icon",
          type: "symbol",
          source: "muv-emblems",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": ["get", "img"],
            "icon-size": ["case", ["==", ["get", "hi"], true], 1.18, 1],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
        });
        setReady(true);
      });
      if (interactive) {
        map.on("dragstart", () => {
          followingRef.current = false;
          setFollowing(false);
          setDragged(true);
          onInteract?.();
        });
        map.on("click", (event) => {
          const layers = map.queryRenderedFeatures(event.point, { layers: ["area-fill"] });
          const hit = layers.find((f) => typeof f.properties?.["__index"] === "number");
          if (hit) {
            onCircleClick?.(Number(hit.properties["__index"]));
            return;
          }
          const emblemLayers = map.queryRenderedFeatures(event.point, {
            layers: ["emblem-icon", "emblem-halo"],
          });
          const emblem = emblemLayers.find((f) => typeof f.properties?.["qid"] === "number");
          if (emblem) onEmblemClick?.(Number(emblem.properties["qid"]));
        });
      }
    }
    void boot();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const lineFeatures = lines
      .filter((l) => l.coords.length > 1)
      .map((l) => ({
        type: "Feature" as const,
        properties: { c: l.color ?? "#d5ff45", w: l.width ?? 5, dash: Boolean(l.dash) },
        geometry: { type: "LineString" as const, coordinates: l.coords },
      }));
    const areaFeatures = circles.map((c, index) => ({
      type: "Feature" as const,
      properties: { c: c.color ?? "#59b7ff" },
      geometry: { type: "Polygon" as const, coordinates: [circlePolygon(c.center, c.radiusM)] },
    }));
    const pinFeatures = markers.map((m) => ({
      type: "Feature" as const,
      properties: { c: m.color ?? "#ffffff" },
      geometry: { type: "Point" as const, coordinates: m.center },
    }));
    void registerEmblemImages(map, emblems);
    const emblemFeatures = emblems.map((e) => ({
      type: "Feature" as const,
      properties: { qid: e.id, img: e.emblemKey, a: e.accent, hi: Boolean(e.highlighted), dim: Boolean(e.dimmed) },
      geometry: { type: "Point" as const, coordinates: e.center },
    }));
    const emblemSource = map.getSource("muv-emblems") as GeoJSONSource | undefined;
    if (emblemSource) {
      emblemSource.setData(featureCollection(emblemFeatures));
      emblemSource.setClusterOptions?.({ cluster: clusterEmblems, clusterRadius: 46 });
    }

    (map.getSource("muv-lines") as GeoJSONSource | undefined)?.setData(featureCollection(lineFeatures));
    (map.getSource("muv-areas") as GeoJSONSource | undefined)?.setData(featureCollection(areaFeatures));
    (map.getSource("muv-pins") as GeoJSONSource | undefined)?.setData(featureCollection(pinFeatures));

    if (autoFit) {
      const all: [number, number][] = [
        ...lines.flatMap((l) => l.coords),
        ...circles.map((c) => c.center),
        ...markers.map((m) => m.center),
        ...emblems.map((e) => e.center),
      ];
      if (all.length > 1) {
        const lons = all.map((p) => p[0]);
        const lats = all.map((p) => p[1]);
        map.fitBounds(
          [
            [Math.min(...lons), Math.min(...lats)],
            [Math.max(...lons), Math.max(...lats)],
          ],
          { padding: 56, duration: 400, maxZoom: 16 },
        );
      }
    }
  }, [lines, circles, markers, emblems, ready, autoFit]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !userPos) return;
    if ((followingRef.current || (follow && !dragged)) && interactive) {
      map.easeTo({ center: userPos, zoom: Math.max(map.getZoom(), 16), duration: 600 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPos, ready, follow, dragged]);

  function recenter() {
    const map = mapRef.current;
    if (!map || !userPos) return;
    followingRef.current = true;
    setFollowing(true);
    setDragged(false);
    map.easeTo({ center: userPos, zoom: 17, duration: 500 });
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {userPos && (follow || dragged) ? (
        <button
          type="button"
          onClick={recenter}
          className="hairline absolute bottom-3 right-3 z-10 rounded-full bg-ink/85 px-3 py-2 text-[11px] font-semibold text-lime"
        >
          {following ? "GPS ativo" : "Recentrar"}
        </button>
      ) : null}
      {!ready ? (
        <div className="shimmer absolute inset-0 grid place-items-center bg-surface text-[12px] text-muted">Carregando mapa…</div>
      ) : null}
    </div>
  );
}
