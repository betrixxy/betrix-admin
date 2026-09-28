import { Download, LoaderCircle, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STUDIO_FORMAT_DEFS } from "@/lib/dashboard/studio-formats";
import { cn } from "@/lib/utils";
import type { StudioFormat, StudioGenerationResult } from "@/types/ai-content";

interface StudioPreviewProps {
  format: StudioFormat;
  result: StudioGenerationResult | undefined;
  isPending: boolean;
}

/** Seçili formatın oranında bir tuval: üretim sonucu, üretim sırasında yükleniyor durumu veya boş durum. */
export function StudioPreview({ format, result, isPending }: StudioPreviewProps) {
  // Sonuç varken tuval, sonucun kendi formatını izler (form seçimi sonradan değişmiş olabilir).
  const def = STUDIO_FORMAT_DEFS[result && !isPending ? result.format : format];

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>Önizleme</CardTitle>
        <CardDescription>
          {def.label} · {def.width}×{def.height} ({def.ratioLabel})
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          className="relative mx-auto flex max-h-[560px] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/30 ring-1 ring-border"
          style={{ aspectRatio: `${def.width} / ${def.height}` }}
        >
          {isPending ? (
            <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-6 animate-spin text-emerald-400" />
              Görsel üretiliyor…
            </span>
          ) : result ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.resultImageUrl} alt="Üretilen görsel" className="size-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-2 px-6 text-center text-xs text-muted-foreground">
              <Sparkles className="size-6" />
              Formu doldurup &quot;Görseli Üret&quot;e basın — sonuç burada görünecek.
            </span>
          )}
        </div>

        {result && !isPending ? (
          <>
            <a
              href={result.resultImageUrl}
              download={`checkmatch-${result.format.toLowerCase()}-${result.id}.svg`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              <Download />
              İndir
            </a>
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer hover:text-white">Kullanılan prompt</summary>
              <p className="mt-1.5 leading-relaxed break-words">{result.prompt}</p>
            </details>
          </>
        ) : null}
        <p className="text-[10px] text-muted-foreground/70">
          Arka plan Fal.ai flux ile üretilir, oyuncu fotoğrafı yüklendiyse birefnet ile kesilir;
          istatistik ve marka katmanı her zaman programatik olarak çizilir.
        </p>
      </CardContent>
    </Card>
  );
}
