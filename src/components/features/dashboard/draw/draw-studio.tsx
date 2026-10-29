"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, History, LoaderCircle, Save } from "lucide-react";
import { compareDrawAction, previewDrawAction, saveDrawAction } from "@/app/dashboard/studio/draw/actions";
import { ArchivePhotoPicker } from "@/components/features/archive/archive-photo-picker";
import { MatchDayFormatPicker } from "@/components/features/dashboard/match-day-format-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import type { DrawComparison } from "@/lib/dashboard/draw-engine";
import { drawTeamName } from "@/lib/draw/entry";
import type { DrawRequest } from "@/lib/draw/state-schema";
import { cn } from "@/lib/utils";
import type { DrawVariant } from "@/types/draw";
import type { MatchDayFormatId } from "@/types/match-day";
import { DrawCompare } from "./draw-compare";
import { DrawEntry } from "./draw-entry";
import { DrawParticipants } from "./draw-participants";
import { DrawSetup, newSession, type DrawSession } from "./draw-setup";

/**
 * KURA SONUCU stüdyosu (hız öncelikli). Hazırlık → kura sırasında klavyeyle giriş → her girişte önizleme
 * (sunucuda, son istek kazanır) → DRAFT kayıt; kura sonrası API karşılaştırması. Yarım giriş tarayıcıda
 * tutulur (yalnızca bu tarayıcı; kalıcı kayıt "Kaydet" ile).
 */

const VARIANTS: { id: DrawVariant; label: string; hint: string }[] = [
  { id: "TEAM", label: "A · Takım odaklı", hint: "Eleme: poster · Lig aşaması: poster + rakip ızgarası" },
  { id: "TURKISH", label: "B · Temsilcilerimiz", hint: "Türk takımlarının hepsi tek kartta (aynı sezonun kuraları)" },
  { id: "ALL", label: "C · Tüm eşleşmeler", hint: "Eleme turunun bütün eşleşmeleri, Türk takımları vurgulu" },
];
const STORAGE_KEY = "betrix:draw-studio:v1";
const PREVIEW_DELAY_MS = 500;

interface Saved {
  sessions: DrawSession[];
  variant: DrawVariant;
  format: MatchDayFormatId;
  focusTeamId: number | null;
}

export interface DrawStudioProps {
  initial: (Saved & { photoId: string | null }) | null;
  initialComparison: DrawComparison[] | null;
  /** Yeni kurada seçili turnuva + sezon — Maç Merkezi'nden açılınca maçın turnuvası (bkz. `drawSetupForLeague`). */
  defaultCompetitionId: number;
  defaultSeason: number;
}

export function DrawStudio({ initial, initialComparison, defaultCompetitionId, defaultSeason }: DrawStudioProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [sessions, setSessions] = useState<DrawSession[]>(initial?.sessions ?? [newSession(defaultCompetitionId, defaultSeason, "LEAGUE")]);
  const [active, setActive] = useState(0);
  const [variant, setVariant] = useState<DrawVariant>(initial?.variant ?? "TEAM");
  const [format, setFormat] = useState<MatchDayFormatId>(initial?.format ?? "IG_PORTRAIT");
  const [focusTeamId, setFocusTeamId] = useState<number | null>(initial?.focusTeamId ?? null);
  const [photoId, setPhotoId] = useState<string | null>(initial?.photoId ?? null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [comparison, setComparison] = useState<DrawComparison[] | null>(initialComparison);
  const [comparing, setComparing] = useState(false);
  const sequence = useRef(0);
  const [restoreNote, setRestoreNote] = useState<string | null>(null);

  // Yarım girişi sakla (yalnızca bu tarayıcı; erişilemezse sessizce atlanır). Katılımcısı olmayan boş
  // başlangıç saklı girişi ezmez — "Son girişi geri yükle" ile geri gelir.
  useEffect(() => {
    if (!sessions.some((s) => s.state.teams.length > 0)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, variant, format, focusTeamId } satisfies Saved));
    } catch {
      /* tarayıcı depolaması yok */
    }
  }, [sessions, variant, format, focusTeamId]);

  function restore() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as Saved) : null;
      if (!saved?.sessions?.length) return setRestoreNote("Bu tarayıcıda saklı giriş yok.");
      setSessions(saved.sessions);
      setActive(0);
      setVariant(saved.variant);
      setFormat(saved.format);
      setFocusTeamId(saved.focusTeamId);
      setRestoreNote(null);
    } catch {
      setRestoreNote("Tarayıcı depolamasına erişilemedi.");
    }
  }

  const session = sessions[Math.min(active, sessions.length - 1)]!;
  const { state } = session;
  const sameSeason = sessions.filter((s) => s.state.season === state.season);
  const scope = variant === "TURKISH" ? sameSeason : [session];
  const request: DrawRequest = { variant, format, states: scope.map((s) => s.state), roundIds: scope.map((s) => s.roundId), focusTeamId: variant === "TEAM" ? focusTeamId : null };
  // Önizleme anahtarı: istek içeriği değişince (her render yeni nesne — içerik aynıysa yeniden çizilmez).
  const requestJson = JSON.stringify(request);

  const focusOptions = state.stage === "KNOCKOUT" ? [...new Set(state.ties.flatMap((tie) => [tie.first, tie.second]))] : [...new Set(state.fixtures.map((f) => f.teamId))];
  const photoTeams = useMemo(() => (variant === "TEAM" && focusTeamId ? [{ id: focusTeamId, name: drawTeamName(state, focusTeamId) }] : []), [variant, focusTeamId, state]);
  const blocker = variant === "TEAM" && !focusTeamId ? "Takım odaklı kart için takımı seçin." : variant === "ALL" && state.stage !== "KNOCKOUT" ? "Tüm eşleşmeler kartı yalnızca eleme turunda." : null;

  // Her girişte önizleme (gecikmeli; yalnızca son isteğin sonucu gösterilir).
  useEffect(() => {
    if (blocker) return;
    const id = ++sequence.current;
    const timer = window.setTimeout(async () => {
      setPreviewing(true);
      const data = new FormData();
      data.set("request", requestJson);
      if (photoId) data.set("photoPhotoId", photoId);
      const result = await previewDrawAction(data);
      if (id !== sequence.current) return;
      setPreviewing(false);
      if (result.ok) {
        setPreview(result.data.dataUrls);
        setPreviewError(null);
      } else setPreviewError(result.error.message);
    }, PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [requestJson, photoId, blocker]);

  async function save() {
    setSaving(true);
    const data = formRef.current ? new FormData(formRef.current) : new FormData();
    data.set("request", requestJson);
    const result = await saveDrawAction(data);
    setSaving(false);
    if (!result.ok) return setSaveError(result.error.message);
    setSaveError(null);
    router.push(`/dashboard/drafts/${result.data.id}`);
  }

  async function compare() {
    setComparing(true);
    const result = await compareDrawAction({ states: sessions.map((s) => s.state), roundIds: sessions.map((s) => s.roundId) });
    setComparing(false);
    if (result.ok) setComparison(result.data);
    else setSaveError(result.error.message);
  }

  const updateState = (next: DrawSession["state"]) => setSessions(sessions.map((s) => (s === session ? { ...s, state: next } : s)));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>1 · Hazırlık</CardTitle>
            <CardDescription>Turnuva, tur ve katılımcılar kuradan önce; torba ve kart adı elle.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {initial === null ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <Button type="button" size="xs" variant="ghost" onClick={restore}>
                  <History />
                  Son girişi geri yükle
                </Button>
                {restoreNote}
              </div>
            ) : null}
            <DrawSetup sessions={sessions} active={active} onActive={setActive} onSessions={(next) => { setSessions(next); setActive((index) => Math.min(index, next.length - 1)); }} onSeasonDraws={() => setVariant("TURKISH")} />
            <DrawParticipants state={state} onChange={updateState} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>2 · Eşleşmeler</CardTitle>
            <CardDescription>Kura sırasında: yaz → Enter → sıradaki. Eksik girişle de kart üretilir (yalnızca girilenler).</CardDescription>
          </CardHeader>
          <CardContent>
            <DrawEntry state={state} onChange={updateState} leagueTeamId={state.stage === "LEAGUE_PHASE" ? focusTeamId : null} onLeagueTeam={setFocusTeamId} />
          </CardContent>
        </Card>
        <DrawCompare results={comparison} busy={comparing} onCompare={compare} />
      </div>

      <Card className="h-fit xl:sticky xl:top-4">
        <CardHeader>
          <CardTitle>3 · Kart</CardTitle>
          <CardDescription>Analiz ve yorum yok, yalnızca olgu. Turnuva logosu kullanılmaz.</CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
            <div className="grid gap-2 sm:grid-cols-3">
              {VARIANTS.map((option) => (
                <button key={option.id} type="button" onClick={() => setVariant(option.id)} aria-pressed={variant === option.id} title={option.hint} className={cn("rounded-lg border px-3 py-2 text-left text-sm", variant === option.id ? "border-emerald-500/60 bg-emerald-500/10" : "border-border hover:bg-white/[0.03]")}>
                  {option.label}
                  <span className="block text-[11px] text-muted-foreground">{option.hint}</span>
                </button>
              ))}
            </div>
            {variant === "TEAM" ? (
              <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
                Takım
                <NativeSelect value={focusTeamId ?? ""} onChange={(event) => setFocusTeamId(Number(event.target.value) || null)}>
                  <option value="">Takım seçin</option>
                  {focusOptions.map((id) => (
                    <option key={id} value={id}>
                      {drawTeamName(state, id)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            ) : null}
            {photoTeams.length ? <ArchivePhotoPicker name="photo" label="Takımın oyuncu fotoğrafı (arşiv)" teams={photoTeams} fixtureId={null} onChange={(selection) => setPhotoId(selection.photoId)} /> : null}
            <MatchDayFormatPicker value={format} onChange={setFormat} />

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                Önizleme {previewing ? <LoaderCircle className="size-3.5 animate-spin" /> : null}
              </span>
              {blocker || previewError ? (
                <p className="flex items-center gap-2 text-sm text-amber-300">
                  <AlertCircle className="size-4" />
                  {blocker ?? previewError}
                </p>
              ) : null}
              <div className={cn("grid gap-2", (preview?.length ?? 0) > 1 && "grid-cols-2")}>
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URI önizleme */}
                {preview?.map((url, index) => <img key={index} src={url} alt={`Kura kartı sayfa ${index + 1}`} className={cn("w-full rounded-lg border border-border", (blocker || previewError) && "opacity-40")} />)}
              </div>
            </div>
            {saveError ? <p className="text-sm text-red-400">{saveError}</p> : null}
            <Button type="button" onClick={save} disabled={saving || blocker !== null}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
              Kaydet (taslak)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
