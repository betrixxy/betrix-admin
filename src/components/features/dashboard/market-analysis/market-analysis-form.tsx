"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CircleCheck, LoaderCircle, RefreshCw, Save, Sparkles, Target } from "lucide-react";
import {
  generateExpertAnalysisAction,
  loadDeepAnalysisAction,
  saveMarketAnalysisAction,
  type DeepAnalysisLoadResult,
  type TeamDataSummary,
} from "@/app/dashboard/studio/market-analysis/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { emptyTeamDraft } from "@/lib/dashboard/deep-analysis-insights";
import { cn } from "@/lib/utils";
import type { MarketAnalysisDraft, TeamSide } from "@/types/deep-analysis";
import type { MatchDayFixtureOption } from "@/types/match-day";
import { MarketAnalysisPreview } from "./market-analysis-preview";
import { TeamAnalysisFields } from "./team-analysis-fields";

interface MarketAnalysisFormProps {
  fixtures: MatchDayFixtureOption[];
  /** `?fixtureId=` ile gelen, listede doğrulanmış maç — açılışta verisi otomatik yüklenir. */
  initialFixtureId: string | null;
  /** ANTHROPIC_API_KEY tanımlı mı — değilse "AI Analist" pasiftir, öneriler kural tabanlı kalır. */
  analystAvailable: boolean;
}

const FORM_LETTERS = { W: { letter: "G", className: "bg-emerald-600" }, D: { letter: "B", className: "bg-zinc-600" }, L: { letter: "M", className: "bg-red-700" } } as const;

function draftFor(fixture: MatchDayFixtureOption | undefined): MarketAnalysisDraft {
  return {
    fixtureId: fixture?.id ?? "",
    home: emptyTeamDraft(fixture?.homeTeam, fixture?.homeLogoUrl),
    away: emptyTeamDraft(fixture?.awayTeam, fixture?.awayLogoUrl),
    marketPick: "",
    marketRationale: "",
  };
}

function fmt(value: number | null, digits = 1): string {
  return value === null ? "—" : value.toFixed(digits);
}

/** Önerilerin dayandığı ham veri — admin neyi düzenlediğini bilsin. */
function DataSummary({ summary }: { summary: TeamDataSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        {summary.last5.map((letter, index) => {
          const meta = FORM_LETTERS[letter as keyof typeof FORM_LETTERS];
          return (
            <span key={index} className={cn("flex size-5 items-center justify-center rounded text-[10px] font-bold text-white", meta?.className)}>
              {meta?.letter ?? "?"}
            </span>
          );
        })}
      </span>
      <span>Gol {fmt(summary.goalsForAvg)} / {fmt(summary.goalsAgainstAvg)}</span>
      <span>xG {fmt(summary.xgForAvg, 2)} / {fmt(summary.xgAgainstAvg, 2)}</span>
      {summary.formation ? <span>Diziliş {summary.formation}</span> : null}
      <span className="ml-auto tabular-nums">
        {summary.matchesSampled} maç · {summary.statMatchesSampled} istatistikli
      </span>
    </div>
  );
}

export function MarketAnalysisForm({ fixtures, initialFixtureId, analystAvailable }: MarketAnalysisFormProps) {
  const [fixtureId, setFixtureId] = useState(initialFixtureId ?? "");
  const [draft, setDraft] = useState<MarketAnalysisDraft>(() => draftFor(fixtures.find((f) => f.id === initialFixtureId)));
  const [loaded, setLoaded] = useState<DeepAnalysisLoadResult | null>(null);
  const [side, setSide] = useState<TeamSide>("home");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const autoLoaded = useRef(false);
  const [isSaving, startSaving] = useTransition();
  const [isWriting, startWriting] = useTransition();
  const [analystNote, setAnalystNote] = useState<{ warnings: string[]; model: string } | null>(null);

  function writeWithAnalyst() {
    setError(null);
    setAnalystNote(null);
    startWriting(async () => {
      const result = await generateExpertAnalysisAction(fixtureId);
      if (!result.ok) {
        setError(`AI analist: ${result.error.message}`);
        return;
      }
      // Takım renkleri ve elle girilen alıntı dışındaki her şey analistin taslağıyla değişir.
      setDraft((current) => ({
        ...result.data.draft,
        home: { ...result.data.draft.home, colorHex: current.home.colorHex },
        away: { ...result.data.draft.away, colorHex: current.away.colorHex },
      }));
      setAnalystNote({ warnings: result.data.warnings, model: result.data.model });
    });
  }
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function save() {
    setSaveError(null);
    setSavedId(null);
    startSaving(async () => {
      const result = await saveMarketAnalysisAction(draft);
      if (!result.ok) {
        setSaveError(result.error.message);
        return;
      }
      setSavedId(result.data.id);
    });
  }

  function load(id: string) {
    setError(null);
    startLoading(async () => {
      const result = await loadDeepAnalysisAction(id);
      if (!result.ok) {
        setError(`Veri alınamadı: ${result.error.message} — alanları elle doldurabilirsiniz.`);
        return;
      }
      setLoaded(result.data);
      setDraft(result.data.draft);
    });
  }

  function selectFixture(id: string) {
    setFixtureId(id);
    setSavedId(null);
    setAnalystNote(null);
    setLoaded(null);
    setDraft(draftFor(fixtures.find((fixture) => fixture.id === id)));
    if (id) load(id);
  }

  useEffect(() => {
    // Maç Merkezi / Takvim'den "Stüdyoya Git" ile gelindiyse veriyi bir kez otomatik yükle.
    if (initialFixtureId && !autoLoaded.current) {
      autoLoaded.current = true;
      load(initialFixtureId);
    }
  }, [initialFixtureId]);

  const opponent = side === "home" ? draft.away : draft.home;

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <div className="flex flex-col gap-6 xl:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>Maç ve Veri</CardTitle>
            <CardDescription>
              Maçı seçin — iki takımın son 5 maçından form, gol/xG, topla oynama, pas isabeti, top kazanma ve anahtar oyuncular
              API-Football&apos;dan çekilir; aşağıdaki alanlar bu veriden kural tabanlı önerilerle dolar. Hepsi düzenlenebilir.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="market-analysis-fixture">Maç (API-Football · önümüzdeki 7 gün)</Label>
                <NativeSelect id="market-analysis-fixture" value={fixtureId} onChange={(event) => selectFixture(event.target.value)} disabled={isLoading}>
                  <option value="">{fixtures.length ? "Maç seçin…" : "Maç bulunamadı"}</option>
                  {fixtures.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="button" variant="outline" disabled={!fixtureId || isLoading} onClick={() => load(fixtureId)} title="Veriyi yeniden çek ve önerileri sıfırla">
                {isLoading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                {isLoading ? "Yükleniyor…" : "Veriden doldur"}
              </Button>
            </div>
            <Button
              type="button"
              disabled={!analystAvailable || !fixtureId || isLoading || isWriting}
              onClick={writeWithAnalyst}
              title={analystAvailable ? "Claude, maç verisinden iki takımın analizini ve market tahminini yazar (ücretli, ~30-90 sn)" : "ANTHROPIC_API_KEY tanımlı değil"}
            >
              {isWriting ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              {isWriting ? "Analist yazıyor… (30-90 sn)" : "AI Analist ile Yaz"}
            </Button>
            {!analystAvailable ? (
              <p className="text-xs text-muted-foreground">AI analist kapalı (ANTHROPIC_API_KEY yok) — alanlar kural tabanlı önerilerle dolar.</p>
            ) : null}
            {analystNote ? (
              analystNote.warnings.length === 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-emerald-300" role="status">
                  <CircleCheck className="size-3.5 shrink-0" />
                  Analiz yazıldı ({analystNote.model}) — metindeki tüm sayılar veriyle eşleşiyor.
                </p>
              ) : (
                <div className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200" role="status">
                  <span className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    Analiz yazıldı — yayından önce şu noktaları kontrol edin:
                  </span>
                  {analystNote.warnings.map((warning) => (
                    <span key={warning}>• {warning}</span>
                  ))}
                </div>
              )
            ) : null}
            {error ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3.5 shrink-0" />
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Takım Analizleri</CardTitle>
            <CardDescription>Her takım için ayrı bir Derinlemesine Analiz kartı üretilir.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-white/[0.04] p-1" role="tablist">
              {(["home", "away"] as const).map((target) => (
                <button
                  key={target}
                  type="button"
                  role="tab"
                  aria-selected={side === target}
                  onClick={() => setSide(target)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    side === target ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {draft[target].teamName || (target === "home" ? "Ev sahibi" : "Deplasman")}
                </button>
              ))}
            </div>

            {loaded ? <DataSummary summary={loaded[side]} /> : null}

            <TeamAnalysisFields
              key={`${draft.fixtureId}-${side}`}
              idPrefix={side}
              value={draft[side]}
              opponentName={opponent.teamName}
              onChange={(next) => setDraft((current) => ({ ...current, [side]: next }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="size-4 text-amber-400" />
              Olası Market Tahmini
            </CardTitle>
            <CardDescription>Veriden türetilen öneriler başlangıç noktasıdır; son karar sizin.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {loaded && loaded.suggestions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {loaded.suggestions.map((suggestion) => (
                  <button
                    key={suggestion.pick}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, marketPick: suggestion.pick, marketRationale: suggestion.reason }))}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors",
                      draft.marketPick === suggestion.pick ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                    title={suggestion.reason}
                  >
                    {suggestion.pick}
                  </button>
                ))}
              </div>
            ) : loaded ? (
              <p className="text-xs text-muted-foreground">Veri belirgin bir market sinyali vermiyor — tahmini elle girin.</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-pick">Tahmin</Label>
                <Input
                  id="market-pick"
                  value={draft.marketPick}
                  maxLength={40}
                  placeholder="Ör. 2.5 Üst, KG Var"
                  onChange={(event) => setDraft((current) => ({ ...current, marketPick: event.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="market-rationale">Gerekçe</Label>
                <Input
                  id="market-rationale"
                  value={draft.marketRationale}
                  maxLength={160}
                  placeholder="Ör. Beklenen toplam gol 3.1"
                  onChange={(event) => setDraft((current) => ({ ...current, marketRationale: event.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" disabled={!draft.fixtureId || isLoading || isSaving} onClick={save}>
            {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
            {isSaving ? "Kartlar çiziliyor…" : "Kaydet / İçerik Üret"}
          </Button>
          <p className="text-xs text-muted-foreground">
            İki takımın kartı çizilir ve taslak (DRAFT) olarak kaydedilir. Takvimde bu maç için planlanmış bir kayıt varsa
            üretim onun üzerine yazılır, yayın zamanı korunur. Fal.ai kullanılmaz — ücretsizdir.
          </p>
          {saveError ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
              <AlertCircle className="size-3.5 shrink-0" />
              {saveError}
            </p>
          ) : null}
          {savedId ? (
            <p className="flex items-center gap-1.5 text-sm text-emerald-300" role="status">
              <CircleCheck className="size-4 shrink-0" />
              Taslak kaydedildi.
              <Link href={`/dashboard/drafts/${savedId}`} className="underline underline-offset-4">
                İncele
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <div className="xl:col-span-2">
        <MarketAnalysisPreview draft={draft} />
      </div>
    </div>
  );
}
