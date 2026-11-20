"use client";
import { useState } from "react";
import { emblemDef, SPRITE_COLS, SPRITE_ROWS, SPRITE_URL } from "@/lib/emblems";

type Props = { name: string; size?: number; className?: string; filter?: string; dim?: boolean; alt?: string };

// 1º: recorte transparente servido por /api/emblem (cacheado). 2º (fallback): recorte CSS direto da sprite no Imgur. 3º: marcador discreto.
export default function EmblemIcon({ name, size = 48, className = "", filter, dim, alt }: Props) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const def = emblemDef(name);
  const style = { width: size, height: size, filter: [filter && filter !== "none" ? filter : "", dim ? "grayscale(1) brightness(.55)" : ""].join(" ").trim() || undefined };
  if (stage === 0) return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/emblem/${name}`} alt={alt ?? def.label} width={size} height={size} decoding="async" loading="lazy" onError={() => setStage(1)} className={`object-contain select-none ${className}`} style={style} draggable={false} />
  );
  if (stage === 1) {
    const zoom = def.scale ?? 1.06; // leve zoom para esconder bordas de ícones vizinhos
    return (
      <span role="img" aria-label={alt ?? def.label} className={`inline-block overflow-hidden rounded-full bg-bone ${className}`} style={style}>
        <span className="block w-full h-full" style={def.overrideUrl
          ? { backgroundImage: `url(${def.overrideUrl})`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }
          : { backgroundImage: `url(${SPRITE_URL})`, backgroundSize: `${SPRITE_COLS * 100}% ${SPRITE_ROWS * 100}%`, backgroundPosition: `${(def.col / (SPRITE_COLS - 1)) * 100}% ${(def.row / (SPRITE_ROWS - 1)) * 100}%`, transform: `scale(${zoom})` }} />
      </span>
    );
  }
  return <span role="img" aria-label={alt ?? def.label} className={`inline-flex items-center justify-center rounded-full border border-line bg-graphite text-lime text-[10px] font-semibold ${className}`} style={{ width: size, height: size }}>{def.label.slice(0, 1)}</span>;
}

// Ícones extras no mesmo acabamento 3D (volume por gradientes) — moeda e XP
export function Coin3D({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="moedas">
      <defs><radialGradient id="cg" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#FFF4B0" /><stop offset=".45" stopColor="#F2C230" /><stop offset="1" stopColor="#9A6A0C" /></radialGradient></defs>
      <ellipse cx="16" cy="18" rx="13" ry="12.5" fill="#6B4806" />
      <circle cx="16" cy="15.5" r="13" fill="url(#cg)" stroke="#8A5C08" strokeWidth="1" />
      <circle cx="16" cy="15.5" r="9" fill="none" stroke="#FFE680" strokeOpacity=".7" strokeWidth="1.2" />
      <path d="M16 9.5l1.8 3.8 4.1.5-3 2.8.8 4.1L16 18.6l-3.7 2.1.8-4.1-3-2.8 4.1-.5z" fill="#B8820F" />
    </svg>
  );
}
export function Xp3D({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-label="XP">
      <defs><linearGradient id="xg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F3FFB8" /><stop offset=".5" stopColor="#D5FF45" /><stop offset="1" stopColor="#6E8A10" /></linearGradient></defs>
      <path d="M16 2l11 7v14l-11 7L5 23V9z" fill="#4A5E08" />
      <path d="M16 3.5l9.5 6v12L16 27.5 6.5 21.5v-12z" fill="url(#xg)" />
      <path d="M16 3.5v24M6.5 9.5l19 12M25.5 9.5l-19 12" stroke="#fff" strokeOpacity=".25" strokeWidth=".8" />
    </svg>
  );
}
