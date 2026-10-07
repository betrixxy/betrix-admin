"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, Info, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { loadLineupAction, saveLineupAction, type LineupLoadResult } from "@/app/dashboard/studio/lineup/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { HEADLINE_ANNOUNCED, HEADLINE_PREDICTED, describeSource, emptyTeamLineup, lineupIssues } from "@/lib/dashboard/lineup-draft";
import { cn } from "@/lib/utils";
import type { TeamSide } from "@/types/deep-analysis";
import type { LineupDraft } from "@/types/lineup";
import type { MatchDayFixtureOption } from "@/types/match-day";
import type { MediaAssetOption } from "@/types/media";
import { LineupHeroFields } from "./lineup-hero-fields";
import { LineupPreview } from "./lineup-preview";
import { TeamLineupFields } from "./team-lineup-fields";

interface LineupFormProps {
  fixtures: MatchDayFixtureOption[];
  /** `?fixtureId=` ile gelen, listede doğrulanmış maç — açılışta verisi otomatik yüklenir. */
  initialFixtureId: string | null;
  /** Medya kütüphanesindeki oyuncu fotoğrafları — kapak oyuncusu için (bkz. CLAUDE.md 1.11). */
  playerOptions: MediaAssetOption[];
  falConfigured: boolean;
}

/** Veriden yeniden doldurma, aynı maçta admin'in ürettiği kapağı ve seçtiği rengi ezmez. */
function keepVisuals(next: LineupDraft, current: LineupDraft): LineupDraft {
  if (next.fixtureId !== current.fixtureId) return next;
  const side = (key: TeamSide) => ({
    ...next[key],
    heroImageUrl: current[key].heroImageUrl,
    colorHex: current[key].colorHex || next[key].colorHex,
  });
  return { ...next, home: side("home"), away: side("away") };
}

function draftFor(fixture: MatchDayFixtureOption | undefined): LineupDraft {
  return {
    fixtureId: fixture?.id ?? "",
    headline: HEADLINE_PREDICTED,
    matchLabel: fixture ? `${fixture.league} · ${fixture.date.split("-").reverse().slice(0, 2).join(".")} · ${fixture.time}` : "",
    home: emptyTeamLineup(fixture?.homeTeam, fixture?.homeLogoUrl),
    away: emptyTeamLineup(fixture?.awayTeam, fixture?.awayLogoUrl),
  };
}

export function LineupForm({ fixtures, initialFixtureId, playerOptions, falConfigured }: LineupFormProps) {
  const [fixtureId, setFixtureId] = useState(initialFixtureId ?? "");
  const [draft, setDraft] = useState<LineupDraft>(() => draftFor(fixtures.find((f) => f.id === initialFixtureId)));
  const [loaded, setLoaded] = useState<LineupLoadResult | null>(null);
  const [side, setSide] = useState<TeamSide>("home");
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const autoLoaded = useRef(false);

  function load(id: string) {
    setError(null);
    startLoading(async () => {
      const result = await loadLineupAction(id);
      if (!result.ok) {
        setError(`Kadro verisi alınamadı: ${result.error.message} — pozisyonları elle doldurabilirsiniz.`);
        return;
      }
      setLoaded(result.data);
      setDraft((current) => keepVisuals(result.data.draft, current));
    });
  }

  function selectFixture(id: string) {
    setFixtureId(id);
    setSavedId(null);
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

  const issues = draft.fixtureId ? [...lineupIssues(draft.home), ...lineupIssues(draft.away)] : [];

  function save() {
    setSaveError(null);
    setSavedId(null);
    startSaving(async () => {
      const result = await saveLineupAction(draft);
      if (!result.ok) {
        setSaveError(result.error.message);
        return;
      }
      setSavedId(result.data.id);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <div className="flex flex-col gap-6 xl:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>Maç ve Kaynak</CardTitle>
            <CardDescription>
              Maçı seçin — açıklanmış ilk 11 varsa o, yoksa iki takımın son maçındaki ilk 11 ve diziliş referans taslak olarak
              yüklenir. Seçim listeleri takımların güncel kadrosudur; her pozisyon değiştirilebilir.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="lineup-fixture">Maç (API-Football · önümüzdeki 7 gün)</Label>
                <NativeSelect id="lineup-fixture" value={fixtureId} onChange={(event) => selectFixture(event.target.value)} disabled={isLoading}>
                  <option value="">{fixtures.length ? "Maç seçin…" : "Maç bulunamadı"}</option>
                  {fixtures.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="button" variant="outline" disabled={!fixtureId || isLoading} onClick={() => load(fixtureId)} title="Kadroları yeniden çek ve formu sıfırla">
                {isLoading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                {isLoading ? "Yükleniyor…" : "Veriden doldur"}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lineup-headline">Kart başlığı</Label>
                <NativeSelect id="lineup-headline" value={draft.headline} onChange={(event) => setDraft({ ...draft, headline: event.target.value })}>
                  <option value={HEADLINE_PREDICTED}>{HEADLINE_PREDICTED}</option>
                  <option value={HEADLINE_ANNOUNCED}>{HEADLINE_ANNOUNCED}</option>
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lineup-match-label">Maç künyesi</Label>
                <Input id="lineup-match-label" value={draft.matchLabel} maxLength={80} onChange={(event) => setDraft({ ...draft, matchLabel: event.target.value })} />
              </div>
            </div>
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
            <CardTitle>İlk 11</CardTitle>
            <CardDescription>Her takım için ayrı bir kart üretilir.</CardDescription>
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

            {loaded ? (
              <p className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-muted-foreground">
                <Info className="size-3.5 shrink-0 text-emerald-300" />
                Referans: {describeSource(loaded[side].source)} · Kadroda {loaded[side].squad.length} oyuncu
              </p>
            ) : null}

            <TeamLineupFields
              idPrefix={side}
              value={draft[side]}
              squad={loaded?.[side].squad ?? []}
              onChange={(next) => setDraft((current) => ({ ...current, [side]: next }))}
            />
          </CardContent>
        </Card>

        <LineupHeroFields
          draft={draft}
          playerOptions={playerOptions}
          falConfigured={falConfigured}
          onHeroChange={(target, heroImageUrl) => setDraft((current) => ({ ...current, [target]: { ...current[target], heroImageUrl } }))}
        />

        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" disabled={!draft.fixtureId || isLoading || isSaving || issues.length > 0} onClick={save}>
            {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
            {isSaving ? "Kartlar çiziliyor…" : "Kaydet / İçerik Üret"}
          </Button>
          {issues.length > 0 ? (
            <div className="flex flex-col gap-0.5 text-xs text-amber-300" role="status">
              {issues.map((issue) => (
                <span key={issue}>• {issue}</span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              İki takımın kartı çizilir ve taslak (DRAFT) olarak kaydedilir; takvimde planlanmış bir kayıt varsa üzerine yazılır.
              Fal.ai kullanılmaz — ücretsizdir.
            </p>
          )}
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
        <LineupPreview draft={draft} />
      </div>
    </div>
  );
}
