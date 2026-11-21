"use client";

import dynamic from "next/dynamic";
import type { MapCanvasProps } from "./MapCanvas";

/**
 * Wrapper de carregamento do mapa.
 *
 * `next/dynamic` com `ssr: false` é obrigatório aqui por dois motivos:
 *
 *  1. O MapLibre acessa `window`, `document` e WebGL na inicialização. Renderizar
 *     no servidor gera erro de hidratação ou um nó vazio.
 *  2. **O bug real que este wrapper corrige:** com a importação estática do CSS
 *     dentro de um Client Component importado por Server Components, o Turbopack
 *     extraía o CSS como asset (`.next/static/media/maplibre-gl.*.css`) e o chunk
 *     de JS da biblioteca (1.09 MB) **não era referenciado** pelas páginas —
 *     sem `<script>`, sem preload, sem hint de import dinâmico. O
 *     `await import("maplibre-gl")` dentro do `useEffect` então rejeitava em
 *     silêncio, `ready` nunca virava `true` e o componente ficava travado em
 *     "Carregando mapa…" — o mapa aparecia vazio/invisível. Com `dynamic()`,
 *     o Next cria uma fronteira de chunk corretamente ligada ao grafo da página.
 *
 * O `loading` mantém o mesmo visual do estado anterior, mas sempre some quando
 * o módulo carrega.
 */

const MapCanvasImpl = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="grid place-items-center bg-graphite text-[12px] text-muted" style={{ height: "100%" }}>
      <span className="shimmer">Carregando mapa…</span>
    </div>
  ),
});

export default function MapView(props: MapCanvasProps) {
  return <MapCanvasImpl {...props} />;
}

export type { MapCanvasProps };
export { DEFAULT_MAP_CENTER } from "./MapCanvas";
