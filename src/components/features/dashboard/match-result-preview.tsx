"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { cn } from "@/lib/utils";
import type { MatchDayFormatId } from "@/types/match-day";
import type { MatchResultGenerationResult } from "@/types/match-result";

/** Üretilen Maç Sonucu kartı: görsel, maliyet, bilgi notları, taslağa git / indir. */
export function MatchResultPreview({ result, isPending, format, templateLabel }: { result: MatchResultGenerationResult | undefined; isPending: boolean; format: MatchDayFormatId; templateLabel: string }) {
  const frame = MATCH_DAY_FRAMES[result && !isPending ? result.format : format];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Önizleme</CardTitle>
        <CardDescription>
          {templateLabel} · {frame.ratioLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-black/40" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
          {result && !isPending ? (
            // eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli
            <img src={result.resultImageUrl} alt="Üretilen Maç Sonucu kartı" className="size-full object-contain" />
          ) : (
            <span className="px-6 text-center text-xs text-muted-foreground">{isPending ? "Kart hazırlanıyor…" : 'Fotoğrafı seçin, kırpmayı önizleyin ve "Kartı Üret"e basın.'}</span>
          )}
        </div>
        {result && !isPending ? (
          <>
            {result.statsImageUrl ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Carousel 2/2 · 02 İstatistikler</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli */}
                <img src={result.statsImageUrl} alt="Üretilen İstatistik sayfası" className="w-full rounded-lg border border-border" />
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">{result.paidCalls} ücretli Fal.ai çağrısı · zoom {result.zoom}</p>
            {result.notes.map((note) => (
              <p key={note} className="flex items-center gap-1.5 text-xs text-amber-300">
                <Info className="size-3.5 shrink-0" />
                {note}
              </p>
            ))}
            <Link href={`/dashboard/drafts/${result.id}`} className={cn(buttonVariants(), "w-full")}>
              Taslağı incele
            </Link>
            <a href={result.resultImageUrl} download={`checkmatch-mac-sonucu-${result.format.toLowerCase()}-${result.id}.png`} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
              PNG indir
            </a>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
