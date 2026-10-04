import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MIN_INSIGHT_SAMPLE } from "@/lib/dashboard/content-insights-stats";
import { formatNumber, formatPercent } from "@/lib/dashboard/format";
import { STAT_LABELS } from "@/lib/dashboard/social-meta";
import { cn } from "@/lib/utils";
import type { ContentInsights, StatInsight } from "@/types/social";

const decimal = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });

function formatLift(lift: number | null): string {
  if (lift === null) return "—";
  return `${lift >= 0 ? "+" : ""}${formatPercent(lift)}`;
}

function liftClass(insight: StatInsight): string {
  if (insight.lift === null || insight.lowSample) return "text-muted-foreground";
  return insight.lift >= 0 ? "text-emerald-400" : "text-rose-400";
}

function Headline({ insights }: { insights: ContentInsights }) {
  const winner = insights.stats.find((insight) => insight.stat === insights.winner);
  if (winner && winner.lift !== null) {
    return (
      <p className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-300">
        <strong>{STAT_LABELS[winner.stat]}</strong> içeren gönderiler, içermeyenlere göre{" "}
        <strong>{formatLift(winner.lift)}</strong> daha yüksek etkileşim oranı alıyor ({formatNumber(winner.postsWith)}{" "}
        gönderi). Sonraki içerik planında bu istatistiğe öncelik verin.
      </p>
    );
  }
  return (
    <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
      Henüz net bir kazanan yok — her karşılaştırma grubunda en az {MIN_INSIGHT_SAMPLE} gönderi gerekiyor. Taslakları
      gönderilere bağlayıp metrikleri senkronize ettikçe bu analiz netleşir.
    </p>
  );
}

/** "Hangi istatistik türü daha çok etkileşim getiriyor?" — içerik planlama özeti. */
export function ContentInsightsCard({ insights }: { insights: ContentInsights }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-4 text-amber-400" />
          İçerik Stratejisi: Hangi İstatistik Tutuyor?
        </CardTitle>
        <CardDescription>
          AI içeriği bağlı {formatNumber(insights.analyzedPosts)} yayınlanmış gönderi — istatistiği içerenlerin etkileşim
          oranı, içermeyenlerle karşılaştırılır. Yön gösterir; maç büyüklüğü ve platform etkisi ayrıştırılmaz.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Headline insights={insights} />
        {insights.analyzedPosts > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>İstatistik</TableHead>
                <TableHead className="text-right">Gönderi (var / yok)</TableHead>
                <TableHead className="text-right">Etkileşim (var)</TableHead>
                <TableHead className="text-right">Etkileşim (yok)</TableHead>
                <TableHead className="text-right">Fark</TableHead>
                <TableHead className="text-right">Ort. yorum</TableHead>
                <TableHead className="text-right">Ort. kaydetme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insights.stats.map((insight) => (
                <TableRow key={insight.stat}>
                  <TableCell className="text-white">
                    <span className="flex items-center gap-2">
                      {STAT_LABELS[insight.stat]}
                      {insight.lowSample ? <Badge variant="outline">az veri</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(insight.postsWith)} / {formatNumber(insight.postsWithout)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(insight.engagementWith)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(insight.engagementWithout)}</TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", liftClass(insight))}>
                    {formatLift(insight.lift)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{decimal.format(insight.avgCommentsWith)}</TableCell>
                  <TableCell className="text-right tabular-nums">{decimal.format(insight.avgSavesWith)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
