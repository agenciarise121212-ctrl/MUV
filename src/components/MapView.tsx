"use client";
import dynamic from "next/dynamic";
const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false, loading: () => <div className="h-full w-full bg-line animate-pulse" /> });
export default function MapView(props: { points: { lat: number; lng: number }[]; interactive?: boolean; className?: string }) {
  return <RouteMap {...props} />;
}
