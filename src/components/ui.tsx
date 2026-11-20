import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Primitivas de interface — módulo exclusivo de Server Components.
 * Não importa nada de módulos "use client".
 */

function ChevronGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9.4 6.4 5.6 5.6-5.6 5.6" />
    </svg>
  );
}

export function Card({ children, className = "", as = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "li" }) {
  const Tag = as;
  return <Tag className={`surface ${className}`}>{children}</Tag>;
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "lime" | "flame" | "sky" | "gold" }) {
  const tones: Record<string, string> = {
    muted: "border-line text-muted",
    lime: "border-lime/40 text-lime",
    flame: "border-flame/40 text-flame",
    sky: "border-sky/40 text-sky",
    gold: "border-amber-400/40 text-amber-300",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2 py-[3px] text-[10px] font-display font-bold uppercase tracking-[0.14em] ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function StatTile({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[9px] font-display font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="metric mt-1 truncate text-xl font-extrabold" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {hint ? <p className="tabular text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({ pct, color = "var(--lime)" }: { pct: number; color?: string }) {
  return (
    <div className="h-[3px] w-full bg-graphite-2">
      <div className="h-full transition-all duration-500" style={{ width: `${Math.min(100, Math.max(1.5, pct))}%`, background: color }} />
    </div>
  );
}

export function SectionTitle({ title, action, href, eyebrow }: { title: string; action?: string; href?: string; eyebrow?: string }) {
  return (
    <div className="mb-4">
      {eyebrow ? <p className="eyebrow mb-1.5">{eyebrow}</p> : null}
      <div className="flex items-end justify-between gap-3">
        <h2 className="display-2 text-[17px]">{title}</h2>
        {action && href ? (
          <Link href={href} className="group inline-flex items-center gap-1 text-[11px] font-display font-bold uppercase tracking-[0.12em] text-lime">
            {action}
            <ChevronGlyph className="size-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function EmptyState({
  emoji,
  title,
  description,
  cta,
  href,
  icon,
}: {
  emoji?: string;
  title: string;
  description: string;
  cta?: string;
  href?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="surface px-5 py-9 text-center">
      <div className="mx-auto mb-3 grid size-11 place-items-center border border-line text-muted">
        {icon ?? <span className="text-lg">{emoji ?? "—"}</span>}
      </div>
      <p className="display-2 text-[15px]">{title}</p>
      <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-muted">{description}</p>
      {cta && href ? (
        <Link href={href} className="btn btn-primary mt-5">
          {cta}
        </Link>
      ) : null}
    </div>
  );
}

export function DataRow({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <span className="text-[9px] font-display font-bold uppercase tracking-[0.16em] text-muted">{label}</span>
      <span className="metric text-[13px] font-bold" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
    </div>
  );
}
