import Link from "next/link";
import { ClipboardCheck, Coins, Download, LoaderCircle, PiggyBank, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { MATCH_DAY_TEMPLATES } from "@/lib/dashboard/match-day-templates";
import { cn } from "@/lib/utils";
import type { MatchDayFormatId, MatchDayGenerationResult } from "@/types/match-day";

const PIPELINE_STEPS = [
  "Oyuncu kesimleri: önbellek → yoksa AI Upscale + birefnet",
  "Arka plan: şablona göre programatik, önbellek ya da gerçekçi AI sahnesi",
  "Katmanlar birleştiriliyor (Premium'da AI harmanlama)",
  "Tipografi, logolar ve marka basılıyor",
];

interface MatchDayPreviewProps {
  result: MatchDayGenerationResult | undefined;
  isPending: boolean;
  /** Formda seçili format — sonuç yokken tuvalin oranını belirler. */
  format: MatchDayFormatId;
}

function Thumb({ src, label, ratio }: { src: string; label: string; ratio: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="flex flex-col gap-1 text-[10px] text-muted-foreground hover:text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="w-full rounded-md object-cover ring-1 ring-border" style={{ aspectRatio: ratio }} />
      {label}
    </a>
  );
}

/** Seçili formatın oranında tuval: üretim sırasında adım listesi, sonra nihai kart + maliyet özeti. */
export function MatchDayPreview({ result, isPending, format }: MatchDayPreviewProps) {
  const frame = MATCH_DAY_FRAMES[result && !isPending ? result.format : format];
  const ratio = `${frame.width} / ${frame.height}`;

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader>
        <CardTitle>Önizleme</CardTitle>
        <CardDescription>
          {frame.label} · {frame.width}×{frame.height} ({frame.ratioLabel})
          {result && !isPending ? ` · ${MATCH_DAY_TEMPLATES[result.template].label}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          className="relative mx-auto flex max-h-[640px] w-full items-center justify-center overflow-hidden rounded-lg bg-muted/30 ring-1 ring-border"
          style={{ aspectRatio: ratio }}
        >
          {isPending ? (
            <div className="flex flex-col gap-3 px-6 text-xs text-muted-foreground">
              <LoaderCircle className="mx-auto size-6 animate-spin text-emerald-400" />
              <p className="text-center">Üretiliyor — genellikle 20-90 sn sürer.</p>
              <ol className="list-decimal space-y-1 pl-4">
                {PIPELINE_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : result ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={result.resultImageUrl} alt="Üretilen Maç Günü kartı" className="size-full object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-2 px-6 text-center text-xs text-muted-foreground">
              <Sparkles className="size-6" />
              Maçı, formatı ve şablonu seçin, iki oyuncu fotoğrafını ekleyin ve &quot;Kartı Üret&quot;e basın.
            </span>
          )}
        </div>

        {result && !isPending ? (
          <>
            <div className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5 text-white">
                <Coins className="size-3.5 text-amber-300" />
                {result.paidCalls} ücretli Fal.ai çağrısı
              </span>
              {result.savedSteps.map((step) => (
                <span key={step} className="flex items-center gap-1.5">
                  <PiggyBank className="size-3.5 text-emerald-400" />
                  {step}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Thumb src={result.backgroundImageUrl} label="1 · Arka plan" ratio={ratio} />
              <Thumb src={result.compositeImageUrl} label="2 · Harmanlama öncesi kompozit" ratio={ratio} />
            </div>
            <Link href={`/dashboard/drafts/${result.id}`} className={cn(buttonVariants(), "w-full")}>
              <ClipboardCheck />
              Taslağı İncele
            </Link>
            <a
              href={result.resultImageUrl}
              download={`checkmatch-mac-gunu-${result.format.toLowerCase()}-${result.id}.png`}
              className={cn(buttonVariants({ variant: "outline" }), "w-full")}
            >
              <Download />
              PNG indir
            </a>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
