"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { generateMatchResultAction, previewMatchPhotoAction } from "@/app/dashboard/studio/match-result/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm, useJobActionState } from "@/hooks/use-action-form";
import { loserPhotoWarning, MATCH_RESULT_TEMPLATES, mvpLineName, mvpOptions, playerOptionLabel } from "@/lib/dashboard/match-result-featured";
import { cn } from "@/lib/utils";
import type { MatchDayFormatId } from "@/types/match-day";
import {
  DEFAULT_MATCH_RESULT_TEMPLATE,
  MATCH_RESULT_TEMPLATE_IDS,
  type MatchPhotoPreviewState,
  type MatchResultActionState,
  type MatchResultFacts,
  type MatchResultTemplateId,
} from "@/types/match-result";
import { MatchDayFormatPicker } from "./match-day-format-picker";
import { MatchResultCropControls } from "./match-result-crop-controls";
import { ArchivePhotoPicker, type PickerSelection } from "@/components/features/archive/archive-photo-picker";
import { JobProgressLine } from "./job-progress";
import { MatchResultPreview } from "./match-result-preview";

interface MatchResultFormProps {
  fixtureId: string;
  /** Sunucuda doğrulanmış bitmiş maç (FT/AET/PEN). Üretimde sunucu maçı yeniden çeker. */
  facts: MatchResultFacts;
  disabled?: boolean;
}

const INITIAL_STATE: MatchResultActionState = {};
const INITIAL_PREVIEW: MatchPhotoPreviewState = {};

function TemplatePicker({ value, onChange }: { value: MatchResultTemplateId; onChange: (value: MatchResultTemplateId) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium leading-none">Şablon</legend>
      <input type="hidden" name="template" value={value} />
      <div className="grid gap-2 sm:grid-cols-3">
        {MATCH_RESULT_TEMPLATE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn("flex flex-col gap-0.5 rounded-lg border p-2.5 text-left", id === value ? "border-emerald-500/60 bg-emerald-500/10" : "border-border hover:border-muted-foreground/40")}
          >
            <span className="text-sm font-medium text-white">{MATCH_RESULT_TEMPLATES[id].label}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">{MATCH_RESULT_TEMPLATES[id].description}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function MatchResultForm({ fixtureId, facts, disabled = false }: MatchResultFormProps) {
  const { state, isPending, onSubmit, progress } = useActionForm(generateMatchResultAction, INITIAL_STATE);
  const [previewState, previewAction, previewPending, previewProgress] = useJobActionState(previewMatchPhotoAction, INITIAL_PREVIEW);
  const [, startPreview] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [format, setFormat] = useState<MatchDayFormatId>("IG_PORTRAIT");
  const [template, setTemplate] = useState<MatchResultTemplateId>(DEFAULT_MATCH_RESULT_TEMPLATE);
  // Arşiv seçicisinin seçtiği kişi — "MAÇIN OYUNCUSU" kuralı fotoğraftaki oyuncuyla karşılaştırılır.
  const [selection, setSelection] = useState<PickerSelection>({ subject: null, photoId: null, upload: false, kitTeamId: null });
  const onPhotoChange = useCallback((next: PickerSelection) => setSelection(next), []);
  const matchTeams = useMemo(() => [{ id: facts.home.id, name: facts.home.name }, { id: facts.away.id, name: facts.away.name }], [facts.home.id, facts.home.name, facts.away.id, facts.away.name]);
  const [mvpId, setMvpId] = useState(facts.mvp ? String(facts.mvp.playerId) : "");
  const [photoIsMvp, setPhotoIsMvp] = useState(false);

  const players = mvpOptions(facts);
  const mvp = players.find((player) => String(player.playerId) === mvpId) ?? null;
  const photoPlayerId = selection.subject?.isPlayer ? selection.subject.personApiId : null;
  const mvpShown = mvpLineName({ mvp, photoPlayerId, photoIsMvp }) !== null;
  const loserWarning = loserPhotoWarning(facts, selection.kitTeamId);

  function onPreview() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startPreview(() => previewAction(formData));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Maç Sonucu Kartı Üretici</CardTitle>
          <CardDescription>
            Gerçek maç fotoğrafı tam kadraj kullanılır (oyuncu kesimi ve AI arka plan yok). Skor, golcüler ve turnuva maçtan otomatik gelir; kırpma yüzlere göre
            otomatik, elle düzeltilebilir. Yerleşimde çakışma varsa kart üretilmez.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
            <input type="hidden" name="fixtureId" value={fixtureId} />
            <MatchDayFormatPicker value={format} onChange={setFormat} />
            <TemplatePicker value={template} onChange={setTemplate} />
            <ArchivePhotoPicker name="photo" label="Fotoğraftaki kişi (Fotoğraf Arşivi)" teams={matchTeams} fixtureId={fixtureId} onChange={onPhotoChange} />
            {loserWarning ? (
              <p className="flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200" role="status">
                <AlertCircle className="size-3.5 shrink-0" />
                {loserWarning} Kart yine de üretilebilir.
              </p>
            ) : null}
            <MatchResultCropControls state={previewState} isPending={previewPending} onPreview={onPreview} />
            <JobProgressLine progress={previewProgress} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mvpId">Maçın oyuncusu (gönderi metni)</Label>
              <NativeSelect id="mvpId" name="mvpId" value={mvpId} onChange={(event) => setMvpId(event.target.value)}>
                <option value="">Yok</option>
                {players.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {playerOptionLabel(player, facts)}
                  </option>
                ))}
              </NativeSelect>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="photoIsMvp" checked={photoIsMvp} onChange={(event) => setPhotoIsMvp(event.target.checked)} />
                Fotoğraftaki oyuncu maçın oyuncusu
              </label>
              <p className="text-[11px] text-muted-foreground">
                Kartta &quot;MAÇIN OYUNCUSU&quot; satırı: {mvpShown ? "çizilecek" : "gizlenecek (fotoğraf etiketi MVP ile eşleşmiyor ve kutucuk işaretli değil)"}.
              </p>
            </div>

            <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" name="includeStats" defaultChecked className="mt-0.5" />
              <span>
                İstatistik sayfasını da ekle
                <span className="block text-[11px] text-muted-foreground">
                  Tek taslak, carousel: 01 Maç Sonucu + 02 İstatistikler — aynı format, aynı fotoğrafın bulanık zemini, aynı vurgu rengi. İki sayfa da yerleşim kontrolünden geçer.
                </span>
              </span>
            </label>

            <div className="flex flex-col gap-1.5 rounded-lg border border-border p-3">
              <Label htmlFor="playerPage">Oyuncu sayfasını da ekle</Label>
              <NativeSelect id="playerPage" name="playerPage" defaultValue="">
                <option value="">Yok</option>
                <option value="SPOTLIGHT">A · Maçın Oyuncusu (yukarıdaki oyuncu)</option>
                <option value="TOP_3">B · Maçın En İyileri (3 oyuncu)</option>
                <option value="TOP_5">B · Maçın En İyileri (5 oyuncu)</option>
              </NativeSelect>
              <span className="text-[11px] text-muted-foreground">
                Aynı taslakta carousel&apos;in son sayfası — aynı format, vurgu rengi ve sütun tarafı. A&apos;nın fotoğrafı oyuncunun bu takımın formalı en yeni arşiv fotoğrafıdır (yoksa
                tipografik tasarım). Oyuncu verisi henüz kesinleşmediyse kart üretilmez.
              </span>
            </div>

            {state.error ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3.5 shrink-0" />
                {state.error}
              </p>
            ) : null}

            <JobProgressLine progress={progress} />

            <Button type="submit" size="lg" disabled={disabled || isPending}>
              <Sparkles />
              {isPending ? "Üretiliyor…" : "Kartı Üret"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="xl:col-span-2">
        <MatchResultPreview result={state.result} isPending={isPending} format={format} templateLabel={MATCH_RESULT_TEMPLATES[template].label} />
      </div>
    </div>
  );
}
