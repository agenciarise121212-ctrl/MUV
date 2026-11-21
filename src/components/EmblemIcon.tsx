"use client";

import { useState } from "react";
import { EMBLEM_GRID, emblemSource, getEmblem, type EmblemKey } from "@/lib/emblems";

type Props = {
  emblem: EmblemKey | string | null | undefined;
  /** Largura/altura em px (quadrado). */
  size?: number;
  /** Zoom aplicado dentro da célula para cortar bordas de ícones vizinhos. */
  scale?: number;
  /** Anel externo na cor de acento da categoria. */
  ring?: boolean;
  className?: string;
  title?: string;
};

/**
 * Renderiza o recorte exato de uma célula da sprite sheet de brasões.
 * Técnica: a <img> é dimensionada como `cols × 100%` / `rows × 100%` do wrapper
 * e transladada por frações da própria largura, garantindo alinhamento exato da
 * célula em qualquer tamanho. `scale` > 1 aproxima a arte e elimina o sangramento
 * das células vizinhas sem precisar de novas imagens.
 */
export function EmblemIcon({
  emblem,
  size = 48,
  scale = 1.08,
  ring = true,
  className = "",
  title,
}: Props) {
  const def = getEmblem(emblem);
  const { url, row, col, isOverride } = emblemSource(emblem);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  const accent = def.accent;

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: "#0c0d0e",
        boxShadow: ring
          ? `0 0 0 1.5px ${accent}, 0 0 0 3px #101112, 0 0 0 4px rgba(245,245,242,0.08)`
          : "0 0 0 1px var(--color-line)",
      }}
      title={title ?? def.label}
    >
      {isOverride ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={def.label}
          decoding="async"
          loading={size <= 24 ? "eager" : "lazy"}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
          className="absolute inset-0 size-full object-cover"
          style={{ transform: `scale(${scale})` }}
        />
      ) : (
        <span
          className="absolute block"
          style={{ width: `${EMBLEM_GRID.cols * 100}%`, height: `${EMBLEM_GRID.rows * 100}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={def.label}
            decoding="async"
            loading={size <= 24 ? "eager" : "lazy"}
            onLoad={() => setState("ready")}
            onError={() => setState("error")}
            className="absolute block max-w-none select-none"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              transform: `translate(${-(col / EMBLEM_GRID.cols) * 100}%, ${-(row / EMBLEM_GRID.rows) * 100}%) scale(${scale})`,
              transformOrigin: `${((col + 0.5) / EMBLEM_GRID.cols) * 100}% ${((row + 0.5) / EMBLEM_GRID.rows) * 100}%`,
            }}
          />
        </span>
      )}

      {state !== "ready" ? (
        <span
          className={`absolute inset-0 grid place-items-center ${state === "loading" ? "shimmer" : ""}`}
          style={{ background: "rgba(12,13,14,0.82)" }}
        >
          {state === "error" ? (
            <svg viewBox="0 0 24 24" style={{ width: size * 0.5, height: size * 0.5 }} fill="none" stroke={accent} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20.6s6.4-6 6.4-10.4A6.4 6.4 0 0 0 5.6 10.2C5.6 14.6 12 20.6 12 20.6Z" />
              <circle cx="12" cy="10.2" r="2.2" />
            </svg>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
