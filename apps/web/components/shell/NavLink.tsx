"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" || pathname.startsWith("/traces") : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`relative px-2 py-3 text-[13px] ${active ? "text-ink" : "text-muted hover:text-ink"}`}
    >
      {children}
      {active && <span className="absolute inset-x-2 -bottom-px h-px bg-accent" />}
    </Link>
  );
}
