"use client";

import { useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";
import { generateMatchResultAction } from "@/app/dashboard/studio/match-result/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import { featuredSlots, MATCH_RESULT_TEMPLATES } from "@/lib/dashboard/match-result-featured";
import { COMPETITION_LABELS, MATCH_IMPORTANCE_LABELS } from "@/lib/dashboard/match-result-labels";
import { cn } from "@/lib/utils";
import type { MatchDayFormatId } from "@/types/match-day";
import { MATCH_IMPORTANCE_LEVELS, MATCH_RESULT_TEMPLATE_IDS, type MatchResultActionState, type MatchResultFacts } from "@/types/match-result";
import type { MediaAssetOption } from "@/types/media";
import { MatchDayAiSettings } from "./match-day-ai-settings";
import { MatchDayFormatPicker } from "./match-day-format-picker";
import { MatchDayPreview } from "./match-day-preview";
import { MatchResultPlayerField } from "./match-result-player-field";

interface MatchResultFormProps {
  fixtureId: string;
  /** Sunucuda doğrulanmış bitmiş maç (FT/AET/PEN). Üretimde sunucu maçı yeniden çeker. */
  facts: MatchResultFacts;
  /** Oyuncu kimliği → kütüphanedeki fotoğrafları. */
  photos: Record<number, MediaAssetOption[]>;
  disabled?: boolean;
}

const INITIAL_STATE: MatchResultActionState = {};
const TEMPLATE = "HERO_SCORE";

/** Kesim: oyuncu başına en fazla 2 (upscale + birefnet) · arka plan 1 · Premium'da AI düzenleme 1. */
function maxCalls(playerCount: number) {
  const base = playerCount * 2 + 1;
  return { PREMIUM: base + 1, ECONOMY: base };
}

function TemplatePicker() {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-sm font-medium leading-none">Şablon</legend>
      <input type="hidden" name="template" value={TEMPLATE} />
      <div className="grid gap-2 sm:grid-cols-3">
        {MATCH_RESULT_TEMPLATE_IDS.map((id) => {
          const meta = MATCH_RESULT_TEMPLATES[id];
          return (
            <div
              key={id}
              aria-disabled={!meta.active}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border p-2.5 text-left",
                id === TEMPLATE ? "border-emerald-500/60 bg-emerald-500/10" : "border-border opacity-50",
              )}
            >
              <span className="text-sm font-medium text-white">
                {meta.label}
                {meta.active ? "" : " (Yakında)"}
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">{meta.description}</span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function MatchResultForm({ fixtureId, facts, photos, disabled = false }: MatchResultFormProps) {
  const { state, isPending, onSubmit } = useActionForm(generateMatchResultAction, INITIAL_STATE);
  const [format, setFormat] = useState<MatchDayFormatId>("IG_PORTRAIT");
  const slots = featuredSlots(facts);

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Maç Sonucu Kartı Üretici</CardTitle>
          <CardDescription>
            Skor, golcüler ve turnuva maçtan otomatik gelir. Maçın oyuncusu önerilir, değiştirebilirsiniz; fotoğrafı
            kütüphanede yoksa yükleyin. {facts.outcome === "DRAW" ? "Beraberlik: iki takımdan birer oyuncuyla split kart." : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <input type="hidden" name="fixtureId" value={fixtureId} />

            <MatchDayFormatPicker value={format} onChange={setFormat} />
            <TemplatePicker />

            <div className="grid gap-4 sm:grid-cols-2">
              {slots.map((slot) => (
                <MatchResultPlayerField key={slot.key} slot={slot} facts={facts} photos={photos} />
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>Turnuva (otomatik)</Label>
                <div className="flex h-9 items-center rounded-md border border-border bg-muted/20 px-3 text-sm text-muted-foreground">
                  {COMPETITION_LABELS[facts.competition.kind]}
                  {facts.competition.kind === "OTHER" || facts.competition.kind === "NATIONAL" ? ` · ${facts.competition.name}` : ""}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="importance">Maç önemi</Label>
                <NativeSelect id="importance" name="importance" required defaultValue="">
                  <option value="" disabled>
                    Seçin…
                  </option>
                  {MATCH_IMPORTANCE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {MATCH_IMPORTANCE_LABELS[level]}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </div>

            <MatchDayAiSettings template={TEMPLATE} maxCalls={maxCalls(slots.length)} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="match-result-prompt">Ek yönerge (isteğe bağlı)</Label>
              <Textarea id="match-result-prompt" name="customPrompt" rows={2} maxLength={500} placeholder="Örn: yağmurlu gece, ıslak çim…" />
            </div>

            {state.error ? (
              <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
                <AlertCircle className="size-3.5 shrink-0" />
                {state.error}
              </p>
            ) : null}

            <Button type="submit" size="lg" disabled={disabled || isPending}>
              <Sparkles />
              {isPending ? "Üretiliyor…" : "Kartı Üret"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="xl:col-span-2">
        <MatchDayPreview
          result={state.result}
          isPending={isPending}
          format={format}
          copy={{
            idle: 'Formatı ve maç önemini seçin, oyuncu fotoğrafını kontrol edin ve "Kartı Üret"e basın.',
            alt: "Üretilen Maç Sonucu kartı",
            downloadPrefix: "checkmatch-mac-sonucu",
            templateLabel: MATCH_RESULT_TEMPLATES.HERO_SCORE.label,
          }}
        />
      </div>
    </div>
  );
}
