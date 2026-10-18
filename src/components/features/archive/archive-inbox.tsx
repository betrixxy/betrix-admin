"use client";

import { useState } from "react";
import { tagLegacyAssetAction } from "@/app/dashboard/library/archive-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import type { InboxAsset } from "@/lib/archive/queries";
import { PHOTO_KINDS, PHOTO_KIND_LABELS, type ArchiveActionState } from "@/types/archive";

const INITIAL: ArchiveActionState = {};

interface Option {
  id: string;
  name: string;
  /** Kulüp + milli takım. */
  teamIds: number[];
}

/**
 * Etiket bekleyen eski kütüphane fotoğrafı → arşiv. Takım seçilir, kişi o takımın kadrosundan
 * (boş = takım fotoğrafı); dosya aynen kullanılır, eski kayıt silinmez, Fal çağrısı yok.
 * Tahminle etiketleme yapılmaz — karar admin'in.
 */
function InboxItem({ asset, teams, people }: { asset: InboxAsset; teams: { id: number; name: string }[]; people: Option[] }) {
  const { state, isPending, onSubmit } = useActionForm(tagLegacyAssetAction, INITIAL);
  const [teamId, setTeamId] = useState("");
  // Forma takımı varsayılanı klasörün takımı; admin değiştirebilir (ör. milli formalı fotoğraf).
  const [kitTeamId, setKitTeamId] = useState("");
  const squad = people.filter((person) => person.teamIds.some((id) => String(id) === teamId));
  if (state.notice) return <li className="rounded-lg border border-emerald-500/30 p-3 text-xs text-emerald-400">{state.notice}</li>;
  return (
    <li className="flex gap-3 rounded-lg border border-border p-3">
      <a href={asset.fileUrl} target="_blank" rel="noreferrer" className="block w-28 shrink-0 overflow-hidden rounded bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli */}
        <img src={asset.fileUrl} alt={asset.label} loading="lazy" className="aspect-[4/5] size-full object-cover" />
      </a>
      <form onSubmit={onSubmit} className="flex min-w-0 flex-1 flex-col gap-2">
        <input type="hidden" name="assetId" value={asset.id} />
        <span className="truncate text-[11px] text-muted-foreground" title={asset.label}>
          {asset.label} · {asset.width}×{asset.height}
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`team-${asset.id}`} className="text-[11px]">Takım (klasör)</Label>
            <NativeSelect id={`team-${asset.id}`} name="teamId" value={teamId} onChange={(event) => {
                setTeamId(event.target.value);
                setKitTeamId(event.target.value);
              }} className="h-8 text-xs" required>
              <option value="" disabled>Seçin…</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`person-${asset.id}`} className="text-[11px]">Kişi</Label>
            <NativeSelect id={`person-${asset.id}`} name="personId" defaultValue="" className="h-8 text-xs" disabled={!teamId}>
              <option value="">Takım fotoğrafı</option>
              {squad.map((person) => (
                <option key={person.id} value={person.id}>{person.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`kind-${asset.id}`} className="text-[11px]">Tür</Label>
            <NativeSelect id={`kind-${asset.id}`} name="kind" defaultValue="PORTRAIT" className="h-8 text-xs">
              {PHOTO_KINDS.map((kind) => (
                <option key={kind} value={kind}>{PHOTO_KIND_LABELS[kind]}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`kit-${asset.id}`} className="text-[11px]">Forma takımı</Label>
            <NativeSelect id={`kit-${asset.id}`} name="kitTeamId" value={kitTeamId} onChange={(event) => setKitTeamId(event.target.value)} className="h-8 text-xs" disabled={!teamId}>
              <option value="">—</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </NativeSelect>
          </div>
        </div>
        <Input name="caption" defaultValue="" placeholder="Açıklama" maxLength={300} className="h-8 text-xs" />
        {state.error ? <p className="text-[11px] text-destructive">{state.error}</p> : null}
        <Button type="submit" size="sm" disabled={isPending || !teamId}>{isPending ? "Alınıyor…" : "Arşive al"}</Button>
      </form>
    </li>
  );
}

export function ArchiveInbox({ assets, teams, people }: { assets: InboxAsset[]; teams: { id: number; name: string }[]; people: Option[] }) {
  if (assets.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Etiket bekleyen fotoğraf yok.</p>;
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {assets.map((asset) => (
        <InboxItem key={asset.id} asset={asset} teams={teams} people={people} />
      ))}
    </ul>
  );
}
