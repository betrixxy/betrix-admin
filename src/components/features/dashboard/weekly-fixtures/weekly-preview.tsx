"use client";

import { useState, useTransition } from "react";
import { AlertCircle, ImageIcon, LoaderCircle, RefreshCw } from "lucide-react";
import { previewWeeklyFixturesAction } from "@/app/dashboard/studio/weekly-fixtures/actions";
import { FormatPreviewFrame } from "@/components/features/dashboard/studio/format-preview-frame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { socialFormatCaption, type SocialFormatId } from "@/types/studio-formats";
import type { WeeklyFixturesDraft } from "@/types/weekly-fixtures";

/** Kartı sunucuda Satori ile çizer — kaydetmez. Skor/saat sunucuda güncel veriden okunur. */
export function WeeklyPreview({ draft, format, disabled }: { draft: WeeklyFixturesDraft | null; format: SocialFormatId; disabled: boolean }) {
  const [image, setImage] = useState<{ dataUrl: string; format: SocialFormatId } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, startRendering] = useTransition();
  // Format değiştiyse eski çizim gösterilmez — yeni oranda yeniden çizilmeli.
  const shown = image && image.format === format ? image.dataUrl : null;

  function render() {
    if (!draft) return;
    setError(null);
    startRendering(async () => {
      const result = await previewWeeklyFixturesAction(draft);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setImage({ dataUrl: result.data.dataUrl, format: draft.format });
    });
  }

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>Önizleme</CardTitle>
        <CardDescription>Haftanın Maçları · {socialFormatCaption(format)} · saatler TSİ</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button type="button" size="sm" variant={shown ? "outline" : "default"} disabled={disabled || !draft || isRendering} onClick={render}>
          {isRendering ? <LoaderCircle className="animate-spin" /> : shown ? <RefreshCw /> : <ImageIcon />}
          {isRendering ? "Çiziliyor…" : shown ? "Yeniden çiz" : "Kartı çiz"}
        </Button>
        <FormatPreviewFrame format={format} busy={isRendering}>
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- sunucuda çizilmiş data URL önizlemesi.
            <img src={shown} alt="Haftanın maçları kartı önizlemesi" className="size-full object-contain" />
          ) : (
            <p className="px-6 text-center text-sm text-muted-foreground">Lig ve turu seçip maç listesini düzenleyin, sonra kartı çizin.</p>
          )}
        </FormatPreviewFrame>
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
