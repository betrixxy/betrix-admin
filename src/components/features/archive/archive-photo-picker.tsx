"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ImagePlus, Images, LoaderCircle } from "lucide-react";
import { loadArchivePickerAction } from "@/app/dashboard/studio/archive-picker-actions";
import { ImageUploadField } from "@/components/features/dashboard/image-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchCombobox, type ComboboxGroup } from "@/components/ui/search-combobox";
import { cn } from "@/lib/utils";
import { PHOTO_KINDS, PHOTO_KIND_LABELS, type ArchivePickerData, type PickerBucket, type PickerPhoto, type PickerSubject } from "@/types/archive";

/**
 * Stüdyo arşiv seçicisi (Maç Sonucu ve fotoğraf isteyen tüm stüdyolar). "Fotoğraftaki kişi" listesinin
 * en üstünde "Takım fotoğrafı", sonra Teknik Direktör, sonra mevki gruplarına göre oyuncular; seçilen
 * kişinin/takımın arşivi küçük resim ızgarası: önce bu maçın fotoğrafları, sonra güncel formalı en
 * yeniler, en altta eski forma. Tıkla seç ya da yeni yükle (açıklama + tür; forma takımı varsayılanı
 * maçtaki takım) — dosya sunucuda otomatik doğru klasöre girer (`resolveArchivePhoto`).
 */

const BUCKET_LABELS: Record<PickerBucket, string> = { THIS_MATCH: "Bu maç", CURRENT_KIT: "Güncel forma", OLD_KIT: "Eski forma" };

export interface PickerSelection {
  subject: PickerSubject | null;
  photoId: string | null;
  upload: boolean;
}

interface ArchivePhotoPickerProps {
  /** Form alanı öneki: `<ad>PhotoId`, `<ad>` (dosya), `<ad>Subject`, `<ad>Kind`, `<ad>Caption`, `<ad>KitTeamId`. */
  name: string;
  label: string;
  /** Maçtaki takım(lar) — API-Football kimliği + ad. Boşsa seçici "maç seçin" der. */
  teams: { id: number; name: string }[];
  fixtureId: string | null;
  /** Açılışta seçili konu: "team" takım fotoğrafı; yoksa listedeki ilk konu. */
  defaultSubject?: "team" | "player";
  onChange?: (selection: PickerSelection) => void;
}

function Thumb({ photo, selected, onSelect }: { photo: PickerPhoto; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={cn("group relative overflow-hidden rounded-md ring-1 transition", selected ? "ring-2 ring-emerald-400" : "ring-border hover:ring-white/40")} title={photo.caption}>
      {/* eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli */}
      <img src={photo.url} alt={photo.caption || "arşiv fotoğrafı"} loading="lazy" className="aspect-[4/5] w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-left text-[10px] text-white">
        {PHOTO_KIND_LABELS[photo.kind]} · {photo.width}×{photo.height}
      </span>
      {photo.bucket === "OLD_KIT" ? <span className="absolute left-1 top-1 rounded bg-amber-500/90 px-1 text-[9px] text-black">eski forma — {photo.kitTeamName}</span> : null}
      {selected ? <Check className="absolute right-1 top-1 size-4 rounded-full bg-emerald-500 p-0.5 text-black" /> : null}
    </button>
  );
}

export function ArchivePhotoPicker({ name, label, teams, fixtureId, defaultSubject = "player", onChange }: ArchivePhotoPickerProps) {
  const [data, setData] = useState<ArchivePickerData | null>(null);
  const [subjectKey, setSubjectKey] = useState("");
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const [isLoading, startLoading] = useTransition();
  const teamKey = teams.map((team) => team.id).join(",");

  /** Konu seçilince ızgaradaki ilk fotoğraf (sıralamada en uygun olan) seçili gelir; yoksa yükleme açılır. */
  function selectSubject(key: string, source: ArchivePickerData | null) {
    const first = source?.teams.find((team) => team.photos[key])?.photos[key]?.[0]?.id ?? null;
    setSubjectKey(key);
    setPhotoId(first);
    setUpload(first === null);
  }

  useEffect(() => {
    if (!teamKey) return;
    startLoading(async () => {
      const loaded = await loadArchivePickerAction(teamKey.split(",").map(Number), fixtureId);
      setData(loaded);
      const subjects = loaded.teams.flatMap((team) => team.groups.flatMap((group) => group.subjects));
      const first = defaultSubject === "team" ? subjects.find((subject) => subject.key.startsWith("team:")) : subjects.find((subject) => subject.isPlayer && (loaded.teams.find((team) => team.photos[subject.key]?.length)?.photos[subject.key]?.length ?? 0) > 0) ?? subjects.find((subject) => subject.isPlayer);
      selectSubject(first?.key ?? subjects[0]?.key ?? "", loaded);
    });
  }, [teamKey, fixtureId, defaultSubject]);

  const subjects = useMemo(() => data?.teams.flatMap((team) => team.groups.flatMap((group) => group.subjects)) ?? [], [data]);
  // Aramalı kutunun grupları: takım fotoğrafı, teknik direktör, mevkiler (takım adıyla); sağda fotoğraf sayısı.
  const subjectGroups = useMemo<ComboboxGroup[]>(
    () =>
      data?.teams.flatMap((team) =>
        team.groups
          .filter((group) => group.subjects.length > 0)
          .map((group) => ({
            label: `${team.name} · ${group.label}`,
            items: group.subjects.map((entry) => ({ value: entry.key, label: entry.label, meta: `${team.photos[entry.key]?.length ?? 0} foto`, keywords: team.name })),
          })),
      ) ?? [],
    [data],
  );
  const subject = subjects.find((entry) => entry.key === subjectKey) ?? null;
  const subjectTeam = data?.teams.find((team) => team.groups.some((group) => group.subjects.some((entry) => entry.key === subjectKey)));
  const photos = useMemo(() => subjectTeam?.photos[subjectKey] ?? [], [subjectTeam, subjectKey]);

  useEffect(() => {
    onChange?.({ subject, photoId: upload ? null : photoId, upload });
  }, [subject, photoId, upload, onChange]);

  if (teams.length === 0) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{label}</Label>
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">Önce maçı seçin — fotoğraf o maçtaki takımların arşivinden gelir.</p>
      </div>
    );
  }

  const buckets = (["THIS_MATCH", "CURRENT_KIT", "OLD_KIT"] as const).map((bucket) => ({ bucket, items: photos.filter((photo) => photo.bucket === bucket) })).filter((entry) => entry.items.length > 0);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${name}-subject`}>{label}</Label>
      <input type="hidden" name={`${name}Subject`} value={subjectKey} />
      <input type="hidden" name={`${name}PhotoId`} value={upload ? "" : (photoId ?? "")} />
      <SearchCombobox
        id={`${name}-subject`}
        groups={subjectGroups}
        value={subjectKey}
        onChange={(key) => selectSubject(key, data)}
        placeholder={data ? "Kişi ara (ör. kokcu)…" : "Arşiv yükleniyor…"}
        emptyText="Bu adla kişi yok"
        disabled={isLoading || !data}
      />
      {isLoading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />Arşiv yükleniyor (gerekirse kadro senkronlanır)…</p>
      ) : null}
      {data?.error ? <p className="text-xs text-destructive">{data.error}</p> : null}
      {data?.warnings.map((warning) => <p key={warning} className="text-[11px] text-amber-300">{warning}</p>)}

      {!upload && buckets.length > 0 ? (
        <div className="flex flex-col gap-2">
          {buckets.map(({ bucket, items }) => (
            <div key={bucket} className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{BUCKET_LABELS[bucket]}</span>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                {items.map((photo) => (
                  <Thumb key={photo.id} photo={photo} selected={photo.id === photoId} onSelect={() => setPhotoId(photo.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex gap-3 text-xs">
        <button type="button" onClick={() => setUpload(false)} disabled={photos.length === 0} className={cn("flex items-center gap-1", !upload ? "text-white" : "text-muted-foreground hover:text-white", photos.length === 0 && "opacity-40")}>
          <Images className="size-3.5" /> Arşivden seç
        </button>
        <button type="button" onClick={() => setUpload(true)} className={cn("flex items-center gap-1", upload ? "text-white" : "text-muted-foreground hover:text-white")}>
          <ImagePlus className="size-3.5" /> Yeni yükle
        </button>
      </div>

      {upload ? (
        <div className="flex flex-col gap-2 rounded-md border border-border p-2">
          <ImageUploadField name={name} label="Fotoğraf" hint={`${subject?.label ?? "Seçilen kişi"} klasörüne kaydedilir · orijinal saklanır; kısa kenar < 2000 ise kart için büyütülür`} />
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${name}-kind`} className="text-[11px]">Tür</Label>
              <NativeSelect id={`${name}-kind`} name={`${name}Kind`} defaultValue={subjectKey.startsWith("team:") ? "TEAM" : "CELEBRATION"} className="h-8 text-xs">
                {PHOTO_KINDS.map((kind) => (
                  <option key={kind} value={kind}>{PHOTO_KIND_LABELS[kind]}</option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor={`${name}-kit`} className="text-[11px]">Forma takımı</Label>
              <NativeSelect id={`${name}-kit`} name={`${name}KitTeamId`} key={subjectTeam?.teamId} defaultValue={String(subjectTeam?.teamId ?? teams[0]?.id ?? "")} className="h-8 text-xs">
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <Input name={`${name}Caption`} placeholder="Açıklama (örn. 88. dakika gol sevinci)" maxLength={300} className="h-8 text-xs" />
        </div>
      ) : null}
    </div>
  );
}
