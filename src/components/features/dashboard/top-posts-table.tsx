import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompactNumber, formatNumber, formatPercent } from "@/lib/dashboard/format";
import { PLATFORM_DOT_CLASS } from "@/lib/dashboard/social-meta";
import { cn } from "@/lib/utils";
import { ANALYTICS_SORTS, type AnalyticsSort, type TopPostItem } from "@/types/social";

const SORT_LABELS: Record<AnalyticsSort, string> = {
  engagement: "Etkileşim oranı",
  views: "İzlenme",
  clicks: "Tıklama",
};

interface TopPostsTableProps {
  items: TopPostItem[];
  sort: AnalyticsSort;
  fixtureLabels: Record<string, string>;
  /** Sıralama değiştirme ve metrik girme bağlantıları — tamamı URL tabanlı. */
  sortHref: (sort: AnalyticsSort) => string;
  metricsHref: (postId: string) => string;
}

export function TopPostsTable({ items, sort, fixtureLabels, sortHref, metricsHref }: TopPostsTableProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="size-4 text-amber-400" />
            En Başarılı Gönderiler
          </CardTitle>
          <CardDescription>Yayınlanmış gönderiler, seçilen ölçüte göre sıralı</CardDescription>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
          {ANALYTICS_SORTS.map((option) => (
            <Link
              key={option}
              href={sortHref(option)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                option === sort ? "bg-card text-white shadow-sm" : "text-muted-foreground hover:text-white",
              )}
            >
              {SORT_LABELS[option]}
            </Link>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Henüz yayınlanmış gönderi yok. Takvimden bir gönderiyi &quot;Paylaşıldı&quot; yapınca burada görünür.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8">#</TableHead>
                <TableHead>Gönderi</TableHead>
                <TableHead className="text-right">İzlenme</TableHead>
                <TableHead className="text-right">Beğeni</TableHead>
                <TableHead className="text-right">Yorum</TableHead>
                <TableHead className="text-right">Paylaşım</TableHead>
                <TableHead className="text-right">Etkileşim</TableHead>
                <TableHead className="text-right">Tıklama</TableHead>
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
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompactNumber(post.analytics?.views ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompactNumber(post.analytics?.likes ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompactNumber(post.analytics?.comments ?? 0)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCompactNumber(post.analytics?.shares ?? 0)}</TableCell>
                  <TableCell className="text-right font-medium text-emerald-400 tabular-nums">
                    {formatPercent(engagementRate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
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
