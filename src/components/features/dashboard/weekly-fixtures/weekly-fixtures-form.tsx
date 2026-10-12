"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { loadWeeklyMatchesAction, loadWeeklyRoundsAction, saveWeeklyFixturesAction } from "@/app/dashboard/studio/weekly-fixtures/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { GlobalFormatSelector } from "@/components/features/dashboard/studio/global-format-selector";
import { weeklyGrouping, weeklyLayout, weeklyPlan } from "@/lib/dashboard/weekly-fixtures-layout";
import { SUPPORTED_LEAGUES, type SupportedLeagueId } from "@/lib/services/api-football/leagues";
import { DEFAULT_SOCIAL_FORMAT, SOCIAL_FORMATS, type SocialFormatId } from "@/types/studio-formats";
import { WEEKLY_MAX_MATCHES, type WeeklyFixturesDraft, type WeeklyMatch, type WeeklyRoundsResult } from "@/types/weekly-fixtures";
import { WeeklyMatchEditor } from "./weekly-match-editor";
import { WeeklyPreview } from "./weekly-preview";

interface WeeklyFixturesFormProps {
  initialLeagueId: SupportedLeagueId;
  /** Maç Merkezi'nden açıldıysa o maçın turu; yoksa API'nin güncel turu seçilir. */
  initialRoundKey: string | null;
  /** Stüdyoyu açan maç — kayıt bu maça bağlanır (kartta olduğu sürece). */
  anchorFixtureId: string | null;
}

export function WeeklyFixturesForm({ initialLeagueId, initialRoundKey, anchorFixtureId }: WeeklyFixturesFormProps) {
  const [leagueId, setLeagueId] = useState(initialLeagueId);
  const [rounds, setRounds] = useState<WeeklyRoundsResult | null>(null);
  const [roundKey, setRoundKey] = useState("");
  const [matches, setMatches] = useState<WeeklyMatch[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<SocialFormatId>(DEFAULT_SOCIAL_FORMAT);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const started = useRef(false);

  async function fetchMatches(league: SupportedLeagueId, result: WeeklyRoundsResult, key: string) {
    const option = result.options.find((candidate) => candidate.key === key);
    setRoundKey(key);
    setTitle(option?.label ?? "");
    setSavedId(null);
    const loaded = await loadWeeklyMatchesAction({ leagueId: league, season: result.season, roundKey: key });
    if (!loaded.ok) {
      setMatches([]);
      setSelected([]);
      setError(`Maçlar alınamadı: ${loaded.error.message}`);
      return;
    }
    setMatches(loaded.data.matches);
    setSelected(loaded.data.matches.map((match) => match.id));
  }

  function loadRounds(league: SupportedLeagueId, season?: number, preferKey?: string | null) {
    setError(null);
    startLoading(async () => {
      const result = await loadWeeklyRoundsAction(league, season);
      if (!result.ok) {
        setRounds(null);
        setMatches([]);
        setSelected([]);
        setError(`Turlar alınamadı: ${result.error.message}`);
        return;
      }
      setRounds(result.data);
      const keys = result.data.options.map((option) => option.key);
      const key = [preferKey, result.data.currentKey].find((candidate) => candidate && keys.includes(candidate)) ?? keys[0] ?? "";
      await fetchMatches(league, result.data, key);
    });
  }

  useEffect(() => {
    // Açılışta bir kez: ligin turları + (Maç Merkezi'nden gelindiyse o maçın, yoksa güncel) tur yüklenir.
    if (started.current) return;
    started.current = true;
    loadRounds(initialLeagueId, undefined, initialRoundKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref korumalı tek seferlik açılış yüklemesi.
  }, [initialLeagueId, initialRoundKey]);

  const chosen = selected.map((id) => matches.find((match) => match.id === id)).filter((match) => match !== undefined);
  const grouping = weeklyGrouping(chosen);
  const fits = chosen.length <= WEEKLY_MAX_MATCHES && weeklyPlan(chosen, grouping, weeklyLayout(format)) !== null;
  const draft: WeeklyFixturesDraft | null =
    rounds && roundKey && chosen.length > 0 && title.trim() ? { leagueId, season: rounds.season, roundKey, title: title.trim(), matchIds: selected, format } : null;

  function save() {
    if (!draft) return;
    setSaveError(null);
    setSavedId(null);
    startSaving(async () => {
      const result = await saveWeeklyFixturesAction(draft, anchorFixtureId);
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
            <CardTitle>Lig ve Tur</CardTitle>
            <CardDescription>
              Ligi ve haftayı (turu) seçin — o turun maçları API-Football&apos;dan Türkiye saatiyle gelir. Oynanmamış maçta saat, oynanan maçta skor
              gösterilir; kupa grup aşamasında kart gruplara bölünür.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="weekly-league">Lig</Label>
                <NativeSelect
                  id="weekly-league"
                  value={leagueId}
                  disabled={isLoading}
                  onChange={(event) => {
                    const next = SUPPORTED_LEAGUES.find((league) => league.id === event.target.value)?.id ?? leagueId;
                    setLeagueId(next);
                    loadRounds(next);
                  }}
                >
                  {SUPPORTED_LEAGUES.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="weekly-season">Sezon</Label>
                <NativeSelect id="weekly-season" value={rounds?.season ?? ""} disabled={isLoading || !rounds} onChange={(event) => loadRounds(leagueId, Number(event.target.value), roundKey)}>
                  {(rounds?.seasons ?? []).map((season) => (
                    <option key={season} value={season}>
                      {season}/{String(season + 1).slice(2)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="weekly-round">Hafta / Tur</Label>
                <NativeSelect
                  id="weekly-round"
                  value={roundKey}
                  disabled={isLoading || !rounds}
                  onChange={(event) => rounds && startLoading(() => fetchMatches(leagueId, rounds, event.target.value))}
                >
                  {(rounds?.options ?? []).map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                      {option.key === rounds?.currentKey ? " (güncel)" : ""}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="weekly-title">Kart başlığı</Label>
                <Input id="weekly-title" value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <Button type="button" variant="outline" disabled={isLoading || !rounds} onClick={() => loadRounds(leagueId, rounds?.season, roundKey)} title="Skorları/saatleri yeniden çek">
                {isLoading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                {isLoading ? "Yükleniyor…" : "Yenile"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">&quot; · &quot; ile ayrılan başlıkta ilk kısım üst satıra küçük yazılır (ör. &quot;Lig Aşaması · 2. Maç Günü&quot;).</p>
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
            <CardTitle>Karttaki Maçlar ({chosen.length})</CardTitle>
            <CardDescription>Sırayı değiştirin ya da maç çıkarın. Kalabalık turlarda kartı ikiye bölüp her yarıyı ayrı kaydedin.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {matches.length > 0 ? <WeeklyMatchEditor matches={matches} selected={selected} onChange={setSelected} overflow={!fits || matches.length > WEEKLY_MAX_MATCHES} /> : null}
            {!isLoading && matches.length === 0 && !error ? <p className="text-sm text-muted-foreground">Bu turda maç bulunamadı.</p> : null}
            {chosen.length > 0 && !fits ? (
              <p className="flex items-center gap-1.5 text-xs text-amber-300" role="status">
                <AlertCircle className="size-3.5 shrink-0" />
                {chosen.length} maç {SOCIAL_FORMATS[format].label} kartına sığmıyor (en fazla {WEEKLY_MAX_MATCHES}, gün/grup başlıkları da yer kaplar) — birkaç maçı çıkarın, kartı bölün ya da daha uzun bir format seçin.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <GlobalFormatSelector value={format} onChange={setFormat} disabled={isSaving} />

        <div className="flex flex-col gap-2">
          <Button type="button" size="lg" disabled={!draft || !fits || isLoading || isSaving} onClick={save}>
            {isSaving ? <LoaderCircle className="animate-spin" /> : <Save />}
            {isSaving ? "Kart çiziliyor…" : "Kaydet / İçerik Üret"}
          </Button>
          <p className="text-xs text-muted-foreground">Kart güncel skor/saatle çizilir ve taslak (DRAFT) olarak kaydedilir. Fal.ai kullanılmaz — ücretsizdir.</p>
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
        <WeeklyPreview draft={draft} format={format} disabled={!fits || isLoading} />
      </div>
    </div>
  );
}
