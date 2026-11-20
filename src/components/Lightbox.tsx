"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { stampPhoto, type PhotoMeta } from "@/lib/stamp";

export default function Lightbox({ ids, index, onClose, meta, date }: { ids: number[]; index: number; onClose: () => void; meta?: Record<number, PhotoMeta>; date?: string }) {
  const [i, setI] = useState(index);
  const [stamping, setStamping] = useState(false);
  const m = meta?.[ids[i]];
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") setI((x) => Math.min(ids.length - 1, x + 1)); if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); };
    window.addEventListener("keydown", k); document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  }, [ids.length, onClose]);
  const nav = "absolute top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center border border-bone/20 text-bone hover:bg-bone hover:text-ink transition-colors";
  return (
    <div className="fixed inset-0 z-[1000] bg-ink/97 flex items-center justify-center rise" style={{ animationDuration: ".4s" }} onClick={onClose}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={ids[i]} src={`/api/photos/${ids[i]}`} alt="" className="max-w-[92vw] max-h-[86vh] object-contain rise" style={{ animationDuration: ".5s" }} onClick={(e) => e.stopPropagation()} />
      <button aria-label="Fechar" className="absolute top-5 right-5 text-bone p-2" onClick={onClose}><Icon name="close" /></button>
      <div className="absolute top-5 left-5 right-16 text-[12px] text-mute num truncate">{m?.kmMark != null ? `km ${m.kmMark.toFixed(2)}` : ""}{m?.takenAt ? `${m?.kmMark != null ? " · " : ""}${new Date(m.takenAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
      <button onClick={async (e) => { e.stopPropagation(); setStamping(true); try { await stampPhoto(ids[i], m ?? {}, date); } catch { alert("Não foi possível gerar a imagem."); } setStamping(false); }}
        className="absolute left-1/2 -translate-x-1/2 btn btn-lime btn-sm" style={{ bottom: "calc(52px + env(safe-area-inset-bottom))" }} disabled={stamping}>
        <Icon name="download" size={15} />{stamping ? "Gerando…" : "Baixar com Carimbo MUV"}
      </button>
      <div className="absolute bottom-6 num text-sm text-mute" style={{ marginBottom: "env(safe-area-inset-bottom)" }}>{String(i + 1).padStart(2, "0")} / {String(ids.length).padStart(2, "0")}</div>
      {i > 0 && <button aria-label="Anterior" className={`${nav} left-4`} onClick={(e) => { e.stopPropagation(); setI(i - 1); }}><Icon name="arrow" className="rotate-180" size={18} /></button>}
      {i < ids.length - 1 && <button aria-label="Próxima" className={`${nav} right-4`} onClick={(e) => { e.stopPropagation(); setI(i + 1); }}><Icon name="arrow" size={18} /></button>}
    </div>
  );
}
