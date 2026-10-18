"use client";

import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { playerOptionLabel } from "@/lib/dashboard/match-result-featured";
import type { MatchResultFacts } from "@/types/match-result";
import type { MatchPhotoOption } from "@/types/media";
import { ImageUploadField } from "./image-upload-field";

interface MatchResultPhotoFieldProps {
  facts: MatchResultFacts;
  /** Bu maçın kütüphanedeki fotoğrafları (`MATCH_PHOTO` + `fixtureId`). */
  photos: MatchPhotoOption[];
  assetId: string;
  onAssetChange: (assetId: string) => void;
  /** Yeni yüklemenin oyuncu etiketi ("" = etiketsiz). */
  uploadPlayerId: string;
  onUploadPlayerChange: (playerId: string) => void;
}

/**
 * Maç fotoğrafı: kütüphaneden (bu maçın fotoğrafları) seç ya da yeni yükle. Yeni yükleme sunucuda
 * maç + isteğe bağlı oyuncu etiketiyle kütüphaneye kaydedilir; oyuncu etiketi "MAÇIN OYUNCUSU"
 * satırının kuralında kullanılır (etiket MVP ile eşleşirse satır çizilir).
 */
export function MatchResultPhotoField({ facts, photos, assetId, onAssetChange, uploadPlayerId, onUploadPlayerChange }: MatchResultPhotoFieldProps) {
  const selected = photos.find((photo) => photo.id === assetId);
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="photo-library">Maç fotoğrafı (tam kadraj)</Label>
      <NativeSelect id="photo-library" name="photoAssetId" value={assetId} onChange={(event) => onAssetChange(event.target.value)} className="h-8 text-xs">
        <option value="">{photos.length ? "Yeni yükle…" : "Bu maç için kütüphanede fotoğraf yok — yeni yükle"}</option>
        {photos.map((photo) => (
          <option key={photo.id} value={photo.id}>
            {photo.label} · {photo.width}×{photo.height}
            {photo.playerName ? ` · ${photo.playerName}` : ""}
          </option>
        ))}
      </NativeSelect>
      {selected ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- oturumlu /api/files görseli */}
          <img src={selected.fileUrl} alt="" className="h-16 w-24 rounded object-cover" />
          <span className="text-xs text-muted-foreground">{selected.playerName ? `Oyuncu etiketi: ${selected.playerName}` : "Oyuncu etiketi yok"}</span>
        </div>
      ) : (
        <>
          <ImageUploadField name="photo" label="Fotoğraf yükle" hint="JPEG/PNG/WebP · en fazla 8 MB · kısa kenar ≥2000px önerilir (<1080 AI ile büyütülür, <1500 uyarı)" />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photoPlayerId">Fotoğraftaki oyuncu (etiket, isteğe bağlı)</Label>
            <NativeSelect id="photoPlayerId" name="photoPlayerId" value={uploadPlayerId} onChange={(event) => onUploadPlayerChange(event.target.value)} className="h-8 text-xs">
              <option value="">Etiketsiz</option>
              {facts.players.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {playerOptionLabel(player, facts)}
                </option>
              ))}
            </NativeSelect>
          </div>
        </>
      )}
    </div>
  );
}
