"use client";

import { AlertCircle, LoaderCircle, Sparkles } from "lucide-react";
import { generateMatchDraftAction } from "@/app/dashboard/matches/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import { STUDIO_FORMAT_DEFS } from "@/lib/dashboard/studio-formats";
import { STUDIO_FORMATS } from "@/types/ai-content";
import type { DraftActionState } from "@/types/draft";

const INITIAL_STATE: DraftActionState = {};

interface GenerateDraftFormProps {
  fixtureId: string;
  disabled?: boolean;
}

/**
 * Maç satırındaki "AI İçerik Üret" — gerçek istatistik + Fal.ai görseli + metin taslağı üretir,
 * başarıda aksiyon taslak inceleme ekranına yönlendirir (bkz. matches/actions.ts).
 */
export function GenerateDraftForm({ fixtureId, disabled = false }: GenerateDraftFormProps) {
  const { state, isPending, onSubmit } = useActionForm(generateMatchDraftAction, INITIAL_STATE);

  return (
    <form onSubmit={onSubmit} className="flex flex-col items-end gap-1">
      <input type="hidden" name="fixtureId" value={fixtureId} />
      <div className="flex items-center gap-2">
        <NativeSelect name="format" defaultValue="IG_FEED" aria-label="Format" disabled={disabled || isPending} className="h-8 text-xs">
          {STUDIO_FORMATS.map((id) => (
            <option key={id} value={id}>
              {STUDIO_FORMAT_DEFS[id].label}
            </option>
          ))}
        </NativeSelect>
        <Button type="submit" size="sm" disabled={disabled || isPending}>
          {isPending ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {isPending ? "Üretiliyor…" : "AI İçerik Üret"}
        </Button>
      </div>
      {isPending ? (
        <span className="text-[10px] text-muted-foreground">Veri çekiliyor, görsel üretiliyor (~15-30 sn)</span>
      ) : null}
      {state.error ? (
        <span className="flex max-w-xs items-center gap-1 text-right text-[11px] text-destructive" role="alert">
          <AlertCircle className="size-3 shrink-0" />
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
