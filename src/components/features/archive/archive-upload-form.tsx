"use client";

import { AlertCircle, CheckCircle2, Upload } from "lucide-react";
import { uploadArchivePhotoAction } from "@/app/dashboard/library/archive-actions";
import { ImageUploadField } from "@/components/features/dashboard/image-upload-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import { PHOTO_KINDS, PHOTO_KIND_LABELS, type ArchiveActionState, type PhotoKindId } from "@/types/archive";

const INITIAL: ArchiveActionState = {};

/**
 * Seçili klasöre yükleme. Klasör (takım + kişi) sayfa bağlamından gelir — serbest ad yok. Forma
 * takımı varsayılanı klasörün takımı. Orijinal olduğu gibi saklanır; kısa kenar < 2000 ise kart
 * için büyütülmüş sürüm de üretilir (1 Fal çağrısı, önbellekli).
 */
export function ArchiveUploadForm({ teamId, personId, folderLabel, teams, defaultKind }: { teamId: number; personId: string | null; folderLabel: string; teams: { id: number; name: string }[]; defaultKind: PhotoKindId }) {
  const { state, isPending, onSubmit } = useActionForm(uploadArchivePhotoAction, INITIAL);
  return (
    <form key={state.notice ?? "upload"} onSubmit={onSubmit} className="flex flex-col gap-3">
      <input type="hidden" name="teamId" value={teamId} />
      <input type="hidden" name="personId" value={personId ?? ""} />
      <p className="text-xs text-muted-foreground">Klasör: <span className="text-white">{folderLabel}</span></p>
      <ImageUploadField name="file" label="Fotoğraf" hint="JPEG/PNG/WebP · en fazla 8 MB · orijinal olduğu gibi saklanır; kısa kenar < 2000 ise kart için büyütülmüş sürüm de üretilir (1 Fal çağrısı)" />
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="upload-kind">Tür</Label>
          <NativeSelect id="upload-kind" name="kind" defaultValue={defaultKind}>
            {PHOTO_KINDS.map((kind) => (
              <option key={kind} value={kind}>{PHOTO_KIND_LABELS[kind]}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="upload-fixture">Maç ID (isteğe bağlı)</Label>
          <Input id="upload-fixture" name="fixtureId" placeholder="1584435" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="upload-kit">Forma takımı</Label>
        <NativeSelect id="upload-kit" name="kitTeamId" defaultValue={String(teamId)}>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>{team.name}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="upload-caption">Açıklama</Label>
        <Input id="upload-caption" name="caption" maxLength={300} placeholder="Örn: Avrupa Ligi gol sevinci" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="upload-credit">Kaynak (isteğe bağlı)</Label>
        <Input id="upload-credit" name="credit" maxLength={120} placeholder="Örn: AA / kulüp" />
      </div>
      {state.error ? (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert"><AlertCircle className="size-3.5 shrink-0" />{state.error}</p>
      ) : state.notice ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-400" role="status"><CheckCircle2 className="size-3.5 shrink-0" />{state.notice}</p>
      ) : null}
      <Button type="submit" disabled={isPending}><Upload />{isPending ? "Yükleniyor…" : "Arşive ekle"}</Button>
    </form>
  );
}
