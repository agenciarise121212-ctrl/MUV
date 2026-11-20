"use client";

import type { SVGProps } from "react";
import { LOGO_MARK, SPORT_ICONS, UI_ICONS, type Shape } from "./icon-paths";

/** Ícones para Client Components — mesma grade visual, módulo dedicado. */

type IconProps = SVGProps<SVGSVGElement> & { filled?: boolean };

function Glyph({ shapes, filled, ...props }: IconProps & { shapes: Shape[] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {shapes.map((s, i) => (
        <path key={i} d={s.d} fill={s.fill || filled ? "currentColor" : "none"} strokeDasharray={s.dash ? "3 2.4" : undefined} />
      ))}
    </svg>
  );
}

function render(key: string, props: IconProps) {
  const shapes = UI_ICONS[key];
  if (!shapes) return null;
  const { filled, ...rest } = props;
  return <Glyph shapes={shapes} filled={filled} {...rest} />;
}

export const Icon = {
  home: (p: IconProps) => render("home", p),
  feed: (p: IconProps) => render("feed", p),
  trophy: (p: IconProps) => render("trophy", p),
  user: (p: IconProps) => render("user", p),
  record: (p: IconProps) => render("record", p),
  play: (p: IconProps) => render("play", p),
  pause: (p: IconProps) => render("pause", p),
  stop: (p: IconProps) => render("stop", p),
  camera: (p: IconProps) => render("camera", p),
  heart: (p: IconProps) => render("heart", p),
  comment: (p: IconProps) => render("comment", p),
  share: (p: IconProps) => render("share", p),
  trash: (p: IconProps) => render("trash", p),
  chevron: (p: IconProps) => render("chevron", p),
  back: (p: IconProps) => render("back", p),
  close: (p: IconProps) => render("close", p),
  menu: (p: IconProps) => render("menu", p),
  sat: (p: IconProps) => render("sat", p),
  pin: (p: IconProps) => render("pin", p),
  route: (p: IconProps) => render("route", p),
  chart: (p: IconProps) => render("chart", p),
  layers: (p: IconProps) => render("layers", p),
  flame: (p: IconProps) => render("flame", p),
  coin: (p: IconProps) => render("coin", p),
  bolt: (p: IconProps) => render("bolt", p),
  arrow: (p: IconProps) => render("arrow", p),
  check: (p: IconProps) => render("check", p),
  lock: (p: IconProps) => render("lock", p),
  clock: (p: IconProps) => render("clock", p),
  mountain: (p: IconProps) => render("mountain", p),
  map: (p: IconProps) => render("map", p),
};

export function SportIcon({ sport, className }: { sport: string; className?: string }) {
  const shapes = SPORT_ICONS[sport] ?? SPORT_ICONS.run;
  return <Glyph shapes={shapes} className={className} />;
}

export function LogoMark({ className, accent, style }: { className?: string; accent?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" className={className} style={style} aria-hidden="true">
      <path d={LOGO_MARK} fill={accent ?? "var(--lime)"} />
      <path d="M2 30.5h28" stroke="currentColor" strokeWidth={2} opacity={0.35} />
    </svg>
  );
}

export function Logo({ className = "", size = 20, accent }: { className?: string; size?: number; accent?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className="shrink-0" accent={accent} style={{ width: size, height: size }} />
      <span className="font-display font-black uppercase leading-none tracking-[0.14em]" style={{ fontSize: size * 0.82 }}>
        MUV
      </span>
    </span>
  );
}
