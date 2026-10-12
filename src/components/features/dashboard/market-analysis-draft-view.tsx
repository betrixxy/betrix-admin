import { Target } from "lucide-react";
import { DraftPublishPanel } from "@/components/features/dashboard/publishing/draft-publish-panel";
import { DraftPreview } from "@/components/features/dashboard/draft-preview";
import { DraftStatusBadge } from "@/components/features/dashboard/draft-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { StudioPostOption } from "@/types/ai-content";
import type { MarketAnalysisDraftView } from "@/types/draft";
import { SOCIAL_FORMATS, socialFormatCaption } from "@/types/studio-formats";

interface MarketAnalysisDraftViewProps {
  draft: MarketAnalysisDraftView;
  postOptions: StudioPostOption[];
}

/**
 * AI Market Tahmin & Analiz taslağının incelemesi: iki takımın Derinlemesine Analiz kartı yan yana,
 * market tahmini, gönderi metni ve onay/ret. Kartlar programatiktir — düzenleme stüdyoda yapılır
 * (yeniden kaydetmek yeni taslak üretir).
 */
export function MarketAnalysisDraftView({ draft, postOptions }: MarketAnalysisDraftViewProps) {
  const { width, height } = SOCIAL_FORMATS[draft.format];
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Derinlemesine Analiz Kartları</CardTitle>
            <DraftStatusBadge status={draft.status} />
          </div>
          <CardDescription>Her takım için ayrı kart · {socialFormatCaption(draft.format)} — carousel olarak birlikte paylaşılır.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          {(["home", "away"] as const).map((side) => (
            <div key={side} className="flex flex-col gap-2">
              <p className="text-sm font-medium">
                {draft[side].teamName} <span className="text-muted-foreground">· {side === "home" ? "Ev sahibi" : "Deplasman"}</span>
              </p>
              <DraftPreview
                url={draft[side].imageUrl}
                width={width}
                height={height}
                alt={`${draft[side].teamName} derinlemesine analiz kartı`}
                downloadName={`checkmatch-analiz-${side}-${draft.id}`}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-4 text-amber-400" />
              Olası Market Tahmini
            </CardTitle>
          </CardHeader>
          <CardContent>
            {draft.marketPick ? (
              <p>
                <span className="text-lg font-semibold text-amber-200">{draft.marketPick}</span>
                {draft.marketRationale ? <span className="block text-sm text-muted-foreground">{draft.marketRationale}</span> : null}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Market tahmini girilmedi.</p>
            )}
          </CardContent>
        </Card>
        <div className="xl:col-span-3">
          <DraftPublishPanel draft={draft} format={draft.format} postOptions={postOptions} downloadName={`checkmatch-analiz-${draft.id}`} />
        </div>
      </div>
    </div>
  );
}
