import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CopyTextButton } from "@/components/features/dashboard/copy-text-button";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { MetricsCurve, type CurvePoint } from "@/components/features/dashboard/posts/metrics-curve";
import { PostFeaturesList } from "@/components/features/dashboard/posts/post-features-list";
import { RefreshMetricsButton } from "@/components/features/dashboard/posts/refresh-metrics-button";
import { RenderThumbnail } from "@/components/features/dashboard/render-thumbnail";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/dashboard/format";
import { getPostDetail, type MetricPoint } from "@/lib/dashboard/posts-data";
import { PLATFORM_LABELS } from "@/lib/dashboard/social-meta";

export const metadata: Metadata = { title: "Gönderi — betrix.pro" };
export const dynamic = "force-dynamic";

function ageLabel(point: MetricPoint): string {
  if (point.checkpoint) return point.checkpoint.replace("h", " sa").replace("d", " g");
  return point.ageHours < 48 ? `${Math.round(point.ageHours)} sa` : `${Math.round(point.ageHours / 24)} g`;
}

function toCurve(points: MetricPoint[]): CurvePoint[] {
  return points
    .filter((point) => point.trigger !== "IMPORT")
    .map((point) => ({
      label: ageLabel(point),
      reach: point.reach,
      views: point.views ?? point.impressions,
      likes: point.likes,
      comments: point.comments,
      shares: point.shares,
      saves: point.saves,
    }));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold text-white tabular-nums">{value}</span>
    </div>
  );
}

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPostDetail(id);
  if (!post) notFound();
  const published = post.publishedAt ? format(new Date(post.publishedAt), "d MMMM yyyy, HH:mm", { locale: tr }) : "—";

  return (
    <>
      <PageHeader
        title={`${PLATFORM_LABELS[post.platform]} gönderisi`}
        description={`${published}${post.source === "IMPORTED" ? " · platformdan içe aktarıldı" : " · panelden paylaşıldı"}`}
        actions={
          <Link href="/dashboard/posts" className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeft className="size-3.5" />
            Gönderiler
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-black/30">
              <RenderThumbnail src={post.thumbnailUrl ?? post.mediaUrls[0] ?? null} alt="Gönderi görseli" iconClassName="size-8" />
            </div>
            <p className="whitespace-pre-wrap text-sm text-white">{post.caption || "—"}</p>
            <div className="flex flex-wrap gap-2">
              {post.permalink ? (
                <a href={post.permalink} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <ExternalLink className="size-3.5" />
                  Platformda aç
                </a>
              ) : null}
              {post.aiContentId ? (
                <Link href={`/dashboard/drafts/${post.aiContentId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Taslağı aç
                </Link>
              ) : null}
            </div>
            <RefreshMetricsButton postId={post.id} label="Şimdi güncelle" />
            {post.job ? (
              <p className="text-[11px] text-muted-foreground">
                Otomatik çekim: {post.job.status === "DONE" ? "takvim tamamlandı" : `sonraki ${format(new Date(post.job.nextRunAt), "d MMM HH:mm", { locale: tr })}`}
                {post.job.lastError ? ` · son not: ${post.job.lastError}` : ""}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Metriklerin zaman içindeki eğrisi</CardTitle>
              <CardDescription>Yayından sonra 1 sa → 30 g ölçümler ({formatNumber(post.points.length)} çekim)</CardDescription>
            </CardHeader>
            <CardContent>
              <MetricsCurve points={toCurve(post.points)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Siteye dönüş</CardTitle>
              <CardDescription>{"Kısa link tıklamaları ve checkmatch.net'e bu gönderiden gelen ziyaretler (bot hariç)"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Kısa link tıklaması" value={formatNumber(post.site.linkClicks)} />
                <Stat label="Tekil ziyaretçi" value={formatNumber(post.site.uniqueVisitors)} />
                <Stat label="Oturum" value={formatNumber(post.site.sessions)} />
                <Stat label="Oturum başına sayfa" value={post.site.pagesPerSession === null ? "—" : String(post.site.pagesPerSession)} />
              </div>
              {post.shortLink ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Kısa link:</span>
                  <code className="rounded bg-black/30 px-2 py-1 text-white">{post.shortLink.url}</code>
                  <CopyTextButton text={post.shortLink.url} label="Kopyala" />
                </div>
              ) : null}
              {post.site.topPages.length > 0 ? (
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-[11px] text-muted-foreground">En çok gezilen sayfalar</span>
                  {post.site.topPages.map((page) => (
                    <div key={page.path} className="flex justify-between gap-3">
                      <span className="truncate text-white">{page.path}</span>
                      <span className="tabular-nums text-muted-foreground">{formatNumber(page.views)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Bu gönderiden henüz site ziyareti yok.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analiz özellikleri</CardTitle>
              <CardDescription>{"Yayın anında kaydedildi — “hangi saat / içerik / kelime daha çok etkileşim getiriyor” analizinin girdisi"}</CardDescription>
            </CardHeader>
            <CardContent>
              <PostFeaturesList features={post.features} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
