"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { playerOptionLabel, type FeaturedSlot } from "@/lib/dashboard/match-result-featured";
import type { MatchResultFacts } from "@/types/match-result";
import type { MediaAssetOption } from "@/types/media";
import { LibraryImageField } from "./library-image-field";

interface MatchResultPlayerFieldProps {
  slot: FeaturedSlot;
  facts: Pick<MatchResultFacts, "home" | "away">;
  /** Oyuncu kimliği → kütüphanede o oyuncuyla etiketli fotoğraflar. */
  photos: Record<number, MediaAssetOption[]>;
}

/**
 * Öne çıkan oyuncu yuvası: oyuncu seçimi (öneri dolu gelir, değiştirilebilir) + fotoğrafı. Oyuncunun
 * kütüphanede fotoğrafı varsa o seçili gelir; yoksa yükleme zorunludur — sunucu fotoğrafsız kart üretmez.
 * Yüklenen fotoğraf oyuncu kimliğiyle kütüphaneye kaydedilir, sonraki maçlarda otomatik bulunur.
 */
export function MatchResultPlayerField({ slot, facts, photos }: MatchResultPlayerFieldProps) {
  const [playerId, setPlayerId] = useState<string>(slot.defaultPlayerId ? String(slot.defaultPlayerId) : "");
  const selected = slot.options.find((option) => String(option.playerId) === playerId);
  const options = selected ? (photos[selected.playerId] ?? []) : [];
  const selectId = `${slot.key}-player`;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={selectId}>{slot.label}</Label>
        <NativeSelect id={selectId} name={`${slot.key}Id`} value={playerId} onChange={(event) => setPlayerId(event.target.value)} required>
          <option value="" disabled>
            {slot.options.length ? "Oyuncu seçin…" : "Oyuncu verisi yok"}
          </option>
          {slot.options.map((option) => (
            <option key={option.playerId} value={option.playerId}>
              {playerOptionLabel(option, facts)}
              {option.playerId === slot.defaultPlayerId ? " — öneri" : ""}
            </option>
          ))}
        </NativeSelect>
      </div>

      {selected && options.length === 0 ? (
        <p className="flex items-start gap-1.5 text-[11px] text-amber-300">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {selected.name} için kütüphanede fotoğraf yok — kart üretmek için bir fotoğraf yükleyin.
        </p>
      ) : null}

      {/* Oyuncu değişince alan, o oyuncunun ilk fotoğrafı seçili olarak yeniden kurulur. */}
      <LibraryImageField
        key={playerId}
        name={slot.key}
        label="Fotoğraf"
        hint="JPEG/PNG/WebP · küçükse AI ile büyütülür"
        options={options}
        defaultAssetId={options[0]?.id ?? ""}
      />
    </div>
  );
}
