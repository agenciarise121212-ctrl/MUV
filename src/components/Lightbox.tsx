"use client";

import { useEffect, useState } from "react";

export function Lightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: { id: number; caption?: string | null }[];
  index: number | null;
  onClose: () => void;
  onIndexChange?: (next: number) => void;
}) {
  const open = index !== null && index >= 0 && index < photos.length;

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && onIndexChange && index !== null) onIndexChange(Math.min(photos.length - 1, index + 1));
      if (event.key === "ArrowLeft" && onIndexChange && index !== null) onIndexChange(Math.max(0, index - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onIndexChange, index, photos.length]);

  if (!open || index === null) return null;
  const photo = photos[index];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
        <span className="tabular">
          {index + 1} / {photos.length}
        </span>
        <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold">
          Fechar
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center px-2 pb-2" onClick={(e) => e.stopPropagation()}>
        {index > 0 ? (
          <button
            type="button"
            onClick={() => onIndexChange?.(index - 1)}
            className="mr-1 grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white"
            aria-label="Anterior"
          >
            ‹
          </button>
        ) : (
          <span className="size-10 shrink-0" />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/photos/${photo.id}`}
          alt={photo.caption ?? "Foto da atividade"}
          className="max-h-[78vh] w-auto max-w-full  object-contain"
        />
        {index < photos.length - 1 ? (
          <button
            type="button"
            onClick={() => onIndexChange?.(index + 1)}
            className="ml-1 grid size-10 shrink-0 place-items-center rounded-full bg-white/10 text-white"
            aria-label="Próxima"
          >
            ›
          </button>
        ) : (
          <span className="size-10 shrink-0" />
        )}
      </div>
      {photo.caption ? (
        <p className="px-6 pb-8 text-center text-sm text-white/80">{photo.caption}</p>
      ) : (
        <div className="pb-8" />
      )}
    </div>
  );
}

export function PhotoGrid({ photos, sport }: { photos: { id: number; caption?: string | null }[]; sport?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  if (photos.length === 0) return null;
  return (
    <>
      <div className="grid grid-cols-3 gap-1.5">
        {photos.map((p, i) => (
          <figure key={p.id} className="relative overflow-hidden ">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${p.id}`}
              alt={p.caption ?? "Foto da atividade"}
              onClick={() => setIndex(i)}
              className="aspect-square w-full cursor-zoom-in object-cover"
            />
            {i === 0 && sport ? (
              <figcaption className="absolute bottom-1 left-1 rounded-full bg-ink/75 px-2 py-0.5 text-[9px] font-bold text-lime">
                capa
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
      <Lightbox photos={photos} index={index} onClose={() => setIndex(null)} onIndexChange={setIndex} />
    </>
  );
}

export function PhotoStrip({ photos, size = 78 }: { photos: { id: number; caption?: string | null }[]; size?: number }) {
  const [index, setIndex] = useState<number | null>(null);
  if (photos.length === 0) return null;
  return (
    <>
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
        {photos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.id}
            src={`/api/photos/${p.id}`}
            alt={p.caption ?? "Foto da atividade"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIndex(i);
            }}
            className="shrink-0 cursor-zoom-in  object-cover hairline"
            style={{ width: size, height: size }}
          />
        ))}
      </div>
      <Lightbox photos={photos} index={index} onClose={() => setIndex(null)} onIndexChange={setIndex} />
    </>
  );
}
