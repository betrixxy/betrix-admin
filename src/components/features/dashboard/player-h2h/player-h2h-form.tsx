"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, Eye, LoaderCircle, Save } from "lucide-react";
import { analyzeH2HAction, matchContextAction, previewH2HAction, saveH2HAction, type H2HAnalysis, type H2HStudioRequest } from "@/app/dashboard/studio/player-h2h/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import type { H2HMatchContext, H2HPlayerOption } from "@/lib/dashboard/player-h2h-studio";
import { h2hStudioIssues } from "@/lib/player-h2h/studio-issues";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFixtureOption, type MatchDayFormatId } from "@/types/match-day";
import type { H2HMode, H2HScope } from "@/types/player-h2h";
import { EMPTY_SLOT, PlayerSlot, type SlotValue } from "./player-slot";

const MODE_LABELS: Record<H2HMode, string> = { TOTAL: "Sezon toplamı", PER90: "90 dakika başına" };

function Notes({ items, tone = "warn" }: { items: string[]; tone?: "warn" | "error" }) {
  if (items.length === 0) return null;
  return (
    <ul className={tone === "error" ? "flex flex-col gap-0.5 text-xs text-destructive" : "flex flex-col gap-0.5 text-xs text-amber-300"} aria-live="polite">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-1.5"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{item}</li>
      ))}
    </ul>
  );
}

/**
 * Oyuncu karşılaştırma stüdyosu (PLAYER_H2H). Maçtan başla: maç seçilince iki takımın gol + asist lideri
 * önerilir (değiştirilebilir) · serbest: herhangi iki oyuncu. Kapsam (lig / tüm turnuvalar) ve adalet
 * (otomatik / toplam / 90 dk); uyarılar tek satır; pasif butonların nedeni her zaman yazılır.
 */
export function PlayerH2HForm({ fixtures, players, initialFixtureId }: { fixtures: MatchDayFixtureOption[]; players: H2HPlayerOption[]; initialFixtureId: string | null }) {
  const [start, setStart] = useState<"match" | "free">(initialFixtureId ? "match" : "free");
  const [fixtureId, setFixtureId] = useState(initialFixtureId ?? "");
  const [match, setMatch] = useState<H2HMatchContext | null>(null);
  const [left, setLeft] = useState<SlotValue>(EMPTY_SLOT);
  const [right, setRight] = useState<SlotValue>(EMPTY_SLOT);
  const [scope, setScope] = useState<H2HScope>("LEAGUE");
  const [mode, setMode] = useState<H2HMode | "AUTO">("AUTO");
  const [format, setFormat] = useState<MatchDayFormatId>("IG_PORTRAIT");
  // Analiz ve önizleme ait oldukları seçimin anahtarıyla saklanır; seçim değişince kendiliğinden geçersiz.
  const selectionKey = [left.key, right.key, scope, mode].join("|");
  const [analyzed, setAnalyzed] = useState<{ key: string; analysis: H2HAnalysis | null; error: string | null } | null>(null);
  const [previewState, setPreview] = useState<{ key: string; urls: [string, string]; warnings: string[] } | null>(null);
  const current = analyzed?.key === selectionKey ? analyzed : null;
  const analysis = current?.analysis ?? null;
  const analysisError = current?.error ?? null;
  const preview = previewState && previewState.key === [selectionKey, format, JSON.stringify([left, right])].join("|") ? previewState : null;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"preview" | "save" | null>(null);
  const [matchLoading, startMatch] = useTransition();
  const [analyzing, startAnalysis] = useTransition();
  const [, startAction] = useTransition();

  // Maç seçilince: takımlar + öneriler (gol + asist lideri); seçimler öneriye ayarlanır.
  useEffect(() => {
    if (start !== "match" || !fixtureId) return;
    startMatch(async () => {
      const result = await matchContextAction(fixtureId);
      if (!result.ok) return setError(result.error.message);
      setMatch(result.data);
      setLeft({ ...EMPTY_SLOT, key: result.data.suggestions.home });
      setRight({ ...EMPTY_SLOT, key: result.data.suggestions.away });
    });
  }, [start, fixtureId]);

  // Seçim değişince: veri, varsayılan adalet, uyarılar, gelen/düşen satırlar.
  useEffect(() => {
    if (!left.key || !right.key) return;
    const [l, r, key] = [left.key, right.key, selectionKey];
    startAnalysis(async () => {
      const result = await analyzeH2HAction({ left: l, right: r, scope, mode: mode === "AUTO" ? null : mode });
      setAnalyzed({ key, analysis: result.ok ? result.data : null, error: result.ok ? null : result.error.message });
    });
  }, [left.key, right.key, scope, mode, selectionKey]);

  const matchShown = match && match.fixtureId === fixtureId && start === "match" ? match : null;

  const options = useMemo(() => {
    if (!matchShown) return { left: players, right: players };
    return { left: players.filter((p) => p.teamId === matchShown.homeTeam.id), right: players.filter((p) => p.teamId === matchShown.awayTeam.id) };
  }, [matchShown, players]);

  const blockers = h2hStudioIssues({ start, fixtureId: fixtureId || null, matchLoading, left: left.key, right: right.key, analyzing, analysisError, busy: busy !== null });

  function request(): H2HStudioRequest {
    const side = (slot: SlotValue) => ({ key: slot.key ?? "", photoId: slot.photoId, poster: slot.poster, portrait: slot.portrait });
    return { left: side(left), right: side(right), scope, mode: mode === "AUTO" ? null : mode, format, fixtureId: start === "match" && fixtureId ? fixtureId : null };
  }

  function run(kind: NonNullable<typeof busy>, task: () => Promise<void>) {
    setBusy(kind);
    startAction(async () => {
      try {
        await task();
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Oyuncu Karşılaştırması</CardTitle>
          <CardDescription>İki oyuncunun sezon istatistikleri: 01 poster + 02 kelebek grafiği. Eksik veri 0 yazılmaz, satır düşer. Analiz dili; bahis dili yok.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="h2h-start">Başlangıç</Label>
              <NativeSelect id="h2h-start" value={start} onChange={(event) => { setStart(event.target.value as "match" | "free"); setLeft(EMPTY_SLOT); setRight(EMPTY_SLOT); }}>
                <option value="match">Maçtan başla</option>
                <option value="free">Serbest (herhangi iki oyuncu)</option>
              </NativeSelect>
            </div>
            {start === "match" ? (
              <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                <Label htmlFor="h2h-fixture">Maç</Label>
                <NativeSelect id="h2h-fixture" value={fixtureId} onChange={(event) => setFixtureId(event.target.value)}>
                  <option value="">{fixtures.length ? "Maç seçin…" : "Maç bulunamadı"}</option>
                  {fixtures.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </NativeSelect>
              </div>
            ) : null}
            {matchLoading ? <LoaderCircle className="mb-2 size-4 animate-spin text-muted-foreground" /> : null}
          </div>
          {matchShown ? <Notes items={matchShown.warnings} /> : null}

          <div className="grid gap-3 md:grid-cols-2">
            <PlayerSlot id="h2h-left" label={matchShown ? `Sol · ${matchShown.homeTeam.name}` : "Sol oyuncu"} options={options.left} value={left} onChange={setLeft} />
            <PlayerSlot id="h2h-right" label={matchShown ? `Sağ · ${matchShown.awayTeam.name}` : "Sağ oyuncu"} options={options.right} value={right} onChange={setRight} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="h2h-scope">Kapsam</Label>
              <NativeSelect id="h2h-scope" value={scope} onChange={(event) => setScope(event.target.value as H2HScope)}>
                <option value="LEAGUE">Bu sezon · lig</option>
                <option value="ALL">Bu sezon · tüm turnuvalar</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="h2h-mode">Toplam / 90 dk</Label>
              <NativeSelect id="h2h-mode" value={mode} onChange={(event) => setMode(event.target.value as H2HMode | "AUTO")}>
                <option value="AUTO">Otomatik{analysis ? ` (${MODE_LABELS[analysis.defaultMode].toLocaleLowerCase("tr-TR")})` : ""}</option>
                <option value="TOTAL">{MODE_LABELS.TOTAL}</option>
                <option value="PER90">{MODE_LABELS.PER90}</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="h2h-format">Format</Label>
              <NativeSelect id="h2h-format" value={format} onChange={(event) => setFormat(event.target.value as MatchDayFormatId)}>
                {MATCH_DAY_FORMAT_IDS.map((id) => <option key={id} value={id}>{MATCH_DAY_FRAMES[id].label} · {MATCH_DAY_FRAMES[id].ratioLabel}</option>)}
              </NativeSelect>
            </div>
          </div>

          {analysis ? (
            <div className="flex flex-col gap-1 rounded-md bg-muted/30 p-3 text-xs">
              {analysis.samples.map((line) => <p key={line} className="text-muted-foreground">{line}</p>)}
              <p><span className="text-muted-foreground">Kahramanlar:</span> {analysis.hero.join(" · ")}</p>
              <p><span className="text-muted-foreground">Satırlar (4:5):</span> {analysis.rows.join(", ")}</p>
              {analysis.dropped.length ? <p className="text-muted-foreground">Düşen: {analysis.dropped.join(", ")}</p> : null}
              <Notes items={analysis.warnings} />
            </div>
          ) : null}

          {error ? <Notes items={[error]} tone="error" /> : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={blockers.length > 0} onClick={() => run("preview", async () => {
              const result = await previewH2HAction(request());
              if (result.ok) { setPreview({ key: [selectionKey, format, JSON.stringify([left, right])].join("|"), urls: result.data.dataUrls, warnings: result.data.warnings }); setError(null); } else setError(result.error.message);
            })}>
              {busy === "preview" ? <LoaderCircle className="animate-spin" /> : <Eye />} Önizle
            </Button>
            <Button type="button" disabled={blockers.length > 0} onClick={() => run("save", async () => {
              const result = await saveH2HAction(request());
              if (!result.ok) setError(result.error.message);
            })}>
              {busy === "save" ? <LoaderCircle className="animate-spin" /> : <Save />} Kaydet (taslak)
            </Button>
          </div>
          {/* Pasif butonun nedeni her zaman görünür — her neden tek satır. */}
          <Notes items={blockers} />
        </CardContent>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Önizleme</CardTitle>
          <CardDescription>Kaydedilmez. Carousel: 01 Poster · 02 İstatistikler.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {preview ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {preview.urls.map((url, index) => (
                  // eslint-disable-next-line @next/next/no-img-element -- data: URL önizleme
                  <img key={index} src={url} alt={index === 0 ? "01 Poster önizlemesi" : "02 İstatistikler önizlemesi"} className="w-full rounded-md ring-1 ring-border" />
                ))}
              </div>
              <Notes items={preview.warnings} />
            </>
          ) : (
            <p className="py-16 text-center text-xs text-muted-foreground">İki oyuncuyu seçip &quot;Önizle&quot;ye basın.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
