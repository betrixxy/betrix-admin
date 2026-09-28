import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ImageOff } from "lucide-react";
import { PLATFORM_DOT_CLASS, STATUS_LABELS } from "@/lib/dashboard/social-meta";
import { cn } from "@/lib/utils";
import type { AiContentView } from "@/types/ai-content";
import type { SocialPostView, TopPostItem } from "@/types/social";
import type { TrafficSeriesPoint } from "@/types/traffic";

const emptyClass = "text-xs text-muted-foreground";

export function UpcomingPostsList({ posts, fixtureLabels }: { posts: SocialPostView[]; fixtureLabels: Record<string, string> }) {
  if (posts.length === 0) return <p className={emptyClass}>Yaklaşan gönderi yok — takvimden yeni bir gönderi planlayın.</p>;

  return (
    <ul className="flex flex-col gap-1.5">
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            href={`/dashboard/calendar?edit=${post.id}`}
            className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-muted/50"
          >
            <span className="flex min-w-0 items-center gap-2 text-white">
              <span className={cn("size-2 shrink-0 rounded-full", PLATFORM_DOT_CLASS[post.platform.type])} />
              <span className="truncate">{fixtureLabels[post.fixtureId] ?? post.fixtureId}</span>
            </span>
            <span className="shrink-0 text-muted-foreground">
              {format(new Date(post.scheduledFor), "d MMM HH:mm", { locale: tr })} · {STATUS_LABELS[post.status]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function BestPostLine({ item, fixtureLabels }: { item: TopPostItem | undefined; fixtureLabels: Record<string, string> }) {
  if (!item) return <p className={emptyClass}>Henüz yayınlanmış gönderi yok.</p>;
  return (
    <p className="text-xs text-muted-foreground">
      En başarılı gönderi:{" "}
      <span className="text-white">{fixtureLabels[item.post.fixtureId] ?? item.post.fixtureId}</span> ·{" "}
      {item.post.platform.displayName}
    </p>
  );
}

export function RecentRenders({ items }: { items: AiContentView[] }) {
  if (items.length === 0) return <p className={emptyClass}>Henüz üretilmiş görsel yok.</p>;
  return (
    <ul className="flex gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex h-20 w-16 items-center justify-center overflow-hidden rounded-md bg-muted/30 ring-1 ring-border"
        >
          {item.resultImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.resultImageUrl} alt="Üretilen görsel" loading="lazy" className="size-full object-contain" />
          ) : (
            <ImageOff className="size-4 text-muted-foreground" />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Son günlerin ziyaret sayısını gösteren, kütüphanesiz küçük çubuk grafik. */
export function VisitsSparkbars({ series }: { series: TrafficSeriesPoint[] }) {
  const max = Math.max(1, ...series.map((point) => point.visits));
  return (
    <div className="flex h-12 items-end gap-1" role="img" aria-label="Günlük ziyaret sayısı">
      {series.map((point) => (
        <div
          key={point.key}
          title={`${point.label}: ${point.visits}`}
          className="flex-1 rounded-sm bg-emerald-500/60"
          style={{ height: `${Math.max(6, (point.visits / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}
