import Link from "next/link";
import { PLATFORM_DOT_CLASS, PLATFORM_LABELS, SORT_LABELS } from "@/lib/dashboard/social-meta";
import { SLUG_TO_PLATFORM } from "@/lib/services/social/platforms";
import { cn } from "@/lib/utils";
import { ANALYTICS_SORTS, type AnalyticsSort } from "@/types/social";
import { PLATFORM_SLUGS, type PlatformSlug } from "@/types/social-connection";

export interface AnalyticsFilterState {
  sort: AnalyticsSort;
  platform: PlatformSlug | null;
}

interface AnalyticsFiltersProps extends AnalyticsFilterState {
  /** Tüm filtre durumu URL'dedir (bkz. CLAUDE.md 1.8) — değişiklik yeni bir href'tir. */
  href: (patch: Partial<AnalyticsFilterState>) => string;
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
        active ? "bg-card text-white shadow-sm" : "text-muted-foreground hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}

/** Sıralama ölçütü ("En Çok Yorum Alan" vb.) ve platform filtresi. */
export function AnalyticsFilters({ sort, platform, href }: AnalyticsFiltersProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-1">
        {ANALYTICS_SORTS.map((option) => (
          <Chip key={option} href={href({ sort: option })} active={option === sort}>
            {SORT_LABELS[option]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-muted/50 p-1">
        <Chip href={href({ platform: null })} active={platform === null}>
          Tüm platformlar
        </Chip>
        {PLATFORM_SLUGS.map((slug) => {
          const type = SLUG_TO_PLATFORM[slug];
          return (
            <Chip key={slug} href={href({ platform: slug })} active={platform === slug}>
              <span className={cn("size-2 rounded-full", PLATFORM_DOT_CLASS[type])} />
              {PLATFORM_LABELS[type]}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}
