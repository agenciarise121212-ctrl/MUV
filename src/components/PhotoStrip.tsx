"use client";
import { useState } from "react";
import Lightbox from "./Lightbox";
import type { PhotoMeta } from "@/lib/stamp";

export default function PhotoStrip({ ids, large = false, meta, date }: { ids: number[]; large?: boolean; meta?: Record<number, PhotoMeta>; date?: string }) {
  const [v, setV] = useState<number | null>(null);
  if (!ids.length) return null;
  return (
    <>
      <div className="flex gap-px overflow-x-auto snap-x [scrollbar-width:none]">
        {ids.map((id, i) => (
          <button key={id} onClick={() => setV(i)} className={`snap-start shrink-0 overflow-hidden bg-line group ${large ? "h-80  w-[86%] " : "h-44 w-44"} ${ids.length === 1 ? "!w-full" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/photos/${id}`} alt="" loading="lazy" className="w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]" />
          </button>
        ))}
      </div>
      {v != null && <Lightbox ids={ids} index={v} onClose={() => setV(null)} meta={meta} date={date} />}
    </>
  );
}
