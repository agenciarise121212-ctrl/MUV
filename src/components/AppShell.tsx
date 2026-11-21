"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { levelFromXp } from "@/lib/levels";
import { Avatar } from "@/components/Avatar";
import { Icon, LogoMark } from "@/components/icons.client";

type Tab = { href: string; label: string; icon: "map" | "trophy" | "start" | "record" | "user" };

const TABS: Tab[] = [
  { href: "/app/map", label: "Mapa", icon: "map" },
  { href: "/app/missions", label: "Missões", icon: "trophy" },
  { href: "/app", label: "Início", icon: "start" },
  { href: "/app/record", label: "Atividade", icon: "record" },
  { href: "/app/profile", label: "Perfil", icon: "user" },
];

function TabGlyph({ icon, active }: { icon: Tab["icon"]; active: boolean }) {
  if (icon === "start") {
    return <LogoMark className="size-[26px]" accent={active ? "#101112" : "currentColor"} />;
  }
  if (icon === "map") return <Icon.map className="size-[22px]" />;
  if (icon === "trophy") return <Icon.trophy className="size-[22px]" />;
  if (icon === "record") return <Icon.record className="size-[22px]" />;
  return <Icon.user className="size-[22px]" />;
}

/**
 * Estrutura de aplicativo nativo:
 * - cabeçalho compacto fixo
 * - conteúdo com rolagem natural
 * - barra inferior fixa com 5 posições e botão INÍCIO central em destaque
 */
export function AppShell({
  children,
  user,
  title,
  backHref,
  hideNav,
  subtitle,
  right,
}: {
  children: ReactNode;
  user: { name: string; username: string; avatarColor: string; xp: number; coins: number };
  title?: string;
  backHref?: string;
  hideNav?: boolean;
  subtitle?: string;
  right?: ReactNode;
}) {
  const pathname = usePathname();
  const lvl = levelFromXp(user.xp);
  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  return (
    <>
      <header className="app-header">
        <div className="flex h-[54px] items-center gap-3 px-4">
          {backHref ? (
            <Link href={backHref} aria-label="Voltar" className="tap shrink-0">
              <Icon.back className="size-[18px]" />
            </Link>
          ) : (
            <Link href="/app/profile" aria-label="Perfil" className="shrink-0">
              <Avatar name={user.name} color={user.avatarColor} size={32} />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <p className="display-2 truncate text-[14px]">{title ?? user.name.split(" ")[0]}</p>
            {subtitle ? (
              <p className="truncate text-[10px] text-muted">{subtitle}</p>
            ) : !title ? (
              <p className="truncate text-[10px] text-muted">
                Nv.{lvl.level} {lvl.title} · {formatXp(user.xp)} XP
              </p>
            ) : null}
          </div>
          {right ?? (
            <span className="metric flex shrink-0 items-center gap-1.5 border border-line px-2 py-1 text-[11px] font-bold text-lime">
              <Icon.coin className="size-3" />
              {user.coins}
            </span>
          )}
        </div>
      </header>

      <main className={`app-body px-4 pt-4 ${hideNav ? "" : ""}`}>{children}</main>

      {!hideNav ? (
        <nav className="tabbar" aria-label="Navegação principal">
          <ul className="grid grid-cols-5">
            {TABS.map((tab) => {
              const active = isActive(tab.href);
              if (tab.icon === "start") {
                return (
                  <li key={tab.href} className="flex justify-center">
                    <Link
                      href={tab.href}
                      aria-label="Início"
                      aria-current={active ? "page" : undefined}
                      className="tabbar-start"
                      data-active={active}
                    >
                      <TabGlyph icon="start" active={active} />
                    </Link>
                  </li>
                );
              }
              return (
                <li key={tab.href}>
                  <Link href={tab.href} className="tabbar-item" data-active={active} aria-current={active ? "page" : undefined}>
                    <TabGlyph icon={tab.icon} active={active} />
                    <span>{tab.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </>
  );
}

function formatXp(xp: number) {
  return xp.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** Lista horizontal de atalhos usada nas telas internas. */
export function QuickRow({ items }: { items: { href: string; label: string; icon: "pin" | "layers" | "chart" | "trophy" }[] }) {
  return (
    <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
      {items.map((i) => (
        <li key={i.href} className="shrink-0">
          <Link href={i.href} className="surface hover-lift flex items-center gap-2 px-3 py-2.5 text-[11px] font-display font-bold uppercase tracking-[0.1em]">
            {i.icon === "pin" ? <Icon.pin className="size-4 text-lime" /> : null}
            {i.icon === "layers" ? <Icon.layers className="size-4 text-lime" /> : null}
            {i.icon === "chart" ? <Icon.chart className="size-4 text-lime" /> : null}
            {i.icon === "trophy" ? <Icon.trophy className="size-4 text-lime" /> : null}
            {i.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}


const MENU = [
  { href: "/app/activities", label: "Histórico de atividades", icon: "feed" as const },
  { href: "/app/map", label: "Mapa e exploração", icon: "map" as const },
  { href: "/app/missions", label: "Missões e desafios", icon: "trophy" as const },
  { href: "/app/segments", label: "Segmentos", icon: "pin" as const },
  { href: "/app/rewards", label: "Conquistas e recompensas", icon: "trophy" as const },
  { href: "/app/compare", label: "Comparar atividades", icon: "chart" as const },
  { href: "/app/territories", label: "Territórios", icon: "layers" as const },
  { href: "/preview", label: "Simulador mobile", icon: "chart" as const },
];

/** Menu de seções usado no Perfil. */
export function ProfileMenu() {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {MENU.map((m) => {
        const Ico = m.icon === "pin" ? Icon.pin : m.icon === "layers" ? Icon.layers : m.icon === "chart" ? Icon.chart : m.icon === "trophy" ? Icon.trophy : Icon.feed;
        return (
          <li key={m.href}>
            <Link href={m.href} className="flex items-center gap-3 py-3.5 transition-colors active:bg-graphite">
              <Ico className="size-[18px] text-muted" />
              <span className="min-w-0 flex-1 text-[13px] font-medium">{m.label}</span>
              <Icon.chevron className="size-3.5 text-muted" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
