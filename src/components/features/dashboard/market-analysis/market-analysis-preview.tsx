"use client";

import { useState, useTransition } from "react";
import { AlertCircle, ImageIcon, LoaderCircle, RefreshCw } from "lucide-react";
import { previewDeepAnalysisAction } from "@/app/dashboard/studio/market-analysis/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MarketAnalysisDraft, TeamSide } from "@/types/deep-analysis";

interface MarketAnalysisPreviewProps {
  draft: MarketAnalysisDraft;
}

const SIDE_LABELS: Record<TeamSide, string> = { home: "Ev sahibi", away: "Deplasman" };

/**
 * Seçili takımın analiz kartını sunucuda Satori ile çizer — kaydetmez, Fal.ai'ye gitmez.
 * Şablon: templates/deep-analysis/deep-analysis-card.tsx (CheckMatch team-analysis birebir).
 */
export function MarketAnalysisPreview({ draft }: MarketAnalysisPreviewProps) {
  const [side, setSide] = useState<TeamSide>("home");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, startRendering] = useTransition();

  function render(target: TeamSide) {
    setSide(target);
    setError(null);
    const opponent = target === "home" ? draft.away : draft.home;
    startRendering(async () => {
      const result = await previewDeepAnalysisAction({ team: draft[target], opponentName: opponent.teamName });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setImage(result.data.dataUrl);
    });
  }

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>Önizleme</CardTitle>
        <CardDescription>Derinlemesine Analiz kartı · 1080×1350 (IG 4:5) · kaydetmeden önce kontrol edin</CardDescription>
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

        <div className={cn("relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-black/30", isRendering && "opacity-60")}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- sunucuda çizilmiş data URL önizlemesi.
            <img src={image} alt={`${draft[side].teamName} derinlemesine analiz kartı önizlemesi`} className="size-full object-contain" />
          ) : (
            <p className="px-6 text-center text-sm text-muted-foreground">Bir takım seçerek kartı çizin. Formu değiştirdikten sonra aynı butona tekrar basın.</p>
          )}
        </div>

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
