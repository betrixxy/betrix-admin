"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CircleCheck, LoaderCircle, RefreshCw, Save, Sparkles } from "lucide-react";
import {
  generateExpertAnalysisAction,
  loadDeepAnalysisAction,
  saveMarketAnalysisAction,
  type DeepAnalysisLoadResult,
} from "@/app/dashboard/studio/market-analysis/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { emptyTeamDraft } from "@/lib/dashboard/deep-analysis-insights";
import { cn } from "@/lib/utils";
import type { MarketAnalysisDraft, TeamSide } from "@/types/deep-analysis";
import type { MediaAssetOption } from "@/types/media";
import type { MatchDayFixtureOption } from "@/types/match-day";
import { AnalysisHeroFields } from "./analysis-hero-fields";
import { DataSummary } from "./data-summary";
import { MarketAnalysisPreview } from "./market-analysis-preview";
import { MarketPickCard } from "./market-pick-card";
import { TeamAnalysisFields } from "./team-analysis-fields";

interface MarketAnalysisFormProps {
  fixtures: MatchDayFixtureOption[];
  /** `?fixtureId=` ile gelen, listede doğrulanmış maç — açılışta verisi otomatik yüklenir. */
  initialFixtureId: string | null;
  /** ANTHROPIC_API_KEY tanımlı mı — değilse "AI Analist" pasiftir, öneriler kural tabanlı kalır. */
  analystAvailable: boolean;
  /** Medya kütüphanesindeki oyuncu fotoğrafları — kapak için (bkz. CLAUDE.md 1.11). */
  playerOptions: MediaAssetOption[];
  falConfigured: boolean;
}

/** Veriden/analistten gelen yeni taslak, admin'in seçtiği renk ve üretilmiş kapağı ezmez. */
function keepVisuals(next: MarketAnalysisDraft, current: MarketAnalysisDraft): MarketAnalysisDraft {
  if (next.fixtureId !== current.fixtureId) return next;
  const side = (key: TeamSide) => ({ ...next[key], colorHex: current[key].colorHex, heroImageUrl: current[key].heroImageUrl });
  return { ...next, home: side("home"), away: side("away") };
}


function draftFor(fixture: MatchDayFixtureOption | undefined): MarketAnalysisDraft {
  return {
    fixtureId: fixture?.id ?? "",
    home: emptyTeamDraft(fixture?.homeTeam, fixture?.homeLogoUrl),
    away: emptyTeamDraft(fixture?.awayTeam, fixture?.awayLogoUrl),
    marketPick: "",
    marketRationale: "",
  };
}

export function MarketAnalysisForm({ fixtures, initialFixtureId, analystAvailable, playerOptions, falConfigured }: MarketAnalysisFormProps) {
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
      // Takım renkleri ve kapaklar dışındaki her şey analistin taslağıyla değişir.
      setDraft((current) => keepVisuals(result.data.draft, current));
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
      setDraft((current) => keepVisuals(result.data.draft, current));
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
              title={analystAvailable ? "Claude, maç verisinden iki takımın analizini ve market tahminini yazar (ücretli, birkaç saniye)" : "ANTHROPIC_API_KEY tanımlı değil"}
            >
              {isWriting ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              {isWriting ? "Analist yazıyor…" : "AI Analist ile Yaz"}
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

        <AnalysisHeroFields
          draft={draft}
          playerOptions={playerOptions}
          falConfigured={falConfigured}
          onHeroChange={(side, heroImageUrl) => setDraft((current) => ({ ...current, [side]: { ...current[side], heroImageUrl } }))}
        />

        <MarketPickCard
          suggestions={loaded?.suggestions ?? null}
          marketPick={draft.marketPick}
          marketRationale={draft.marketRationale}
          onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
        />

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
