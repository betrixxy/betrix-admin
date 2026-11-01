"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, Upload } from "lucide-react";
import { uploadMediaAction } from "@/app/dashboard/library/actions";
import { ImageUploadField } from "@/components/features/dashboard/image-upload-field";
import { Button } from "@/components/ui/button";
import { useActionForm } from "@/hooks/use-action-form";
import { LEAGUE_LOGO_MIN_SIDE } from "@/lib/dashboard/league-logo-source";
import type { MediaActionState } from "@/types/media";

const INITIAL_STATE: MediaActionState = {};

/** Lig sayfasının "logo yükle" alanı — kategori/lig etiketi sabit; admin yalnızca dosyayı seçer. */
export function LeagueLogoUploadForm({ leagueId, leagueName }: { leagueId: number; leagueName: string }) {
  const { state, isPending, onSubmit } = useActionForm(uploadMediaAction, INITIAL_STATE);
  return (
    <form key={state.notice ?? "league-logo"} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="category" value="LOGO" />
      <input type="hidden" name="label" value={`${leagueName} logosu`} />
      <input type="hidden" name="teamName" value={leagueName} />
      <input type="hidden" name="teamId" value={`league-${leagueId}`} />
      <ImageUploadField name="file" label="Logo yükle" hint={`PNG (şeffaf önerilir) · kısa kenar en az ${LEAGUE_LOGO_MIN_SIDE} px`} />
      {state.error ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <AlertCircle className="size-3.5 shrink-0" />
          {state.error}
        </p>
      ) : state.notice ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400" role="status">
          <CheckCircle2 className="size-3.5 shrink-0" />
          {state.notice}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="self-start">
        {isPending ? <LoaderCircle className="animate-spin" /> : <Upload />}
        Logoyu yükle
      </Button>
    </form>
  );
}
