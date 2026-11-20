"use client";

import Link from "next/link";
import { avatarColor, initials } from "@/lib/format";

export function Avatar({
  name,
  color,
  size = 40,
  href,
}: {
  name: string;
  color?: string | null;
  size?: number;
  href?: string;
}) {
  const style = {
    width: size,
    height: size,
    background: avatarColor(color),
    fontSize: Math.max(10, size * 0.34),
    color: "#101112",
  };
  const content = (
    <span style={style} className="grid shrink-0 place-items-center rounded-full font-display font-bold uppercase tracking-tight">
      {initials(name)}
    </span>
  );
  if (href) return <Link href={href} className="shrink-0">{content}</Link>;
  return <span className="shrink-0">{content}</span>;
}
