"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type * as L from "leaflet";
import Icon from "./Icon";
import Lightbox from "./Lightbox";
import { haversine } from "@/lib/format";
import type { PhotoMeta } from "@/lib/stamp";

type Photo = { id: number; lat: number | null; lng: number | null; kmMark: number | null; takenAt: string | null };
const DURATION_MS = 8000;

export default function ActivityReplayMap({ points, photos, date, className = "h-[380px]" }: { points: [number, number][]; photos: Photo[]; date: string; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const st = useRef<{ L?: typeof L; map?: L.Map; runner?: L.Marker; trail?: L.Polyline }>({});
  const raf = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<Photo | null>(null);
  const [view, setView] = useState<number | null>(null);
  const geoPhotos = useMemo(() => photos.filter((p) => p.lat != null && p.lng != null), [photos]);
  // índice do ponto do trajeto mais próximo de cada foto
  const photoIdx = useMemo(() => geoPhotos.map((p) => {
    let best = 0, bd = Infinity;
    points.forEach((q, i) => { const d = haversine({ lat: q[0], lng: q[1] }, { lat: p.lat!, lng: p.lng! }); if (d < bd) { bd = d; best = i; } });
    return { photo: p, idx: best };
  }).sort((a, b) => a.idx - b.idx), [geoPhotos, points]);
  const meta = useMemo(() => Object.fromEntries(photos.map((p) => [p.id, { lat: p.lat, lng: p.lng, kmMark: p.kmMark, takenAt: p.takenAt } satisfies PhotoMeta])), [photos]);
  const ids = photos.map((p) => p.id);

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current || st.current.map) return;
      const Lf = (mod.default ?? mod) as typeof L;
      const map = Lf.map(el.current, { zoomControl: false, attributionControl: true });
      Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", className: "muv-dark-tiles" }).addTo(map);
      const line = Lf.polyline(points, { color: "#D5FF45", weight: 4, opacity: 0.45 }).addTo(map);
      const trail = Lf.polyline([], { color: "#D5FF45", weight: 5 }).addTo(map);
      Lf.circleMarker(points[0], { radius: 6, color: "#101112", weight: 2, fillColor: "#D5FF45", fillOpacity: 1 }).addTo(map);
      Lf.circleMarker(points[points.length - 1], { radius: 6, color: "#101112", weight: 2, fillColor: "#F5F5F2", fillOpacity: 1 }).addTo(map);
      geoPhotos.forEach((p) => {
        Lf.marker([p.lat!, p.lng!], { icon: Lf.divIcon({ className: "", iconSize: [38, 38], iconAnchor: [19, 19], html: `<div class="photo-pin"><img src="/api/photos/${p.id}" alt="" loading="lazy"/></div>` }), keyboard: true, title: p.kmMark != null ? `Foto no km ${p.kmMark.toFixed(2)}` : "Foto do percurso" })
          .on("click", () => setView(ids.indexOf(p.id))).addTo(map);
      });
      map.fitBounds(line.getBounds(), { padding: [28, 28] });
      st.current = { L: Lf, map, trail };
      setReady(true);
    });
    return () => { cancelled = true; if (raf.current) cancelAnimationFrame(raf.current); st.current.map?.remove(); st.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function play() {
    const { L: Lf, map, trail } = st.current;
    if (!Lf || !map || !trail || points.length < 2) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    st.current.runner?.remove();
    const runner = Lf.marker(points[0], { icon: Lf.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11], html: `<div class="replay-dot"></div>` }), interactive: false }).addTo(map);
    st.current.runner = runner;
    trail.setLatLngs([]);
    setPlaying(true);
    let next = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const f = Math.min(1, (now - t0) / DURATION_MS);
      const pos = f * (points.length - 1), i = Math.floor(pos), r = pos - i;
      const a = points[i], b = points[Math.min(i + 1, points.length - 1)];
      const ll: [number, number] = [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r];
      runner.setLatLng(ll);
      trail.setLatLngs([...points.slice(0, i + 1), ll]);
      setProgress(f);
      while (next < photoIdx.length && photoIdx[next].idx <= i) {
        const p = photoIdx[next].photo; next++;
        setFlash(p); setTimeout(() => setFlash((cur) => (cur?.id === p.id ? null : cur)), 1500);
      }
      if (f < 1) raf.current = requestAnimationFrame(step);
      else { setPlaying(false); raf.current = null; }
    };
    raf.current = requestAnimationFrame(step);
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={el} className="absolute inset-0 bg-graphite z-0" />
      {!ready && <div className="absolute inset-0 skel" />}
      <button onClick={play} disabled={!ready || playing} className="tap absolute left-3 bottom-3 z-[500] h-10 pl-3 pr-4 flex items-center gap-2 bg-ink/90 backdrop-blur border border-line text-[12px] font-semibold uppercase tracking-wider disabled:opacity-70">
        <span className={`w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] ${playing ? "border-l-mute" : "border-l-lime"}`} />{progress > 0 && !playing ? "Replay" : playing ? "Reproduzindo" : "Play"}
      </button>
      {playing && <div className="absolute left-0 right-0 bottom-0 h-[3px] z-[500] bg-line"><div className="h-full bg-lime" style={{ width: `${progress * 100}%` }} /></div>}
      {geoPhotos.length > 0 && <div className="absolute right-3 bottom-3 z-[500] h-10 px-3 flex items-center gap-1.5 bg-ink/90 border border-line text-[11px] text-mute"><Icon name="camera" size={14} />{geoPhotos.length} no trajeto</div>}
      {flash && (
        <div key={flash.id} className="absolute right-3 top-3 z-[600] w-36 bg-ink border border-line overflow-hidden rise" style={{ animationDuration: ".35s" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/photos/${flash.id}`} alt="" className="w-full h-24 object-cover" />
          {flash.kmMark != null && <div className="px-2 py-1 text-[11px] num">km {flash.kmMark.toFixed(2)}</div>}
        </div>
      )}
      {view != null && view >= 0 && <Lightbox ids={ids} index={view} onClose={() => setView(null)} meta={meta} date={date} />}
    </div>
  );
}
