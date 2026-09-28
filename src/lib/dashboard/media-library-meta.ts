import { PLAYER_MIN_SHORT_SIDE } from "@/lib/dashboard/image-limits";
import type { MediaCategory } from "@/types/media";

/** Kütüphane klasörlerinin görünen bilgileri — istemci bileşenleri de kullanır (sunucu bağımlılığı yok). */

export interface MediaCategoryMeta {
  label: string;
  description: string;
  /** Yükleme sırasında zorunlu en küçük kısa kenar — oyuncu kesimi (birefnet) için. */
  minShortSide?: number;
}

export const MEDIA_CATEGORY_META: Record<MediaCategory, MediaCategoryMeta> = {
  LOGO: { label: "Logolar", description: "Takım, marka ve sponsor logoları — şeffaf PNG önerilir." },
  PLAYER: {
    label: "Oyuncular",
    description: "Oyuncu fotoğrafları — stüdyoda arka planı Fal.ai birefnet ile temizlenir.",
    minShortSide: PLAYER_MIN_SHORT_SIDE,
  },
  REFERENCE: { label: "Referanslar", description: "Stil, renk ve kompozisyon için ilham/referans görselleri." },
};
