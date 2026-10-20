import Link from "next/link";
import { NavLink } from "./NavLink";

export function Header() {
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex h-11 max-w-[1400px] items-center gap-5 px-4">
        <Link href="/" className="num text-[14px] font-medium tracking-tight">
          retrace<span className="text-accent">_</span>
        </Link>
        <nav className="flex items-center">
          <NavLink href="/">Traces</NavLink>
          <NavLink href="/run">Run agent</NavLink>
          <NavLink href="/settings">Settings</NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[12px]">
          <span className="label hidden sm:inline">project</span>
          <span className="num hidden sm:inline">demo</span>
          <a href="https://github.com/NeelParihar/retrace" className="text-muted hover:text-ink">
            source ↗
          </a>
        </div>
      </div>
    </header>
  );
}
