"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertCircle, CircleCheck, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { loadStandingsAction, saveStandingsAction } from "@/app/dashboard/studio/standings/actions";
import { GlobalFormatSelector } from "@/components/features/dashboard/studio/global-format-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { seasonLabel, selectSections, standingsCapacity, standingsLayout, standingsPlan } from "@/lib/dashboard/standings-layout";
import { SUPPORTED_LEAGUES, type SupportedLeagueId } from "@/lib/services/api-football/leagues";
import { ALL_GROUPS, type StandingsDraft, type StandingsLoadResult } from "@/types/standings";
import { DEFAULT_SOCIAL_FORMAT, SOCIAL_FORMATS, type SocialFormatId } from "@/types/studio-formats";
import { StandingsPreview } from "./standings-preview";

interface StandingsFormProps {
  initialLeagueId: SupportedLeagueId;
  /** Stüdyoyu açan maç — kayıt bu maça bağlanır; yoksa bağımsız kayıt. */
  anchorFixtureId: string | null;
}

const DEFAULT_TITLE = "Puan Durumu";

export function StandingsForm({ initialLeagueId, anchorFixtureId }: StandingsFormProps) {
  const [leagueId, setLeagueId] = useState(initialLeagueId);
  const [table, setTable] = useState<StandingsLoadResult | null>(null);
  const [groupKey, setGroupKey] = useState("");
  const [rankFrom, setRankFrom] = useState(1);
  const [rankTo, setRankTo] = useState(1);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [format, setFormat] = useState<SocialFormatId>(DEFAULT_SOCIAL_FORMAT);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const started = useRef(false);

  function setRange(from: number, to: number) {
    setRankFrom(from);
    setRankTo(to);
  }

  function selectGroup(result: StandingsLoadResult, key: string) {
    setGroupKey(key);
    setRankFrom(1);
    setRankTo(result.groups.find((group) => group.key === key)?.rows.length ?? 1);
  }

  function load(league: SupportedLeagueId, season?: number) {
    setError(null);
    setSavedId(null);
    startLoading(async () => {
      const result = await loadStandingsAction(league, season);
      if (!result.ok) {
        setTable(null);
        setError(`Puan durumu alınamadı: ${result.error.message}`);
        return;
      }
      setTable(result.data);
      // Gruplu turnuvada varsayılan tüm gruplar; tek tabloda tablonun tamamı.
      const first = result.data.groups[0];
      if (result.data.groups.length > 1) {
        setGroupKey(ALL_GROUPS);
        setRankFrom(1);
        setRankTo(64);
      } else if (first) selectGroup(result.data, first.key);
    });
  }

  useEffect(() => {
    // Açılışta bir kez: ligin güncel sezon tablosu.
    if (started.current) return;
    started.current = true;
    load(initialLeagueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref korumalı tek seferlik açılış yüklemesi.
  }, [initialLeagueId]);

  const group = table?.groups.find((candidate) => candidate.key === groupKey) ?? null;
  const single = groupKey !== ALL_GROUPS;
  const sections = table && groupKey ? selectSections(table.groups, { groupKey, rankFrom, rankTo }) : null;
  const fits = sections?.ok ? standingsPlan(sections.data, standingsLayout(format)) !== null : false;
  const capacity = standingsCapacity(format);
  const draft: StandingsDraft | null = table && groupKey && title.trim() && rankFrom <= rankTo ? { leagueId, season: table.season, groupKey, rankFrom, rankTo, title: title.trim(), format } : null;
  // Uzun tablo (ör. 36 takımlık lig aşaması) iki karta bölünür: ilk yarı / ikinci yarı.
  const half = group ? Math.ceil(group.rows.length / 2) : 0;

  function save() {
    if (!draft) return;
    setSaveError(null);
    setSavedId(null);
    startSaving(async () => {
      const result = await saveStandingsAction(draft, anchorFixtureId);
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
            <CardTitle>Lig, Sezon ve Grup</CardTitle>
            <CardDescription>
              Puan durumu API-Football&apos;dan her çizimde güncel okunur. Kupa grup aşamasında tüm gruplar tek kartta ya da tek grup seçilebilir;
              uzun tabloyu sıra aralığıyla iki karta bölebilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="standings-league">Lig</Label>
                <NativeSelect
                  id="standings-league"
                  value={leagueId}
                  disabled={isLoading}
                  onChange={(event) => {
                    const next = SUPPORTED_LEAGUES.find((league) => league.id === event.target.value)?.id ?? leagueId;
                    setLeagueId(next);
                    load(next);
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
                <Label htmlFor="standings-season">Sezon</Label>
                <NativeSelect id="standings-season" value={table?.season ?? ""} disabled={isLoading || !table} onChange={(event) => load(leagueId, Number(event.target.value))}>
                  {(table?.seasons ?? []).map((season) => (
                    <option key={season} value={season}>
                      {seasonLabel(season)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="standings-group">Grup</Label>
                <NativeSelect
                  id="standings-group"
                  value={groupKey}
                  disabled={isLoading || !table || table.groups.length < 2}
                  onChange={(event) => {
                    if (!table) return;
                    if (event.target.value === ALL_GROUPS) {
                      setGroupKey(ALL_GROUPS);
                      return;
                    }
                    selectGroup(table, event.target.value);
                  }}
                >
                  {table && table.groups.length > 1 ? <option value={ALL_GROUPS}>Tüm gruplar</option> : null}
                  {(table?.groups ?? []).map((candidate) => (
                    <option key={candidate.key} value={candidate.key}>
                      {candidate.label || "Tek tablo"} ({candidate.rows.length} takım)
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                <Label htmlFor="standings-title">Kart başlığı</Label>
                <Input id="standings-title" value={title} maxLength={40} onChange={(event) => setTitle(event.target.value)} />
              </div>
              {single && group ? (
                <>
                  <div className="flex w-24 flex-col gap-1.5">
                    <Label htmlFor="standings-from">Sıradan</Label>
                    <Input id="standings-from" type="number" min={1} max={group.rows.length} value={rankFrom} onChange={(event) => setRankFrom(Math.max(1, Number(event.target.value) || 1))} />
                  </div>
                  <div className="flex w-24 flex-col gap-1.5">
                    <Label htmlFor="standings-to">Sıraya</Label>
                    <Input id="standings-to" type="number" min={1} max={group.rows.length} value={rankTo} onChange={(event) => setRankTo(Math.max(1, Number(event.target.value) || 1))} />
                  </div>
                </>
              ) : null}
              <Button type="button" variant="outline" disabled={isLoading} onClick={() => load(leagueId, table?.season)} title="Tabloyu yeniden çek">
                {isLoading ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                {isLoading ? "Yükleniyor…" : "Yenile"}
              </Button>
            </div>

            {single && group && group.rows.length > capacity ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Tablo {group.rows.length} takım — iki karta bölün:</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setRange(1, half)}>
                  1–{half}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setRange(half + 1, group.rows.length)}>
                  {half + 1}–{group.rows.length}
                </Button>
              </div>
            ) : null}

            {sections && !sections.ok ? (
              <p className="flex items-center gap-1.5 text-xs text-amber-300" role="status">
                <AlertCircle className="size-3.5 shrink-0" />
                {sections.error.message}
              </p>
            ) : sections?.ok && !fits ? (
              <p className="flex items-center gap-1.5 text-xs text-amber-300" role="status">
                <AlertCircle className="size-3.5 shrink-0" />
                Seçim {SOCIAL_FORMATS[format].label} kartına sığmıyor — tek tabloda en fazla {capacity} takım. Sıra aralığını
                daraltın, kartı bölün ya da yatay formatı seçin.
              </p>
            ) : null}
            {error ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3.5 shrink-0" />
                {error}
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
          <p className="text-xs text-muted-foreground">Kart güncel tabloyla çizilir ve taslak (DRAFT) olarak kaydedilir. Fal.ai kullanılmaz — ücretsizdir.</p>
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
        <StandingsPreview draft={draft} format={format} disabled={!fits || isLoading} />
      </div>
    </div>
  );
}
