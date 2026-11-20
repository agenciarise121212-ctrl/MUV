import Link from "next/link";
export default function Tabs({ base, tabs, active }: { base: string; tabs: { k: string; l: string; n?: number }[]; active: string }) {
  return (
    <div className="sticky z-[400] -mx-4 px-4 bg-ink/94 backdrop-blur-md border-b border-line flex gap-5 overflow-x-auto no-scrollbar" style={{ top: "calc(3rem + env(safe-area-inset-top))" }}>
      {tabs.map((t) => (
        <Link key={t.k} href={`${base}?tab=${t.k}`} replace scroll={false} className={`tap shrink-0 h-11 flex items-center gap-1.5 text-[13px] border-b-2 transition-colors ${active === t.k ? "border-lime text-bone font-semibold" : "border-transparent text-mute"}`}>
          {t.l}{t.n != null && <span className="num text-[11px] text-mute">{t.n}</span>}
        </Link>
      ))}
    </div>
  );
}
