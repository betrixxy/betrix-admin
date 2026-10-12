/**
 * Küresel sosyal medya format kaydı — Muhtemel 11, Haftanın Maçları ve Derinlemesine Analiz
 * stüdyolarının tümü bu tek kaynaktan okur (form seçicisi, önizleme başlığı, Satori kanvas boyutu,
 * `AiContent.format` + `renderOptions.format`). Güvenli alan bantları CLAUDE.md 3.3'e göredir.
 *
 * Maç Günü kendi formatlarını (`lib/dashboard/match-day-formats.ts`) kullanır: yatay geometrisi
 * 1200×675 X kartına ve sharp/Fal.ai oyuncu kompozisyonuna elle ayarlıdır.
 */

export const SOCIAL_FORMAT_IDS = ["post", "story", "landscape", "square"] as const;
export type SocialFormatId = (typeof SOCIAL_FORMAT_IDS)[number];

export const DEFAULT_SOCIAL_FORMAT: SocialFormatId = "post";

export interface SocialFormat {
  id: SocialFormatId;
  /** Seçicide ve başlıklarda görünen ad — platform + oran, ör. "Instagram Gönderi (4:5)". */
  label: string;
  /** Seçicide adın altındaki açıklama: hangi platform yüzeyleri için. */
  platforms: string;
  ratioLabel: string;
  width: number;
  height: number;
  orientation: "vertical" | "landscape";
  /** Platform arayüzünün kapattığı üst/alt bant — kritik içerik (metin, logo) buraya konmaz. */
  safeTop: number;
  safeBottom: number;
  /** `AiContent.format` sütununa yazılan değer (eski stüdyo formatlarıyla uyumlu). */
  dbFormat: string;
}

export const SOCIAL_FORMATS: Record<SocialFormatId, SocialFormat> = {
  post: {
    id: "post",
    label: "Instagram Gönderi (4:5)",
    platforms: "Instagram ve Facebook akış gönderisi",
    ratioLabel: "4:5",
    width: 1080,
    height: 1350,
    orientation: "vertical",
    safeTop: 0,
    safeBottom: 0,
    dbFormat: "IG_FEED",
  },
  story: {
    id: "story",
    label: "IG Story / Reels / TikTok (9:16)",
    platforms: "Instagram Story, Reels ve TikTok — üst/alt platform bantları boş bırakılır",
    ratioLabel: "9:16",
    width: 1080,
    height: 1920,
    orientation: "vertical",
    // CLAUDE.md 3.3: üst 250px ve alt 320px platform arayüzüne ayrılır.
    safeTop: 250,
    safeBottom: 320,
    dbFormat: "STORY",
  },
  landscape: {
    id: "landscape",
    label: "X (Twitter) / YouTube (16:9)",
    platforms: "X gönderisi, YouTube topluluk/kapak ve web",
    ratioLabel: "16:9",
    width: 1920,
    height: 1080,
    orientation: "landscape",
    safeTop: 0,
    safeBottom: 0,
    dbFormat: "X_CARD",
  },
  square: {
    id: "square",
    label: "Kare Post (1:1)",
    platforms: "Instagram ve Facebook kare gönderi",
    ratioLabel: "1:1",
    width: 1080,
    height: 1080,
    orientation: "vertical",
    safeTop: 0,
    safeBottom: 0,
    dbFormat: "IG_SQUARE",
  },
};

export function isSocialFormatId(value: unknown): value is SocialFormatId {
  return SOCIAL_FORMAT_IDS.some((id) => id === value);
}

/** Önizleme/inceleme başlığı: "1080×1920 · IG Story / Reels / TikTok (9:16)". */
export function socialFormatCaption(id: SocialFormatId): string {
  const format = SOCIAL_FORMATS[id];
  return `${format.width}×${format.height} · ${format.label}`;
}
