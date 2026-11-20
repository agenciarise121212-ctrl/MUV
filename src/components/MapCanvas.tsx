"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSON } from "geojson";
import type { GeoJSONSource, Map as MlMap, StyleSpecification } from "maplibre-gl";

export type MapLine = { coords: [number, number][]; color?: string; width?: number };
export type MapCircle = { center: [number, number]; radiusM: number; color?: string; label?: string };

type Props = {
  lines?: MapLine[];
  circles?: MapCircle[];
  markers?: { center: [number, number]; color?: string; label?: string }[];
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
};

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

export default function MapCanvas({
  lines = [],
  circles = [],
  markers = [],
  userPos = null,
  follow = false,
  interactive = true,
  autoFit = false,
  className = "",
  tileStyle = "dark",
  onInteract,
  circlesClickable = false,
  onCircleClick,
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
          if (hit) onCircleClick?.(Number(hit.properties["__index"]));
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
        properties: { c: l.color ?? "#d5ff45", w: l.width ?? 5 },
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
    (map.getSource("muv-lines") as GeoJSONSource | undefined)?.setData(featureCollection(lineFeatures));
    (map.getSource("muv-areas") as GeoJSONSource | undefined)?.setData(featureCollection(areaFeatures));
    (map.getSource("muv-pins") as GeoJSONSource | undefined)?.setData(featureCollection(pinFeatures));

    if (autoFit) {
      const all: [number, number][] = [
        ...lines.flatMap((l) => l.coords),
        ...circles.map((c) => c.center),
        ...markers.map((m) => m.center),
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
  }, [lines, circles, markers, ready, autoFit]);

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
