"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const tabs = [
  { href: "/map", label: "Mapa", icon: "map" },
  { href: "/missions", label: "Missões", icon: "flag" },
  { href: "/", label: "Início", icon: "home", center: true },
  { href: "/record", label: "Atividade", icon: "activity" },
  { href: "/profile", label: "Perfil", icon: "user" },
];

export default function BottomNav() {
  const path = usePathname();
  if (path.startsWith("/welcome")) return null;
  const isActive = (h: string) => (h === "/" ? path === "/" || path === "/feed" : path === h || path.startsWith(h + "/") || (h === "/profile" && path.startsWith("/activities") && !/^\/activities\/\d+/.test(path)));
  return (
    <nav aria-label="Navegação principal" className="fixed bottom-0 inset-x-0 mx-auto max-w-[480px] z-[600] bg-ink/96 backdrop-blur-md border-t border-line" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="grid grid-cols-5 h-[var(--nav-h)] items-center">
        {tabs.map((t) => {
          const on = isActive(t.href);
          if (t.center) return (
            <li key={t.href} className="flex justify-center">
              <Link href={t.href} aria-current={on ? "page" : undefined} aria-label={t.label}
                className={`tap w-[52px] h-[52px] -mt-3 rounded-[18px] flex items-center justify-center transition-all duration-300 ease-out-expo ${on ? "bg-lime text-ink" : "bg-graphite text-lime border border-line"}`}>
                <Icon name={t.icon} size={24} strokeWidth={on ? 2 : 1.7} />
              </Link>
            </li>
          );
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={on ? "page" : undefined} className={`tap relative flex flex-col items-center justify-center gap-1 h-[var(--nav-h)] text-[10px] font-medium tracking-wide transition-colors ${on ? "text-bone" : "text-mute"}`}>
                <span className={`absolute top-0 h-[2px] w-6 bg-lime transition-transform duration-300 ${on ? "scale-x-100" : "scale-x-0"}`} />
                <Icon name={t.icon} size={22} strokeWidth={on ? 1.9 : 1.6} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
