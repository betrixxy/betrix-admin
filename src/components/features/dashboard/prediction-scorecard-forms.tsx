"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Calculator, Sparkles } from "lucide-react";
import { generateMatchScorecardAction, generatePeriodScorecardAction, settleScorecardAction } from "@/app/dashboard/studio/prediction-scorecard/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import type { MatchDayFormatId } from "@/types/match-day";
import type { PostMatchCardActionState, SettleActionState } from "@/types/post-match-cards";
import { JobProgressLine } from "./job-progress";
import { MatchDayFormatPicker } from "./match-day-format-picker";
import { PostMatchCardPreview } from "./post-match-card-preview";

const INITIAL: PostMatchCardActionState = {};
const INITIAL_SETTLE: SettleActionState = {};

function ErrorLine({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
      <AlertCircle className="size-3.5 shrink-0" />
      {message}
    </p>
  );
}

/** "Sonuçları hesapla": maçın skorunu okur, sonuçları ekler (yalnızca admin tıklaması). Bitince liste yenilenir. */
export function SettleButton({ fixtureId, disabledReason }: { fixtureId: string; disabledReason: string | null }) {
  const router = useRouter();
  const { state, isPending, onSubmit, progress } = useActionForm(settleScorecardAction, INITIAL_SETTLE);
  const summary = state.summary;
  useEffect(() => {
    if (summary) router.refresh();
  }, [summary, router]);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <input type="hidden" name="fixtureId" value={fixtureId} />
      <Button type="submit" variant="outline" disabled={isPending || disabledReason !== null} title={disabledReason ?? undefined}>
        <Calculator />
        {isPending ? "Hesaplanıyor…" : "Sonuçları hesapla"}
      </Button>
      {summary ? (
        <p className="text-xs text-muted-foreground">
          {summary.written} sonuç yazıldı · {summary.unchanged} değişmedi{summary.pending > 0 ? ` · ${summary.pending} henüz değerlendirilemez (maç bitmedi)` : ""}
        </p>
      ) : null}
      <ErrorLine message={state.error} />
      <JobProgressLine progress={progress} />
    </form>
  );
}

/** A · maç karnesi üretimi. `blocker` varsa (kayıt yok / sonuç hesaplanmadı) düğme kapalı, sebep görünür. */
export function MatchScorecardForm({ fixtureId, blocker }: { fixtureId: string; blocker: string | null }) {
  const { state, isPending, onSubmit, progress } = useActionForm(generateMatchScorecardAction, INITIAL);
  const [format, setFormat] = useState<MatchDayFormatId>("IG_PORTRAIT");
  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>A · Maç karnesi</CardTitle>
          <CardDescription>Maçın bütün onaylanmış tahminleri (her senaryoda ilk onay) — tutmayanlar dahil; normal süre skoru.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <input type="hidden" name="fixtureId" value={fixtureId} />
            <MatchDayFormatPicker value={format} onChange={setFormat} />
            {blocker ? <p className="text-xs text-amber-300">{blocker}</p> : null}
            <ErrorLine message={state.error} />
            <JobProgressLine progress={progress} />
            <Button type="submit" size="lg" disabled={isPending || blocker !== null}>
              <Sparkles />
              {isPending ? "Üretiliyor…" : "Kartı Üret"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="xl:col-span-2">
        <PostMatchCardPreview result={state.result} isPending={isPending} format={format} empty={blocker ?? 'Formatı seçin ve "Kartı Üret"e basın.'} />
      </div>
    </div>
  );
}

/** B · dönem karnesi: hafta / ay / sezon (1 Temmuz başlangıçlı) + isteğe bağlı model sürümü ayrımı. */
export function PeriodScorecardForm({ today }: { today: string }) {
  const { state, isPending, onSubmit, progress } = useActionForm(generatePeriodScorecardAction, INITIAL);
  const [format, setFormat] = useState<MatchDayFormatId>("IG_PORTRAIT");
  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>B · Dönem karnesi</CardTitle>
          <CardDescription>Dönemde başlayan maçların bütün onaylanmış tahminleri (sonucu hesaplanmış olanlar karneye girer; bekleyen ve sonuçlanmayan ayrıca sayılır).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="kind">Dönem</Label>
                <NativeSelect id="kind" name="kind" defaultValue="WEEK">
                  <option value="WEEK">Hafta (Pazartesi–Pazar)</option>
                  <option value="MONTH">Ay</option>
                  <option value="SEASON">Sezon (1 Temmuz başlangıçlı)</option>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="day">Dönemin içindeki bir gün</Label>
                <Input id="day" name="day" type="date" defaultValue={today} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" name="splitByModelVersion" />
              Model sürümüne göre ayır (dönemde birden çok sürüm varsa)
            </label>
            <MatchDayFormatPicker value={format} onChange={setFormat} />
            <ErrorLine message={state.error} />
            <JobProgressLine progress={progress} />
            <Button type="submit" size="lg" disabled={isPending}>
              <Sparkles />
              {isPending ? "Üretiliyor…" : "Kartı Üret"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="xl:col-span-2">
        <PostMatchCardPreview result={state.result} isPending={isPending} format={format} empty={'Dönemi seçin ve "Kartı Üret"e basın.'} />
      </div>
    </div>
  );
}
