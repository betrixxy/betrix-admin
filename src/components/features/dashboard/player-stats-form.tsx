"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Info, RotateCw, Sparkles } from "lucide-react";
import { generatePlayerStatsAction } from "@/app/dashboard/studio/player-stats/actions";
import { ArchivePhotoPicker } from "@/components/features/archive/archive-photo-picker";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { cn } from "@/lib/utils";
import type { MatchDayFormatId } from "@/types/match-day";
import type { PlayerDataSettlement, PlayerStatsActionState, PlayerStatsTemplateId } from "@/types/player-match-stats";
import { JobProgressLine } from "./job-progress";
import { MatchDayFormatPicker } from "./match-day-format-picker";
import { SettleCountdown } from "./settle-countdown";

export interface PlayerOption {
  playerId: number;
  label: string;
}

interface PlayerStatsFormProps {
  fixtureId: string;
  title: string;
  subtitle: string;
  teams: { id: number; name: string }[];
  /** Puanı olan oyuncular, puana göre. */
  players: PlayerOption[];
  /** Maç Sonucu "MAÇIN OYUNCUSU" kuralıyla aynı öneri. */
  defaultPlayerId: number | null;
  /** ≥ 30 dk oynamış puanlı oyuncu sayısı (en çok 5). */
  topAvailable: number;
  xgNote: string;
  settlement: PlayerDataSettlement;
}

const TEMPLATES: { id: PlayerStatsTemplateId; label: string; description: string }[] = [
  { id: "SPOTLIGHT", label: "A · Maçın Oyuncusu", description: "Tek oyuncu: dev puan, 6–8 istatistik (mevkiye göre), tek satır olgu. Tam kadraj fotoğraf ya da tipografik tasarım." },
  { id: "TOP_PLAYERS", label: "B · Maçın En İyileri", description: "İki takımdan en yüksek puanlı 3 ya da 5 oyuncu (≥ 30 dk), vesikalık + puan çubuğu." },
];

const INITIAL: PlayerStatsActionState = {};

export function PlayerStatsForm({ fixtureId, title, subtitle, teams, players, defaultPlayerId, topAvailable, xgNote, settlement }: PlayerStatsFormProps) {
  const router = useRouter();
  const settled = settlement.settled;
  const [force, setForce] = useState(false);
  const { state, isPending, onSubmit, progress } = useActionForm(generatePlayerStatsAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  const [format, setFormat] = useState<MatchDayFormatId>("IG_PORTRAIT");
  const [template, setTemplate] = useState<PlayerStatsTemplateId>("SPOTLIGHT");
  const [playerId, setPlayerId] = useState(defaultPlayerId ? String(defaultPlayerId) : "");
  const [photoMode, setPhotoMode] = useState<"auto" | "picker" | "none">("auto");
  const changed = defaultPlayerId !== null && playerId !== String(defaultPlayerId);
  const frame = MATCH_DAY_FRAMES[state.result && !isPending ? state.result.format : format];

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {subtitle} · Puan: API-Football · {xgNote}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
            <input type="hidden" name="fixtureId" value={fixtureId} />
            <input type="hidden" name="template" value={template} />
            <input type="hidden" name="photoMode" value={photoMode} />
            <MatchDayFormatPicker value={format} onChange={setFormat} />
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="mb-1 text-sm font-medium leading-none">Şablon</legend>
              {TEMPLATES.map((item) => (
                <button key={item.id} type="button" onClick={() => setTemplate(item.id)} className={cn("flex flex-col gap-0.5 rounded-lg border p-2.5 text-left", item.id === template ? "border-emerald-500/60 bg-emerald-500/10" : "border-border hover:border-muted-foreground/40")}>
                  <span className="text-sm font-medium text-white">{item.label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">{item.description}</span>
                </button>
              ))}
            </fieldset>

            {template === "SPOTLIGHT" ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="playerId">Oyuncu</Label>
                  <NativeSelect id="playerId" name="playerId" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
                    {players.map((player) => (
                      <option key={player.playerId} value={player.playerId}>
                        {player.label}
                        {player.playerId === defaultPlayerId ? " (maçın oyuncusu)" : ""}
                      </option>
                    ))}
                  </NativeSelect>
                  {changed ? <p className="text-[11px] text-amber-300">Maçın oyuncusu önerisinden farklı bir oyuncu seçildi — kart notlarına yazılır.</p> : null}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="photoModeSelect">Fotoğraf</Label>
                  <NativeSelect id="photoModeSelect" value={photoMode} onChange={(event) => setPhotoMode(event.target.value as typeof photoMode)}>
                    <option value="auto">Otomatik — oyuncunun bu takımın formalı en yeni arşiv fotoğrafı (yoksa tipografik)</option>
                    <option value="picker">Arşivden seç ya da yeni yükle</option>
                    <option value="none">Fotoğrafsız (tipografik tasarım)</option>
                  </NativeSelect>
                </div>
                {photoMode === "picker" ? <ArchivePhotoPicker name="photo" label="Fotoğraftaki kişi (kartın oyuncusu, o maçtaki takımının forması)" teams={teams} fixtureId={fixtureId} kitOnly /> : null}
              </>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="count">Oyuncu sayısı</Label>
                <NativeSelect id="count" name="count" defaultValue="3">
                  <option value="3">3 oyuncu</option>
                  <option value="5" disabled={topAvailable < 5}>
                    5 oyuncu{topAvailable < 5 ? ` (yalnızca ${topAvailable} uygun oyuncu)` : ""}
                  </option>
                </NativeSelect>
              </div>
            )}
            {template === "SPOTLIGHT" ? <input type="hidden" name="count" value="3" /> : <input type="hidden" name="playerId" value="" />}

            {!settlement.settled ? (
              <>
                <SettleCountdown readyAt={settlement.readyAt} reason={settlement.reason} onReady={() => router.refresh()} />
                <label className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                  <input type="checkbox" name="force" checked={force} onChange={(event) => setForce(event.target.checked)} className="mt-0.5" />
                  <span>Şimdi üret (veriler değişebilir) — puanlar ve istatistikler kesinleşmeden çizilir, taslağa &quot;geçici&quot; notu düşer.</span>
                </label>
              </>
            ) : null}

            {state.error ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3.5 shrink-0" />
                {state.error}
              </p>
            ) : null}
            <JobProgressLine progress={progress} />
            <div className="flex gap-2">
              <Button type="submit" size="lg" className="flex-1" disabled={isPending || (!settled && !force) || (template === "TOP_PLAYERS" && topAvailable < 3)}>
                <Sparkles />
                {isPending ? "Üretiliyor…" : "Kartı Üret"}
              </Button>
              {state.notSettled || !settled ? (
                <Link href={`/dashboard/studio/player-stats?fixtureId=${fixtureId}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
                  <RotateCw /> Yeniden dene
                </Link>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Önizleme</CardTitle>
          <CardDescription>{frame.ratioLabel}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-black/40" style={{ aspectRatio: `${frame.width} / ${frame.height}` }}>
            {state.result && !isPending ? (
              // eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli
              <img src={state.result.imageUrl} alt="Üretilen oyuncu kartı" className="size-full object-contain" />
            ) : (
              <span className="px-6 text-center text-xs text-muted-foreground">{isPending ? "Kart hazırlanıyor…" : 'Şablonu seçin ve "Kartı Üret"e basın.'}</span>
            )}
          </div>
          {state.result && !isPending ? (
            <>
              <p className="text-xs text-muted-foreground">{state.result.paidCalls} ücretli Fal.ai çağrısı</p>
              {state.result.notes.map((note) => (
                <p key={note} className="flex items-center gap-1.5 text-xs text-amber-300">
                  <Info className="size-3.5 shrink-0" />
                  {note}
                </p>
              ))}
              <Link href={`/dashboard/drafts/${state.result.id}`} className={cn(buttonVariants(), "w-full")}>
                Taslağı incele
              </Link>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
