import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompactNumber, formatNumber, formatPercent } from "@/lib/dashboard/format";
import { ANALYTICS_SOURCE_LABELS, PLATFORM_DOT_CLASS, SORT_LABELS } from "@/lib/dashboard/social-meta";
import { cn } from "@/lib/utils";
import type { AnalyticsSort, PostAnalyticsSummary, TopPostItem } from "@/types/social";
import { AnalyticsFilters, type AnalyticsFilterState } from "./analytics-filters";

type CountColumn = "views" | "reach" | "likes" | "comments" | "shares" | "saves";

const COUNT_COLUMNS: { key: CountColumn; label: string }[] = [
  { key: "views", label: "İzlenme" },
  { key: "reach", label: "Erişim" },
  { key: "likes", label: "Beğeni" },
  { key: "comments", label: "Yorum" },
  { key: "shares", label: "Paylaşım" },
  { key: "saves", label: "Kaydetme" },
];

interface TopPostsTableProps extends AnalyticsFilterState {
  items: TopPostItem[];
  fixtureLabels: Record<string, string>;
  /** Filtre ve metrik girme bağlantıları — tamamı URL tabanlı. */
  href: (patch: Partial<AnalyticsFilterState>) => string;
  metricsHref: (postId: string) => string;
}

/** Sıralama ölçütüne karşılık gelen sütun vurgulanır. */
const highlight = (sort: AnalyticsSort, column: AnalyticsSort) =>
  sort === column ? "font-semibold text-white" : undefined;

const countOf = (analytics: PostAnalyticsSummary | null, key: CountColumn) => analytics?.[key] ?? 0;

export function TopPostsTable({ items, sort, platform, fixtureLabels, href, metricsHref }: TopPostsTableProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-amber-400" />
            En Başarılı Gönderiler — {SORT_LABELS[sort]}
          </CardTitle>
          <CardDescription>Yayınlanmış gönderiler, seçilen ölçüte göre ilk 10</CardDescription>
        </div>
        <AnalyticsFilters sort={sort} platform={platform} href={href} />
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Bu filtrede yayınlanmış gönderi yok. Takvimden bir gönderiyi &quot;Paylaşıldı&quot; yapınca burada görünür.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8">#</TableHead>
                <TableHead>Gönderi</TableHead>
                {COUNT_COLUMNS.map((column) => (
                  <TableHead key={column.key} className={cn("text-right", highlight(sort, column.key))}>
                    {column.label}
                  </TableHead>
                ))}
                <TableHead className={cn("text-right", highlight(sort, "engagement"))}>Etkileşim</TableHead>
                <TableHead className={cn("text-right", highlight(sort, "clicks"))}>Tıklama</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(({ post, engagementRate, clickThroughRate }, index) => (
                <TableRow key={post.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                  <TableCell className="max-w-56">
                    <div className="flex items-center gap-2 text-white">
                      <span className={cn("size-2 shrink-0 rounded-full", PLATFORM_DOT_CLASS[post.platform.type])} />
                      <span className="truncate">{fixtureLabels[post.fixtureId] ?? post.fixtureId}</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {post.platform.displayName} ·{" "}
                      {format(new Date(post.publishedAt ?? post.scheduledFor), "d MMM", { locale: tr })}
                      {post.analytics ? ` · ${ANALYTICS_SOURCE_LABELS[post.analytics.source]}` : " · metrik yok"}
                    </div>
                  </TableCell>
                  {COUNT_COLUMNS.map((column) => (
                    <TableCell key={column.key} className={cn("text-right tabular-nums", highlight(sort, column.key))}>
                      {formatCompactNumber(countOf(post.analytics, column.key))}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium text-emerald-400 tabular-nums">
                    {formatPercent(engagementRate)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", highlight(sort, "clicks"))}>
                    {formatNumber(post.trafficCount)}
                    <span className="ml-1 text-[10px] text-muted-foreground">({formatPercent(clickThroughRate)})</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={metricsHref(post.id)} className={buttonVariants({ variant: "ghost", size: "xs" })}>
                      Metrik gir
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
