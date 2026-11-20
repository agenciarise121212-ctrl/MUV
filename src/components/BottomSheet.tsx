"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export default function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => { if (!open) setDrag(0); }, [open]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className={`fixed inset-0 mx-auto max-w-[480px] z-[900] ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/55 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
      <div role="dialog" aria-label={title}
        className={`absolute bottom-0 inset-x-0 bg-graphite border-t border-line rounded-t-[22px] max-h-[85dvh] flex flex-col ${start.current == null ? "transition-transform duration-[400ms] ease-out-expo" : ""}`}
        style={{ transform: open ? `translateY(${drag}px)` : "translateY(100%)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="pt-2.5 pb-1 touch-none cursor-grab"
          onPointerDown={(e) => { start.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (start.current != null) setDrag(Math.max(0, e.clientY - start.current)); }}
          onPointerUp={() => { const d = drag; start.current = null; if (d > 90) onClose(); else setDrag(0); }}>
          <div className="mx-auto w-10 h-1 rounded-full bg-bone/25" />
          {title && <div className="px-5 pt-3 pb-1 text-[15px] font-semibold">{title}</div>}
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
