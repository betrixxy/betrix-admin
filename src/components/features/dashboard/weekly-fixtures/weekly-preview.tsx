"use client";

import { useState, useTransition } from "react";
import { AlertCircle, ImageIcon, LoaderCircle, RefreshCw } from "lucide-react";
import { previewWeeklyFixturesAction } from "@/app/dashboard/studio/weekly-fixtures/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WeeklyFixturesDraft } from "@/types/weekly-fixtures";

/** Kartı sunucuda Satori ile çizer — kaydetmez. Skor/saat sunucuda güncel veriden okunur. */
export function WeeklyPreview({ draft, disabled }: { draft: WeeklyFixturesDraft | null; disabled: boolean }) {
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, startRendering] = useTransition();

  function render() {
    if (!draft) return;
    setError(null);
    startRendering(async () => {
      const result = await previewWeeklyFixturesAction(draft);
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
        <CardDescription>Haftanın Maçları · 1080×1350 (IG 4:5) · saatler TSİ</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button type="button" size="sm" variant={image ? "outline" : "default"} disabled={disabled || !draft || isRendering} onClick={render}>
          {isRendering ? <LoaderCircle className="animate-spin" /> : image ? <RefreshCw /> : <ImageIcon />}
          {isRendering ? "Çiziliyor…" : image ? "Yeniden çiz" : "Kartı çiz"}
        </Button>
        <div className={cn("relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-black/30", isRendering && "opacity-60")}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- sunucuda çizilmiş data URL önizlemesi.
            <img src={image} alt="Haftanın maçları kartı önizlemesi" className="size-full object-contain" />
          ) : (
            <p className="px-6 text-center text-sm text-muted-foreground">Lig ve turu seçip maç listesini düzenleyin, sonra kartı çizin.</p>
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
