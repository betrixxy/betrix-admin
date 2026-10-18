"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, BarChart3, Info } from "lucide-react";
import { generateMatchStatsAction } from "@/app/dashboard/studio/match-stats/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { cn } from "@/lib/utils";
import type { MatchDayFormatId } from "@/types/match-day";
import type { MatchStatsActionState } from "@/types/match-stats";
import { MatchDayFormatPicker } from "./match-day-format-picker";

const INITIAL_STATE: MatchStatsActionState = {};

/**
 * Tek başına "Maç İstatistikleri" (02) üretici. Zemin aynı maçın aynı formattaki Maç Sonucu kartıdır
 * (bulanık); o yoksa programatik. Set kartı olarak paylaşmak için Maç Sonucu stüdyosundaki
 * "İstatistik sayfasını da ekle" seçeneği önerilir (tek taslak, carousel).
 */
export function MatchStatsForm({ fixtureId, warnings }: { fixtureId: string; warnings: string[] }) {
  const { state, isPending, onSubmit } = useActionForm(generateMatchStatsAction, INITIAL_STATE);
  const [format, setFormat] = useState<MatchDayFormatId>("IG_PORTRAIT");
  const frame = MATCH_DAY_FRAMES[state.result && !isPending ? state.result.format : format];
  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Maç İstatistikleri Kartı</CardTitle>
          <CardDescription>
            Satırlar maçtan otomatik gelir (API-Football; boş kalanlar Sportmonks). Zemin aynı maçın Maç Sonucu kartıdır. Yerleşimde çakışma varsa kart üretilmez.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <input type="hidden" name="fixtureId" value={fixtureId} />
            <MatchDayFormatPicker value={format} onChange={setFormat} />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="page">Sayfa</Label>
              <NativeSelect id="page" name="page" defaultValue="SUMMARY">
                <option value="SUMMARY">Özet (en fazla 8 satır)</option>
                <option value="DETAIL">Detay (Hücum · Pas · Savunma · Disiplin)</option>
              </NativeSelect>
            </div>
            {warnings.map((warning) => (
              <p key={warning} className="flex items-center gap-1.5 text-xs text-amber-300">
                <Info className="size-3.5 shrink-0" />
                {warning}
              </p>
            ))}
            {state.error ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3.5 shrink-0" />
                {state.error}
              </p>
            ) : null}
            <Button type="submit" size="lg" disabled={isPending}>
              <BarChart3 />
              {isPending ? "Üretiliyor…" : "Kartı Üret"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Önizleme</CardTitle>
          <CardDescription>{frame.ratioLabel}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-black/40" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
            {state.result && !isPending ? (
              // eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli
              <img src={state.result.resultImageUrl} alt="Üretilen Maç İstatistikleri kartı" className="size-full object-contain" />
            ) : (
              <span className="px-6 text-center text-xs text-muted-foreground">{isPending ? "Kart hazırlanıyor…" : 'Formatı seçin ve "Kartı Üret"e basın.'}</span>
            )}
          </div>
          {state.result && !isPending ? (
            <>
              {state.result.notes.map((note) => (
                <p key={note} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-3.5 shrink-0" />
                  {note}
                </p>
              ))}
              <Link href={`/dashboard/drafts/${state.result.id}`} className={cn(buttonVariants(), "w-full")}>
                Taslağı incele
              </Link>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
