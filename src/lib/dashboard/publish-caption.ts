import { z } from "zod";
import { MAX_HASHTAGS, captionFormatGate } from "@/lib/dashboard/caption-format";
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
/** Set carousel'i (Maç Sonucu 01 + 02 İstatistikler) — sıra yayın sırasıdır. */
const carouselSchema = z.object({ carousel: z.array(z.object({ url: z.string().min(1), label: z.string() })).min(2) });

/** Taslağın yayınlanabilir görselleri: iki takımlı kartlarda ev + deplasman, diğerlerinde tek kart. */
/** Set carousel'inin kendi görselleri (silmede temizlenir); carousel değilse boş. */
export function carouselUrls(renderOptions: unknown): string[] {
  const carousel = carouselSchema.safeParse(renderOptions);
  return carousel.success ? carousel.data.carousel.map((slide) => slide.url) : [];
}

export function publishMediaOf(renderOptions: unknown, resultImageUrl: string | null): PublishMedia[] {
  const carousel = carouselSchema.safeParse(renderOptions);
  if (carousel.success) return carousel.data.carousel.map((slide) => ({ url: slide.url, label: slide.label }));
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

/** Modele giden olgu paketi: içerik türü ve kartın şablon metni (her sayı buradan gelir). Site adı alan adsız (metinde link yok). */
export function captionFacts(contentLabel: string, baseCaption: string, mediaLabels: string[]) {
  return { icerik_turu: contentLabel, kart_metni: baseCaption, gorseller: mediaLabels, site: "CheckMatch" };
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

/**
 * Önerilen hashtag aralığı (uyarı). Üst sınır her yerde `MAX_HASHTAGS` (5, Instagram kuralı — ortak kapı
 * `caption-format.ts` üstünü reddeder); Instagram gönderi ve Reels/Story 3-5, X 2-3 (yalnızca öneri).
 */
const HASHTAG_RANGE: Record<PublishPlatform, [number, number]> = { IG_POST: [3, MAX_HASHTAGS], IG_REELS_STORY: [3, MAX_HASHTAGS], X: [2, 3] };

export const hashtagRange = (platform: PublishPlatform): [number, number] => HASHTAG_RANGE[platform];

/** Yayından önce admin'e gösterilen denetim uyarıları — metni değiştirmez; kapı sebebi "onaylanmaz" diye başta. */
export function captionWarnings(caption: string, platform: PublishPlatform, factsText: string): string[] {
  const blocked = captionFormatGate(caption, platform);
  const warnings: string[] = blocked ? [`${blocked} — bu metinle onaylanmaz.`] : [];
  const known = new Set(numbersIn(factsText));
  const unknown = [...new Set(numbersIn(caption).filter((value) => !known.has(value)))];
  if (unknown.length > 0) warnings.push(`Kart verisinde olmayan sayı: ${unknown.join(", ")} — kontrol edin.`);
  const limit = PUBLISH_PLATFORM_DEFS[platform].captionLimit;
  const length = captionLength(caption, platform);
  if (length > limit) warnings.push(`${PUBLISH_PLATFORM_DEFS[platform].label} sınırı ${limit} karakter — metin ${length} karakter.`);
  const hashtags = caption.match(HASHTAG_PATTERN)?.length ?? 0;
  const [min, max] = hashtagRange(platform);
  if ((hashtags < min || hashtags > max) && hashtags <= MAX_HASHTAGS) warnings.push(`${hashtags} hashtag var — bu platform için ${min}-${max} önerilir.`);
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

/**
 * Onay ve yayında dizilimin sunucu kuralı. Set carousel'inde (01 + 02 [+ 03]) çoklu düzen, kayıttaki GÜNCEL
 * carousel'in BÜTÜN sayfalarını içermeli (sıra ve galeri eki serbest): 03 sonradan eklendiyse eski dizilim
 * kaydedilemez/paylaşılamaz — sessizce tamamlanmaz, çünkü admin sırayı görmeden yayın sırası değişmesin.
 * Tekli düzen bilinçli seçimdir (yalnız kapak), denetlenmez. Sorun yoksa null.
 */
export function mediaOrderProblem(settings: PublishSettings, allowedUrls: string[], renderOptions: unknown): string | null {
  if (!validMediaOrder(settings.mediaOrder, allowedUrls, settings.layout, settings.platform)) return "Görsel dizilimi geçersiz — sayfayı yenileyip tekrar deneyin.";
  const carousel = carouselSchema.safeParse(renderOptions);
  if (settings.layout !== "multi" || !carousel.success) return null;
  const missing = carousel.data.carousel.filter((slide) => !settings.mediaOrder.includes(slide.url));
  if (missing.length === 0) return null;
  return `Set'in güncel sayfaları dizilimde yok (${missing.map((slide) => slide.label).join(", ")}) — sayfayı yenileyip sırayı kontrol edin.`;
}

/**
 * Taslağın görsel listesi sunucuda değişince (ör. "Oyuncu sayfasını ekle" → 03) Yayın Merkezi dizilimi:
 * admin'in sırası ve galeri eklemeleri korunur, artık olmayan kart düşer, yeni sayfa sona eklenir.
 */
export function mergeMediaOrder(current: PublishMedia[], media: PublishMedia[]): PublishMedia[] {
  const byUrl = new Map(media.map((item) => [item.url, item]));
  const kept = current.flatMap((item) => (item.fromGallery ? [item] : byUrl.has(item.url) ? [byUrl.get(item.url) ?? item] : []));
  return [...kept, ...media.filter((item) => !kept.some((existing) => existing.url === item.url))];
}
