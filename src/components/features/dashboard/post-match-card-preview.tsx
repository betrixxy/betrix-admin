"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { cn } from "@/lib/utils";
import type { MatchDayFormatId } from "@/types/match-day";
import type { PostMatchCardResult } from "@/types/post-match-cards";

/** Maç Analizi / Tahmin Karnesi önizlemesi: üretilen sayfalar (yayın sırasıyla), notlar, taslağa git. */
export function PostMatchCardPreview({ result, isPending, format, empty }: { result: PostMatchCardResult | undefined; isPending: boolean; format: MatchDayFormatId; empty: string }) {
  const frame = MATCH_DAY_FRAMES[result && !isPending ? result.format : format];
  const slides = result && !isPending ? result.slides : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Önizleme</CardTitle>
        <CardDescription>
          {frame.ratioLabel}
          {slides.length > 1 ? ` · Carousel (${slides.length} görsel)` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {slides.length === 0 ? (
          <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-black/40" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
            <span className="px-6 text-center text-xs text-muted-foreground">{isPending ? "Kart hazırlanıyor…" : empty}</span>
          </div>
        ) : (
          slides.map((slide, index) => (
            <div key={slide.url} className="flex flex-col gap-1">
              {slides.length > 1 ? (
                <span className="text-xs text-muted-foreground">
                  {index + 1}/{slides.length} · {slide.label}
                </span>
              ) : null}
              {/* eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli */}
              <img src={slide.url} alt={`Üretilen ${slide.label}`} className="w-full rounded-lg border border-border" />
            </div>
          ))
        )}
        {result && !isPending ? (
          <>
            {result.notes.map((note) => (
              <p key={note} className="flex items-center gap-1.5 text-xs text-amber-300">
                <Info className="size-3.5 shrink-0" />
                {note}
              </p>
            ))}
            <Link href={`/dashboard/drafts/${result.id}`} className={cn(buttonVariants(), "w-full")}>
              Taslağı incele
            </Link>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
