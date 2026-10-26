"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { photoFaceAction, playerPhotosAction } from "@/app/dashboard/studio/player-h2h/actions";
import { Label } from "@/components/ui/label";
import { SearchCombobox, type ComboboxGroup } from "@/components/ui/search-combobox";
import type { H2HPhotoOption, H2HPlayerOption } from "@/lib/dashboard/player-h2h-studio";
import { cn } from "@/lib/utils";
import { CropAdjust, type CropAdjustValue } from "./crop-adjust";

const POSITION_LABELS: Record<string, string> = { GK: "Kaleci", DEF: "Defans", MID: "Orta saha", FWD: "Forvet" };
/** Poster kırpma zoom sınırı (`match-photo/crop.ts::MAX_ZOOM`) ve vesikalık sınırı (`PORTRAIT_MAX_ZOOM`). */
const POSTER_MAX_ZOOM = 1.6;
const PORTRAIT_MAX_ZOOM = 2;

export interface SlotValue {
  key: string | null;
  photoId: string | null;
  poster: CropAdjustValue | null;
  portrait: CropAdjustValue | null;
}

export const EMPTY_SLOT: SlotValue = { key: null, photoId: null, poster: null, portrait: null };

/**
 * Bir taraf: aramalı oyuncu seçimi (Türkçe karakter duyarsız: "vlahovic" → "Dušan Vlahović"), oyuncunun
 * YALNIZCA güncel takım formalı arşiv fotoğrafları, yüz bulunamazsa uyarı, poster ve vesikalık için
 * ayrı elle ayar. Fotoğraf seçilmezse posterin o yarısı programatik zemin, vesikalık yerine logo olur.
 */
export function PlayerSlot({ id, label, options, value, onChange }: { id: string; label: string; options: H2HPlayerOption[]; value: SlotValue; onChange: (value: SlotValue) => void }) {
  // Sonuçlar ait oldukları seçimle saklanır; yalnızca güncel seçime aitse gösterilir.
  const [loadedPhotos, setLoadedPhotos] = useState<{ key: string; photos: H2HPhotoOption[] } | null>(null);
  const [face, setFace] = useState<{ photoId: string; warning: string | null } | null>(null);
  const photos = loadedPhotos && loadedPhotos.key === value.key ? loadedPhotos.photos : [];
  const faceWarning = face && face.photoId === value.photoId ? face.warning : null;
  const [loading, startLoading] = useTransition();

  const groups = useMemo<ComboboxGroup[]>(() => {
    const byTeam = new Map<string, H2HPlayerOption[]>();
    for (const option of options) byTeam.set(option.teamName, [...(byTeam.get(option.teamName) ?? []), option]);
    return [...byTeam.entries()]
      .sort(([a], [b]) => a.localeCompare(b, "tr-TR"))
      .map(([team, players]) => ({ label: team, items: players.sort((a, b) => a.name.localeCompare(b.name, "tr-TR")).map((p) => ({ value: p.key, label: p.name, meta: POSITION_LABELS[p.position ?? ""] ?? "", keywords: team })) }));
  }, [options]);

  useEffect(() => {
    if (!value.key) return;
    const key = value.key;
    startLoading(async () => {
      const result = await playerPhotosAction(key);
      const list = result.ok ? result.data : [];
      setLoadedPhotos({ key, photos: list });
      if (!value.photoId && list[0]) onChange({ ...value, key, photoId: list[0].id });
    });
    // Yalnızca oyuncu değişince yüklenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.key]);

  useEffect(() => {
    if (!value.photoId) return;
    const photoId = value.photoId;
    startLoading(async () => {
      const result = await photoFaceAction(photoId);
      setFace({ photoId, warning: result.ok ? result.data : result.error.message });
    });
  }, [value.photoId]);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <Label htmlFor={`${id}-player`}>{label}</Label>
      <SearchCombobox id={`${id}-player`} groups={groups} value={value.key ?? ""} onChange={(key) => onChange({ ...EMPTY_SLOT, key })} placeholder="Oyuncu ara (ör. vlahovic, kokcu)…" emptyText="Arşivde bu adla oyuncu yok" />
      {loading ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />Fotoğraflar yükleniyor…</p>
      ) : null}
      {value.key && !loading && photos.length === 0 ? (
        <p className="text-[11px] text-amber-300">Oyuncunun güncel takım formalı fotoğrafı yok — Kütüphane &gt; Fotoğraf Arşivi&apos;nden yükleyin. Poster yarısı programatik zemin, vesikalık yerine logo çizilir.</p>
      ) : null}
      {photos.length > 0 ? (
        <div className="grid grid-cols-4 gap-1.5">
          {photos.map((photo) => (
            <button key={photo.id} type="button" onClick={() => onChange({ ...value, photoId: photo.id, poster: null, portrait: null })} className={cn("relative overflow-hidden rounded-md ring-1 transition", photo.id === value.photoId ? "ring-2 ring-emerald-400" : "ring-border hover:ring-white/40")} title={photo.caption}>
              {/* eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli */}
              <img src={photo.url} alt={photo.caption || "arşiv fotoğrafı"} loading="lazy" className="aspect-[4/5] w-full object-cover" />
              {photo.id === value.photoId ? <Check className="absolute right-1 top-1 size-4 rounded-full bg-emerald-500 p-0.5 text-black" /> : null}
            </button>
          ))}
        </div>
      ) : null}
      {faceWarning ? (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-300" role="note"><AlertCircle className="mt-0.5 size-3.5 shrink-0" />{faceWarning}</p>
      ) : null}
      {value.photoId ? (
        <div className="grid gap-2">
          <CropAdjust id={`${id}-poster`} title="Poster fotoğrafı" value={value.poster} onChange={(poster) => onChange({ ...value, poster })} maxZoom={POSTER_MAX_ZOOM} />
          <CropAdjust id={`${id}-portrait`} title="Vesikalık (2. sayfa)" value={value.portrait} onChange={(portrait) => onChange({ ...value, portrait })} maxZoom={PORTRAIT_MAX_ZOOM} />
        </div>
      ) : null}
    </div>
  );
}
