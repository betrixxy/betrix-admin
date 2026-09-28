"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DASHBOARD_NAV, LEGACY_NAV, isNavItemActive, type NavItem } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";

interface NavListProps {
  items: readonly NavItem[];
  pathname: string;
}

function SidebarList({ items, pathname }: NavListProps) {
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                active ? "bg-emerald-500/10 text-white" : "text-muted-foreground hover:bg-white/[0.04] hover:text-white",
              )}
            >
              <item.icon className={cn("size-4 shrink-0", active && "text-emerald-400")} />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-medium">{item.label}</span>
                <span className="truncate text-[10px] text-muted-foreground/70">{item.description}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Masaüstü sol menü içeriği: 4 ana modül + ikincil "diğer araçlar" grubu. */
export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-6" aria-label="Dashboard modülleri">
      <SidebarList items={DASHBOARD_NAV} pathname={pathname} />
      <div className="flex flex-col gap-1.5">
        <span className="px-3 text-[10px] font-medium tracking-wider text-muted-foreground/60 uppercase">
          Diğer araçlar
        </span>
        <SidebarList items={LEGACY_NAV} pathname={pathname} />
      </div>
    </nav>
  );
}

/** Mobil/dar ekran için yatay kaydırılabilir üst menü. */
export function TopBarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-4 pb-2" aria-label="Dashboard modülleri">
      {DASHBOARD_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
            isNavItemActive(pathname, item.href) ? "bg-emerald-500/10 text-white" : "text-muted-foreground",
          )}
        >
          <item.icon className="size-3.5" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
