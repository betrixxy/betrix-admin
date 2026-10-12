import { z } from "zod";
import { PUBLISH_LAYOUTS, PUBLISH_PLATFORM_DEFS, PUBLISH_PLATFORMS, type PublishMedia, type PublishPlatform, type PublishSettings } from "@/types/publishing";

/**
 * Yayın Merkezi'nin saf kuralları (istemci de içe aktarır): taslağın görsel listesi, AI olgu paketi,
 * metin denetimi ve kayıtlı yayın ayarlarının okunması.
 */

const pairSchema = z.object({
  homeImageUrl: z.string().min(1),
  awayImageUrl: z.string().min(1),
  home: z.object({ teamName: z.string() }),
  away: z.object({ teamName: z.string() }),
});
const singleSchema = z.object({ imageUrl: z.string().min(1) });

/** Taslağın yayınlanabilir görselleri: iki takımlı kartlarda ev + deplasman, diğerlerinde tek kart. */
export function publishMediaOf(renderOptions: unknown, resultImageUrl: string | null): PublishMedia[] {
  const pair = pairSchema.safeParse(renderOptions);
  if (pair.success) {
    return [
      { url: pair.data.homeImageUrl, label: `${pair.data.home.teamName} · Ev sahibi` },
      { url: pair.data.awayImageUrl, label: `${pair.data.away.teamName} · Deplasman` },
    ];
  }
  const single = singleSchema.safeParse(renderOptions);
  if (single.success) return [{ url: single.data.imageUrl, label: "Kart" }];
  return resultImageUrl ? [{ url: resultImageUrl, label: "Kart" }] : [];
}

/** Modele giden olgu paketi: içerik türü ve kartın şablon metni (her sayı buradan gelir). */
export function captionFacts(contentLabel: string, baseCaption: string, mediaLabels: string[]) {
  return { icerik_turu: contentLabel, kart_metni: baseCaption, gorseller: mediaLabels, site: "CheckMatch.net" };
}

const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;
const HASHTAG_PATTERN = /#[\p{L}\p{N}_]+/gu;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;

function numbersIn(text: string): string[] {
  // Hashtag içindeki rakamlar (#UCL2026) sayı iddiası değildir.
  return (text.replace(HASHTAG_PATTERN, " ").match(NUMBER_PATTERN) ?? []).map((value) => value.replace(",", "."));
}

/** X uzunluğu: emoji 2 karakter sayılır (X'in ağırlıklı sayımına yakınsama). */
export function captionLength(caption: string, platform: PublishPlatform): number {
  const codePoints = [...caption].length;
  return platform === "X" ? codePoints + (caption.match(EMOJI_PATTERN)?.length ?? 0) : codePoints;
}

const HASHTAG_RANGE: Record<PublishPlatform, [number, number]> = { IG_POST: [5, 8], IG_REELS_STORY: [3, 5], X: [2, 3] };

/** Yayından önce admin'e gösterilen denetim uyarıları — metni değiştirmez. */
export function captionWarnings(caption: string, platform: PublishPlatform, factsText: string): string[] {
  const warnings: string[] = [];
  const known = new Set(numbersIn(factsText));
  const unknown = [...new Set(numbersIn(caption).filter((value) => !known.has(value)))];
  if (unknown.length > 0) warnings.push(`Kart verisinde olmayan sayı: ${unknown.join(", ")} — kontrol edin.`);
  const limit = PUBLISH_PLATFORM_DEFS[platform].captionLimit;
  const length = captionLength(caption, platform);
  if (length > limit) warnings.push(`${PUBLISH_PLATFORM_DEFS[platform].label} sınırı ${limit} karakter — metin ${length} karakter.`);
  const hashtags = caption.match(HASHTAG_PATTERN)?.length ?? 0;
  const [min, max] = HASHTAG_RANGE[platform];
  if (hashtags < min || hashtags > max) warnings.push(`${hashtags} hashtag var — bu platform için ${min}-${max} önerilir.`);
  return warnings;
}

const publishSchema = z.object({
  platform: z.enum(PUBLISH_PLATFORMS),
  layout: z.enum(PUBLISH_LAYOUTS),
  mediaOrder: z.array(z.string()),
});

/** Onayda kaydedilmiş yayın ayarları (`renderOptions.publish`); yoksa null. */
export function parsePublishSettings(renderOptions: unknown): PublishSettings | null {
  const parsed = z.object({ publish: publishSchema }).safeParse(renderOptions);
  return parsed.success ? parsed.data.publish : null;
}

/** Dizilim yalnızca izinli adreslerden (taslağın görselleri + doğrulanmış galeri), tekrarsız; tekli düzende tek öğe. */
export function validMediaOrder(order: string[], allowedUrls: string[], layout: PublishSettings["layout"], platform: PublishPlatform): boolean {
  const allowed = new Set(allowedUrls);
  if (order.length === 0 || new Set(order).size !== order.length || order.some((url) => !allowed.has(url))) return false;
  return layout === "single" ? order.length === 1 : order.length <= PUBLISH_PLATFORM_DEFS[platform].maxMedia;
}
