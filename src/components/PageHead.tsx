import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";

// Cabeçalho compacto estilo app: barra fixa + título grande
export default function PageHead({ eyebrow, title, back, action, children }: { eyebrow?: string; title: ReactNode; back?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <>
      <div className="sticky top-0 z-[500] -mx-4 px-2 bg-ink/94 backdrop-blur-md border-b border-line flex items-center h-12" style={{ paddingTop: "env(safe-area-inset-top)", height: "calc(3rem + env(safe-area-inset-top))" }}>
        {back ? <Link href={back} aria-label="Voltar" className="tap w-10 h-10 flex items-center justify-center text-bone"><Icon name="back" /></Link> : <span className="w-3" />}
        <span className="flex-1 text-[15px] font-semibold truncate">{typeof title === "string" ? title : eyebrow}</span>
        {action && <div className="flex items-center gap-1 pr-1">{action}</div>}
      </div>
      {(eyebrow || children) && (
        <div className="pt-5 pb-4">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          {children}
        </div>
      )}
    </>
  );
}
