import type { SVGProps } from "react";
import { LOGO_MARK, SPORT_ICONS, UI_ICONS, type Shape } from "./icon-paths";

/**
 * Ícones para Server Components — módulo SEM "use client".
 * Não exporta objetos com funções: apenas componentes nomeados.
 */

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

function make(key: string) {
  const shapes = UI_ICONS[key];
  return (props: IconProps) => <Glyph shapes={shapes} {...props} />;
}

export const IconSat = make("sat");
export const IconRecord = make("record");
export const IconChevron = make("chevron");
export const IconTrophy = make("trophy");
export const IconRoute = make("route");
export const IconCoin = make("coin");
export const IconPin = make("pin");
export const IconLayers = make("layers");
export const IconChart = make("chart");
export const IconArrow = make("arrow");
export const IconMountain = make("mountain");
export const IconMap = make("map");
export const IconFlame = make("flame");
export const IconClock = make("clock");
export const IconCheck = make("check");
export const IconBolt = make("bolt");
export const IconHome = make("home");
export const IconFeed = make("feed");
export const IconUser = make("user");
export const IconCamera = make("camera");
export const IconHeart = make("heart");
export const IconShare = make("share");

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
