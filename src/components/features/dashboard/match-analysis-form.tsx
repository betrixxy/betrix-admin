"use client";

import { useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { generateMatchAnalysisAction } from "@/app/dashboard/studio/match-analysis/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useActionForm } from "@/hooks/use-action-form";
import type { MatchDayFormatId } from "@/types/match-day";
import type { PostMatchCardActionState } from "@/types/post-match-cards";
import { JobProgressLine } from "./job-progress";
import { MatchDayFormatPicker } from "./match-day-format-picker";
import { PostMatchCardPreview } from "./post-match-card-preview";

const INITIAL: PostMatchCardActionState = {};

/** Maç Analizi üretici: format seç → 01 (+ 02) arka plan işinde çizilir, DRAFT kaydedilir, önizleme gelir. */
export function MatchAnalysisForm({ fixtureId, halvesAvailable }: { fixtureId: string; halvesAvailable: boolean }) {
  const { state, isPending, onSubmit, progress } = useActionForm(generateMatchAnalysisAction, INITIAL);
  const [format, setFormat] = useState<MatchDayFormatId>("IG_PORTRAIT");
  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Maç Analizi Kartı</CardTitle>
          <CardDescription>
            {halvesAvailable ? "Carousel: 01 Zaman çizelgesi + 02 Devre devre." : "Tek kart: 01 Zaman çizelgesi (devre verisi yok — 02 üretilmez)."} Her sayfa yerleşim ve bahis dili kapısından geçer; kayıt
            taslak (DRAFT) doğar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <input type="hidden" name="fixtureId" value={fixtureId} />
            <MatchDayFormatPicker value={format} onChange={setFormat} />
            {state.error ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3.5 shrink-0" />
                {state.error}
              </p>
            ) : null}
            <JobProgressLine progress={progress} />
            <Button type="submit" size="lg" disabled={isPending}>
              <Sparkles />
              {isPending ? "Üretiliyor…" : "Kartı Üret"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="xl:col-span-2">
        <PostMatchCardPreview result={state.result} isPending={isPending} format={format} empty={'Formatı seçin ve "Kartı Üret"e basın.'} />
      </div>
    </div>
  );
}
