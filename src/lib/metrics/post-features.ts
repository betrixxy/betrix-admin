import { istanbulHour, istanbulWeekday } from "@/lib/metrics/istanbul-time";

/**
 * Gönderi analiz özellikleri — saf fonksiyonlar (bkz. CLAUDE.md 4.4). Yayın anında hesaplanır; IMPORTED
 * gönderilerde de metinden ve zamandan türetilebilenler doldurulur.
 */

/** Kurallar değiştiğinde artırılır — eski satırlar ayırt edilebilsin. */
export const FEATURE_VERSION = 1;

export type LinkPlacement = "BODY" | "FIRST_REPLY" | "NONE";

export interface CaptionFeatures {
  captionChars: number;
  captionWords: number;
  hasQuestion: boolean;
  emojiCount: number;
  hashtags: string[];
  hasLink: boolean;
}

const EMOJI = /\p{Extended_Pictographic}/gu;
const HASHTAG = /#([\p{L}\p{N}_]+)/gu;
const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+|\b[a-z0-9-]+\.(?:com|net|pro|org|io|co)(?:\/\S*)?/iu;

export function captionFeatures(caption: string): CaptionFeatures {
  const text = caption.trim();
  const hashtags = [...new Set([...text.matchAll(HASHTAG)].map((match) => (match[1] ?? "").toLocaleLowerCase("tr-TR")))].filter(Boolean);
  return {
    // Kod noktası sayısı — emoji ve Türkçe karakterler tek sayılır (platform sınırlarına yakın).
    captionChars: [...text].length,
    captionWords: text === "" ? 0 : text.split(/\s+/u).filter((token) => /[\p{L}\p{N}]/u.test(token)).length,
    hasQuestion: /[?？]/u.test(text),
    emojiCount: (text.match(EMOJI) ?? []).length,
    hashtags,
    hasLink: LINK.test(text),
  };
}

export function linkPlacementOf(features: Pick<CaptionFeatures, "hasLink">, firstReplyHasLink = false): LinkPlacement {
  if (features.hasLink) return "BODY";
  return firstReplyHasLink ? "FIRST_REPLY" : "NONE";
}

export interface TimeFeatures {
  publishedHourIst: number;
  weekdayIst: number;
  hoursFromKickoff: number | null;
}

export function timeFeatures(publishedAt: Date, kickoff: Date | null): TimeFeatures {
  return {
    publishedHourIst: istanbulHour(publishedAt),
    weekdayIst: istanbulWeekday(publishedAt),
    hoursFromKickoff: kickoff ? Math.round(((publishedAt.getTime() - kickoff.getTime()) / 3_600_000) * 100) / 100 : null,
  };
}

/** `AiContent.format` (stüdyolara göre farklı kimlikler) → en-boy oranı. */
const FORMAT_RATIOS: Record<string, string> = {
  IG_FEED: "4:5",
  IG_PORTRAIT: "4:5",
  IG_SQUARE: "1:1",
  STORY: "9:16",
  X_CARD: "16:9",
  X_LANDSCAPE: "16:9",
};

export function formatRatio(format: string | null): string | null {
  return format ? (FORMAT_RATIOS[format] ?? null) : null;
}

/** `renderOptions` içinden şablon adı: Maç Günü `template`, diğer stüdyolar `kind`. */
export function templateNameOf(renderOptions: unknown): string | null {
  if (!renderOptions || typeof renderOptions !== "object" || Array.isArray(renderOptions)) return null;
  const record = renderOptions as Record<string, unknown>;
  const value = record.template ?? record.kind;
  return typeof value === "string" ? value : null;
}

/** Admin'in taslakta sınıflandırdığı derbi tansiyonu (`renderOptions.derbyIntensity`). */
export function derbyIntensityOf(renderOptions: unknown): string | null {
  if (!renderOptions || typeof renderOptions !== "object" || Array.isArray(renderOptions)) return null;
  const value = (renderOptions as Record<string, unknown>).derbyIntensity;
  return typeof value === "string" ? value : null;
}

export function isDerbyIntensity(value: string | null): boolean | null {
  return value === null ? null : value === "DERBY" || value === "ELITE_DERBY";
}

/**
 * Paylaşım anındaki takipçi: yayın gününe en yakın günlük hesap satırı — önce aynı gün ya da öncesi (o anda
 * bilinen), yoksa sonraki en yakın gün. Takipçi sayısı olmayan satırlar (geriye dönük doldurma) atlanır.
 */
export function nearestFollowerCount(rows: readonly { day: string; followerCount: number | null }[], publishDay: string): number | null {
  const known = rows.filter((row): row is { day: string; followerCount: number } => row.followerCount !== null);
  const before = known.filter((row) => row.day <= publishDay).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  if (before) return before.followerCount;
  const after = known.filter((row) => row.day > publishDay).sort((a, b) => (a.day < b.day ? -1 : 1))[0];
  return after?.followerCount ?? null;
}
