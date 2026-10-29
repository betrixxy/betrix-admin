"use client";

import { useState, useTransition } from "react";
import { AlertCircle, ImageIcon, LoaderCircle, RefreshCw } from "lucide-react";
import { previewLineupAction } from "@/app/dashboard/studio/lineup/actions";
import { FormatPreviewFrame } from "@/components/features/dashboard/studio/format-preview-frame";
import { Button } from "@/components/ui/button";
import { resultFromJob, runGuarded, type JobProgress } from "@/hooks/use-action-form";
import { JobProgressLine } from "@/components/features/dashboard/job-progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cardTemplateStyle } from "@/lib/dashboard/lineup-draft";
import type { TeamSide } from "@/types/deep-analysis";
import { LINEUP_TEMPLATE_LABELS, type LineupDraft, type LineupTemplateStyle } from "@/types/lineup";
import { socialFormatCaption, type SocialFormatId } from "@/types/studio-formats";

const SIDE_LABELS: Record<TeamSide, string> = { home: "Ev sahibi", away: "Deplasman" };

/** Seçili takımın Muhtemel 11 kartını sunucuda Satori ile çizer — kaydetmez. */
export function LineupPreview({ draft }: { draft: LineupDraft }) {
  const [side, setSide] = useState<TeamSide>("home");
  const [drawn, setDrawn] = useState<{ dataUrl: string; format: SocialFormatId } | null>(null);
  // Format değiştiyse eski çizim gösterilmez — yeni oranda yeniden çizilmeli.
  const image = drawn && drawn.format === draft.format ? drawn.dataUrl : null;
  /** Son çizilen kartın gerçek şablonu — her takım bağımsız (kapağı olmayan takım taktik tahtası). */
  const [drawnStyle, setDrawnStyle] = useState<LineupTemplateStyle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, startRendering] = useTransition();
  const [progress, setProgress] = useState<JobProgress | null>(null);

  function render(target: TeamSide) {
    setSide(target);
    setError(null);
    const opponent = target === "home" ? draft.away : draft.home;
    startRendering(() => runGuarded(async () => {
      const result = await resultFromJob<{ dataUrl: string; templateStyle: LineupTemplateStyle }>(await previewLineupAction({
        templateStyle: cardTemplateStyle(draft.templateStyle, draft[target]),
        team: draft[target],
        opponentName: opponent.teamName,
        opponentLogoUrl: opponent.logoUrl,
        headline: draft.headline,
        matchLabel: draft.matchLabel,
        format: draft.format,
        // Ad büyük harfi için köken sunucuda maçtan çözülür (bkz. team-origin.ts).
        fixtureId: draft.fixtureId,
        side: target,
      }), setProgress);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setDrawn({ dataUrl: result.data.dataUrl, format: draft.format });
      setDrawnStyle(result.data.templateStyle);
    }, setError));
  }

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>Önizleme</CardTitle>
        <CardDescription>
          Muhtemel 11 kartı{image && drawnStyle ? ` · ${draft[side].teamName}: ${LINEUP_TEMPLATE_LABELS[drawnStyle]}` : ""} · {socialFormatCaption(draft.format)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex gap-2">
          {(["home", "away"] as const).map((target) => (
            <Button
              key={target}
              type="button"
              size="sm"
              variant={side === target && image ? "default" : "outline"}
              className="flex-1"
              disabled={isRendering || !draft[target].teamName}
              onClick={() => render(target)}
            >
              {isRendering && side === target ? <LoaderCircle className="animate-spin" /> : image && side === target ? <RefreshCw /> : <ImageIcon />}
              {draft[target].teamName || SIDE_LABELS[target]}
            </Button>
          ))}
        </div>

        <FormatPreviewFrame format={draft.format} busy={isRendering}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- sunucuda çizilmiş data URL önizlemesi.
            <img src={image} alt={`${draft[side].teamName} muhtemel 11 kartı önizlemesi`} className="size-full object-contain" />
          ) : (
            <p className="px-6 text-center text-sm text-muted-foreground">Bir takım seçerek kartı çizin. Formu değiştirdikten sonra aynı butona tekrar basın.</p>
          )}
        </FormatPreviewFrame>

        <JobProgressLine progress={progress} />
        {error ? (
          <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <AlertCircle className="size-3.5 shrink-0" />
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
