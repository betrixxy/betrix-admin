"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { hideArchivePhotoAction, updateArchivePhotoAction } from "@/app/dashboard/library/archive-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import type { ArchivePhotoView } from "@/lib/archive/queries";
import { isOldKit } from "@/lib/archive/transfer";
import { PHOTO_KINDS, PHOTO_KIND_LABELS, type ArchiveActionState } from "@/types/archive";

const INITIAL: ArchiveActionState = {};
const dateFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" });

/** Arşiv kartı: küçük resim + açıklama/tür/maç/forma/tarih/çözünürlük; düzenle ve arşivden kaldır. */
export function ArchivePhotoCard({ photo, teams }: { photo: ArchivePhotoView; teams: { id: number; name: string }[] }) {
  const [editing, setEditing] = useState(false);
  const [armed, setArmed] = useState(false);
  const [hideMessage, setHideMessage] = useState<string | null>(null);
  const [hiding, startHide] = useTransition();
  const { state, isPending, onSubmit } = useActionForm(updateArchivePhotoAction, INITIAL);
  const oldKit = isOldKit(photo);
  const date = photo.takenAt ?? photo.uploadedAt;

  function hide() {
    if (!armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 3000);
      return;
    }
    startHide(async () => {
      const result = await hideArchivePhotoAction(photo.id);
      setHideMessage(result.error ?? null);
    });
  }

  return (
    <li className="flex flex-col gap-1.5">
      <a href={photo.originalUrl} target="_blank" rel="noreferrer" className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-muted/30 ring-1 ring-border">
        {/* eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli */}
        <img src={photo.originalUrl} alt={photo.caption || photo.personName || photo.teamName} loading="lazy" className="size-full object-cover" />
        {oldKit ? <span className="absolute left-1.5 top-1.5 rounded bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-black">eski forma — {photo.kitTeamName}</span> : null}
      </a>
      <div className="flex flex-col gap-0.5 text-[11px] leading-snug">
        <span className="text-white">{photo.caption || <span className="text-muted-foreground">Açıklama yok</span>}</span>
        <span className="text-muted-foreground">
          {PHOTO_KIND_LABELS[photo.kind]} · forma: {photo.kitTeamName}
          {photo.fixtureId ? ` · maç ${photo.fixtureId.replace("api-football-", "#")}` : ""}
        </span>
        <span className="text-muted-foreground">
          {dateFormatter.format(new Date(date))} · {photo.width}×{photo.height}
          {photo.upscaledUrl ? " · kart için 2000px hazır" : Math.min(photo.width, photo.height) < 2000 ? " · kartta büyütülecek" : ""}
          {photo.credit ? ` · ${photo.credit}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setEditing((value) => !value)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-white">
          <Pencil className="size-3" /> Düzenle
        </button>
        <button type="button" onClick={hide} disabled={hiding} className={`ml-auto flex items-center gap-1 text-[11px] ${armed ? "text-destructive" : "text-muted-foreground hover:text-white"}`}>
          <Trash2 className="size-3" /> {armed ? "Arşivden kaldırılsın mı?" : "Sil"}
        </button>
      </div>
      {hideMessage ? <span className="text-[11px] text-destructive">{hideMessage}</span> : null}
      {editing ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2 rounded-md border border-border p-2">
          <input type="hidden" name="photoId" value={photo.id} />
          <div className="flex flex-col gap-1">
            <Label htmlFor={`caption-${photo.id}`} className="text-[11px]">Açıklama</Label>
            <Input id={`caption-${photo.id}`} name="caption" defaultValue={photo.caption} maxLength={300} className="h-8 text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`kind-${photo.id}`} className="text-[11px]">Tür</Label>
              <NativeSelect id={`kind-${photo.id}`} name="kind" defaultValue={photo.kind} className="h-8 text-xs">
                {PHOTO_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{PHOTO_KIND_LABELS[kind]}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`fixture-${photo.id}`} className="text-[11px]">Maç ID</Label>
              <Input id={`fixture-${photo.id}`} name="fixtureId" defaultValue={photo.fixtureId?.replace("api-football-", "") ?? ""} placeholder="1584435" className="h-8 text-xs" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`kit-${photo.id}`} className="text-[11px]">Forma takımı (çekildiği andaki)</Label>
            <NativeSelect id={`kit-${photo.id}`} name="kitTeamId" defaultValue={String(photo.kitTeamId)} className="h-8 text-xs">
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </NativeSelect>
          </div>
          {state.error ? <p className="text-[11px] text-destructive">{state.error}</p> : state.notice ? <p className="text-[11px] text-emerald-400">{state.notice}</p> : null}
          <Button type="submit" size="sm" disabled={isPending}>{isPending ? "Kaydediliyor…" : "Kaydet"}</Button>
        </form>
      ) : null}
    </li>
  );
}
