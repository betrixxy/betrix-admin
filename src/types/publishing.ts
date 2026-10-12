import type { SocialFormatId } from "@/types/studio-formats";

/**
 * Yayın Merkezi (taslak inceleme ekranı) tipleri — platforma özel metin, görsel dizilimi ve onay.
 * Seçimler onayda `AiContent.renderOptions.publish`'e, son metin `AiContent.caption`'a yazılır.
 */

export const PUBLISH_PLATFORMS = ["IG_POST", "IG_REELS_STORY", "X"] as const;
export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];

/** Tekli: dizilimin yalnız ilk görseli · çoklu: dizilimin tamamı (IG kaydırmalı, hikâye kareleri, X çoklu görsel). */
export const PUBLISH_LAYOUTS = ["single", "multi"] as const;
export type PublishLayout = (typeof PUBLISH_LAYOUTS)[number];

export interface PublishPlatformDef {
  id: PublishPlatform;
  label: string;
  description: string;
  /** Platformun metin sınırı (karakter). */
  captionLimit: number;
  /** Çoklu düzenin bu platformdaki adı. */
  multiLabel: string;
  /** Platformun en fazla görsel sayısı (çoklu düzende). */
  maxMedia: number;
  /** Bu platform için önerilen kart formatı — farklıysa admin uyarılır. */
  recommendedFormat: SocialFormatId;
}

export const PUBLISH_PLATFORM_DEFS: Record<PublishPlatform, PublishPlatformDef> = {
  IG_POST: {
    id: "IG_POST",
    label: "Instagram Gönderi",
    description: "Tekli ya da kaydırmalı (carousel) — emojili, kancalı metin + 5-8 hashtag.",
    captionLimit: 2200,
    multiLabel: "Kaydırmalı (Carousel)",
    maxMedia: 10,
    recommendedFormat: "post",
  },
  IG_REELS_STORY: {
    id: "IG_REELS_STORY",
    label: "Instagram Reels / Story",
    description: "Dikey kareler — kısa, hareketli metin + 3-5 hashtag.",
    captionLimit: 2200,
    multiLabel: "Ardışık hikâye kareleri",
    maxMedia: 10,
    recommendedFormat: "story",
  },
  X: {
    id: "X",
    label: "X (Twitter)",
    description: "En fazla 280 karakter — ilk cümlede kanca, istatistik dili, cümleye gömülü 2-3 hashtag.",
    captionLimit: 280,
    multiLabel: "Çoklu görsel",
    maxMedia: 4,
    recommendedFormat: "landscape",
  },
};

/** Taslağın yayınlanabilir görseli (dizilimin bir öğesi). */
export interface PublishMedia {
  url: string;
  /** "Galatasaray · Ev sahibi" gibi kısa ad. */
  label: string;
}

/** Onayda kaydedilen yayın ayarları. */
export interface PublishSettings {
  platform: PublishPlatform;
  layout: PublishLayout;
  /** Yayınlanacak görseller, sırasıyla (tekli düzende tek öğe). */
  mediaOrder: string[];
}

/** Platforma özel metin üretiminin sonucu. */
export interface CaptionDraft {
  caption: string;
  /** Denetim uyarıları: pakette olmayan sayı, karakter sınırı, hashtag sayısı. */
  warnings: string[];
  /** `ai` = Claude yazdı, `template` = şablon metni (AI kapalı). */
  source: "ai" | "template";
}
