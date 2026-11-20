"use client";
import { useEffect, useRef } from "react";
import type * as L from "leaflet";

type P = { lat: number; lng: number };

export default function RouteMap({ points, current, accuracy, follow = false, interactive = true, className = "h-64" }: {
  points: P[]; current?: P | null; accuracy?: number | null; follow?: boolean; interactive?: boolean; className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const st = useRef<{ L?: typeof L; map?: L.Map; line?: L.Polyline; me?: L.CircleMarker; acc?: L.Circle; start?: L.CircleMarker; end?: L.CircleMarker; fitted?: boolean }>({});

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      if (cancelled || !el.current || st.current.map) return;
      const Lf = (mod.default ?? mod) as typeof L;
      const map = Lf.map(el.current, { zoomControl: interactive, dragging: interactive, scrollWheelZoom: interactive, doubleClickZoom: interactive, touchZoom: interactive, attributionControl: true }).setView([-15.78, -47.93], 3);
      Lf.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap", className: "muv-dark-tiles" }).addTo(map);
      st.current = { L: Lf, map, line: Lf.polyline([], { color: "#D5FF45", weight: 4 }).addTo(map) };
      draw();
    });
    return () => { cancelled = true; st.current.map?.remove(); st.current = {}; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const { L: Lf, map, line } = st.current;
    if (!Lf || !map || !line) return;
    const ll = points.map((p) => [p.lat, p.lng] as [number, number]);
    line.setLatLngs(ll);
    if (ll.length && !current) {
      st.current.start?.remove(); st.current.end?.remove();
      st.current.start = Lf.circleMarker(ll[0], { radius: 6, color: "#101112", fillColor: "#D5FF45", fillOpacity: 1, weight: 2 }).addTo(map);
      st.current.end = Lf.circleMarker(ll[ll.length - 1], { radius: 6, color: "#101112", fillColor: "#F5F5F2", fillOpacity: 1, weight: 2 }).addTo(map);
    }
    if (current) {
      if (!st.current.me) {
        st.current.acc = Lf.circle([current.lat, current.lng], { radius: accuracy ?? 10, color: "#D5FF45", weight: 1, fillOpacity: 0.15 }).addTo(map);
        st.current.me = Lf.circleMarker([current.lat, current.lng], { radius: 8, color: "#101112", fillColor: "#D5FF45", fillOpacity: 1, weight: 3 }).addTo(map);
      } else {
        st.current.me.setLatLng([current.lat, current.lng]);
        st.current.acc?.setLatLng([current.lat, current.lng]).setRadius(accuracy ?? 10);
      }
      if (follow || !st.current.fitted) { map.setView([current.lat, current.lng], Math.max(map.getZoom(), 16)); st.current.fitted = true; }
    } else if (ll.length > 1 && !st.current.fitted) {
      map.fitBounds(line.getBounds(), { padding: [20, 20] }); st.current.fitted = true;
    } else if (ll.length === 1 && !st.current.fitted) { map.setView(ll[0], 15); st.current.fitted = true; }
  }

  useEffect(draw); // redesenha a cada atualização
  return <div ref={el} className={`w-full bg-graphite z-0 ${className}`} />;
}
