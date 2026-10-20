"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, Eye, LoaderCircle, Save, Sparkles } from "lucide-react";
import { loadVitrinAction, previewVitrinAction, saveVitrinAction, writeReasonsAction, type VitrinLoadResult } from "@/app/dashboard/studio/market-analysis/vitrin-actions";
import { ArchivePhotoPicker } from "@/components/features/archive/archive-photo-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFixtureOption, type MatchDayFormatId } from "@/types/match-day";
import { LOCKED_BOX_COUNT, OPEN_BOX_COUNT, SCENARIO_IDS, type ScenarioId } from "@/types/prediction";
import { VitrinScenarioTable, type BoxRole } from "./vitrin-scenario-table";

/** Varsayılan roller: 1X2 + iki takım gol açık; ilk yarı, gol yağmuru, senaryo kilitli; "gollü maç" kartta yok. */
const DEFAULT_ROLES: Record<ScenarioId, BoxRole> = { RESULT_1X2: "open", BTTS: "open", GOALS_3PLUS: "none", GOALS_4PLUS: "locked", HT_RESULT: "locked", COMBO: "locked" };

const byRole = (roles: Record<ScenarioId, BoxRole>, role: BoxRole) => SCENARIO_IDS.filter((id) => roles[id] === role);

/**
 * Maç önü vitrin stüdyosu (AI_MARKET_PREDICTION). Maç seçilir → tahmin + kural tabanlı gerekçeler →
 * (isteğe bağlı) Çelik Kasa analisti gerekçeleri yazar → kutu rolleri, fotoğraf, format → önizle /
 * kaydet. Yüzdeler düzenlenemez; kayıtta sunucuda yeniden hesaplanır.
 */
export function VitrinForm({ fixtures, initialFixtureId }: { fixtures: MatchDayFixtureOption[]; initialFixtureId: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [fixtureId, setFixtureId] = useState(initialFixtureId ?? "");
  const [data, setData] = useState<VitrinLoadResult | null>(null);
  const [roles, setRoles] = useState<Record<ScenarioId, BoxRole>>(DEFAULT_ROLES);
  const [reasons, setReasons] = useState<Record<ScenarioId, string>>({} as Record<ScenarioId, string>);
  const [format, setFormat] = useState<MatchDayFormatId>("IG_PORTRAIT");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "ai" | "preview" | "save" | null>(null);
  const [, startTransition] = useTransition();

  const open = byRole(roles, "open");
  const locked = byRole(roles, "locked");
  const selectionOk = open.length === OPEN_BOX_COUNT && locked.length === LOCKED_BOX_COUNT;
  const teams = useMemo(() => (data ? [{ id: data.homeTeamId, name: data.homeName }, { id: data.awayTeamId, name: data.awayName }] : []), [data]);

  function apply(result: Awaited<ReturnType<typeof loadVitrinAction>>) {
    if (!result.ok) return setError(result.error.message);
    setError(null);
    setData(result.data);
    setReasons(Object.fromEntries(result.data.rows.map((row) => [row.id, row.reason])) as Record<ScenarioId, string>);
  }

  function run(kind: NonNullable<typeof busy>, task: () => Promise<void>) {
    setBusy(kind);
    startTransition(async () => {
      try {
        await task();
      } finally {
        setBusy(null);
      }
    });
  }

  function formData(): FormData {
    const body = formRef.current ? new FormData(formRef.current) : new FormData();
    body.set("fixtureId", fixtureId);
    body.set("format", format);
    body.set("open", JSON.stringify(open));
    body.set("locked", JSON.stringify(locked));
    body.set("reasons", JSON.stringify(reasons));
    return body;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Maç Önü Vitrin Kartı</CardTitle>
          <CardDescription>
            Kazanma olasılıkları ve senaryolar modelden; gerekçeler veriden ve denetimli. Bahis dili yok — yasaklı sözcük geçerse kart üretilmez. Açık 2 kutu onayda değiştirilemez şekilde kaydedilir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                <Label htmlFor="vitrin-fixture">Maç</Label>
                <NativeSelect id="vitrin-fixture" value={fixtureId} onChange={(event) => { setFixtureId(event.target.value); setData(null); setPreview(null); }}>
                  <option value="">{fixtures.length ? "Maç seçin…" : "Maç bulunamadı"}</option>
                  {fixtures.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </NativeSelect>
              </div>
              <Button type="button" variant="secondary" disabled={!fixtureId || busy !== null} onClick={() => run("load", async () => apply(await loadVitrinAction(fixtureId)))}>
                {busy === "load" ? <LoaderCircle className="animate-spin" /> : null} Veriyi yükle
              </Button>
              <Button type="button" variant="secondary" disabled={!data?.analystAvailable || busy !== null} onClick={() => run("ai", async () => apply(await writeReasonsAction(fixtureId)))} title={data && !data.analystAvailable ? "ANTHROPIC_API_KEY tanımlı değil" : undefined}>
                {busy === "ai" ? <LoaderCircle className="animate-spin" /> : <Sparkles />} Gerekçeleri AI analist yazsın
              </Button>
            </div>

            {data ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Model {data.scenarioCount} senaryo hesapladı · en sürpriz %{data.surprisePct}. Tam 2 açık + 3 kilitli kutu seçin ({open.length}/2 açık, {locked.length}/3 kilitli).
                </p>
                <VitrinScenarioTable rows={data.rows} roles={roles} reasons={reasons} onRole={(id, role) => setRoles((current) => ({ ...current, [id]: role }))} onReason={(id, reason) => setReasons((current) => ({ ...current, [id]: reason }))} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <ArchivePhotoPicker name="photo" label="Kapak fotoğrafı (Fotoğraf Arşivi)" teams={teams} fixtureId={fixtureId || null} defaultSubject="team" />
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="vitrin-format">Format</Label>
                    <NativeSelect id="vitrin-format" value={format} onChange={(event) => setFormat(event.target.value as MatchDayFormatId)}>
                      {MATCH_DAY_FORMAT_IDS.map((id) => (
                        <option key={id} value={id}>{MATCH_DAY_FRAMES[id].label} · {MATCH_DAY_FRAMES[id].ratioLabel}</option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
              </>
            ) : null}

            {error ? <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{error}</p> : null}

            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={!data || !selectionOk || busy !== null} onClick={() => run("preview", async () => {
                const result = await previewVitrinAction(formData());
                if (result.ok) { setPreview(result.data.dataUrl); setError(null); } else setError(result.error.message);
              })}>
                {busy === "preview" ? <LoaderCircle className="animate-spin" /> : <Eye />} Önizle
              </Button>
              <Button type="button" disabled={!data || !selectionOk || busy !== null} onClick={() => run("save", async () => {
                const result = await saveVitrinAction(formData());
                if (!result.ok) setError(result.error.message);
              })}>
                {busy === "save" ? <LoaderCircle className="animate-spin" /> : <Save />} Kaydet (taslak)
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Önizleme</CardTitle>
          <CardDescription>Kaydedilmez; arşivden seçilen fotoğrafla çizilir (yeni yükleme kayıtta arşive girer).</CardDescription>
        </CardHeader>
        <CardContent>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL önizleme
            <img src={preview} alt="Vitrin kartı önizlemesi" className="w-full rounded-md ring-1 ring-border" />
          ) : (
            <p className="py-16 text-center text-xs text-muted-foreground">Veriyi yükleyip &quot;Önizle&quot;ye basın.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
