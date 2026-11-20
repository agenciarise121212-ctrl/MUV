import type { ReactNode } from "react";
import { ensureAchievementCatalog } from "@/lib/gamification";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  await ensureAchievementCatalog();
  return <div id="app-frame">{children}</div>;
}
