import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CopyTextButton } from "@/components/features/dashboard/copy-text-button";
import { DraftDecisionForm } from "@/components/features/dashboard/draft-decision-form";
import { DraftPreview as Preview } from "@/components/features/dashboard/draft-preview";
import { DraftReviewForm } from "@/components/features/dashboard/draft-review-form";
import { DraftStatsCard } from "@/components/features/dashboard/draft-stats-card";
import { DraftStatusBadge } from "@/components/features/dashboard/draft-status-badge";
import { MarketAnalysisDraftView } from "@/components/features/dashboard/market-analysis-draft-view";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDraft, getLinkablePosts } from "@/lib/dashboard/draft-data";
import { STUDIO_FORMAT_DEFS } from "@/lib/dashboard/studio-formats";
import { isFalConfigured } from "@/lib/services/fal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Taslak İnceleme — betrix.pro",
  description: "AI içerik taslağını önizle, düzenle ve onayla",
};

export const dynamic = "force-dynamic";

const backLink = (
  <Link href="/dashboard/matches" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
    <ArrowLeft />
    Maç Merkezi
  </Link>
);

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lookup = await getDraft(id);
  if (!lookup) notFound();

  if (lookup.kind === "market-analysis") {
    const { draft } = lookup;
    const postOptions = draft.status === "DRAFT" ? await getLinkablePosts(draft.fixtureId) : [];
    return (
      <>
        <PageHeader
          title={`${draft.home.teamName} – ${draft.away.teamName}`}
          description="AI Market Tahmin & Analiz · iki takımın Derinlemesine Analiz kartı — onayınız olmadan yayına hazır sayılmaz."
          actions={backLink}
        />
        <MarketAnalysisDraftView draft={draft} postOptions={postOptions} />
      </>
    );
  }

  if (lookup.kind === "legacy") {
    return (
      <>
        <PageHeader title="Eski Kayıt" description="Bu görsel maç istatistiği anlık görüntüsü olmadan üretildi (ör. Maç Günü kartı veya eski bir kayıt) — yalnızca görüntülenebilir ve indirilebilir." actions={backLink} />
        <Card className="max-w-md">
          <CardContent className="flex flex-col gap-3 pt-6">
            <DraftStatusBadge status={lookup.status} />
            <Preview url={lookup.resultImageUrl} width={1080} height={1350} downloadName={`checkmatch-${lookup.id}`} />
          </CardContent>
        </Card>
      </>
    );
  }

  const { draft } = lookup;
  const { fixture } = draft.stats;
  const formatDef = STUDIO_FORMAT_DEFS[draft.format];
  const isDraft = draft.status === "DRAFT";
  const postOptions = isDraft ? await getLinkablePosts(fixture.id) : [];

  return (
    <>
      <PageHeader
        title={`${fixture.homeTeam.name} – ${fixture.awayTeam.name}`}
        description={`${fixture.competition.name} · ${formatDef.label} (${formatDef.width}×${formatDef.height}) · AI taslağı — onayınız olmadan yayına hazır sayılmaz.`}
        actions={backLink}
      />

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="flex flex-col gap-6 xl:col-span-2">
          <Card className="xl:sticky xl:top-6">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Önizleme</CardTitle>
                <DraftStatusBadge status={draft.status} />
              </div>
              <CardDescription>Görseldeki tüm sayılar aşağıdaki &quot;Maç Verisi&quot; kartından gelir.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Preview
                url={draft.resultImageUrl}
                width={formatDef.width}
                height={formatDef.height}
                downloadName={`checkmatch-${draft.format.toLowerCase()}-${draft.id}`}
              />
              <CopyTextButton text={draft.caption} />
              <details className="text-[11px] text-muted-foreground">
                <summary className="cursor-pointer hover:text-white">Arka plan prompt&apos;u</summary>
                <p className="mt-1.5 leading-relaxed break-words">{draft.prompt}</p>
              </details>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 xl:col-span-3">
          {isDraft ? (
            <>
              <DraftDecisionForm id={draft.id} postOptions={postOptions} currentPostId={draft.postId} />
              <DraftReviewForm
                id={draft.id}
                caption={draft.caption}
                renderOptions={draft.renderOptions}
                falConfigured={isFalConfigured()}
              />
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Gönderi metni</CardTitle>
                <CardDescription>
                  Bu taslak karara bağlandı{draft.reviewedAt ? ` (${new Date(draft.reviewedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })})` : ""} — artık düzenlenemez.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-white">{draft.caption}</pre>
              </CardContent>
            </Card>
          )}
          <DraftStatsCard stats={draft.stats} />
        </div>
      </div>
    </>
  );
}
