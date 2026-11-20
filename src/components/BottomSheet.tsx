"use client";

import { useEffect } from "react";

/**
 * Bottom sheet adaptado para mobile.
 * Fecha por gesto no backdrop, no botão de fechar ou arrastando o grabber para baixo.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  eyebrow,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  let startY = 0;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        onTouchStart={(e) => {
          startY = e.touches[0]?.clientY ?? 0;
        }}
        onTouchEnd={(e) => {
          const delta = (e.changedTouches[0]?.clientY ?? 0) - startY;
          if (delta > 70) onClose();
        }}
      >
        <div className="sheet-grabber" />
        {title ? (
          <div className="flex items-start justify-between gap-3 px-5 pt-2 pb-3">
            <div className="min-w-0">
              {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
              <h2 className="display-2 truncate text-[17px]">{title}</h2>
            </div>
            <button type="button" onClick={onClose} className="tap shrink-0" aria-label="Fechar">
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <path d="M6.4 6.4l11.2 11.2M17.6 6.4 6.4 17.6" />
              </svg>
            </button>
          </div>
        ) : null}
        <div className="px-5 pb-2">{children}</div>
      </div>
    </>
  );
}
