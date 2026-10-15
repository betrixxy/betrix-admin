import { mockCounts } from "@/lib/services/social/mock";

/**
 * "Geçmiş gönderileri içe aktar" için mock yanıtlar (bkz. CLAUDE.md 5.2) — sağlayıcının ham biçiminde;
 * gerçek şema doğrulamasından ve `import-mappers.ts`'ten geçer. Gönderiler bugünden geriye, yarım gün
 * arayla dizilir; kimlikler sabit olduğu için tekrar içe aktarma idempotentliği gözlemlenebilir.
 */

const MOCK_POOL = 120;
const STEP_MS = 12 * 3_600_000;

const CAPTIONS = [
  "Derbi öncesi son 5 maç formu 🔥 Sizce kim kazanır?",
  "Haftanın maçları burada ⚽ #SüperLig #CheckMatch",
  "xG verisi ne diyor? Detaylar profilde 👆",
  "Muhtemel 11'ler açıklandı. Eksik var mı?",
  "Puan durumu güncellendi 📊",
];

function mockTime(index: number): string {
  return new Date(Date.now() - (index + 1) * STEP_MS).toISOString();
}

export function mockIgMediaPage(limit: number): unknown {
  const count = Math.min(limit, MOCK_POOL);
  return {
    data: Array.from({ length: count }, (_, index) => {
      const id = `mock-ig-media-${index + 1}`;
      const timestamp = mockTime(index);
      const c = mockCounts(id, new Date(timestamp));
      const carousel = index % 4 === 1;
      return {
        id,
        caption: CAPTIONS[index % CAPTIONS.length],
        media_type: carousel ? "CAROUSEL_ALBUM" : "IMAGE",
        media_product_type: "FEED",
        media_url: `https://example.com/mock/ig/${id}.jpg`,
        permalink: `https://www.instagram.com/p/${id}/`,
        timestamp,
        like_count: c.likes,
        comments_count: c.comments,
        ...(carousel
          ? { children: { data: [1, 2, 3].map((n) => ({ id: `${id}-${n}`, media_type: "IMAGE", media_url: `https://example.com/mock/ig/${id}-${n}.jpg` })) } }
          : {}),
      };
    }),
  };
}

export function mockXTweetPage(limit: number, includePrivate: boolean): unknown {
  const count = Math.min(limit, MOCK_POOL);
  const media: { media_key: string; type: string; url: string }[] = [];
  const data = Array.from({ length: count }, (_, index) => {
    const id = `mock-x-${1_900_000_000_000 - index}`;
    const created = mockTime(index);
    const c = mockCounts(id, new Date(created));
    const hasImage = index % 3 !== 2;
    if (hasImage) media.push({ media_key: `3_${id}`, type: "photo", url: `https://example.com/mock/x/${id}.jpg` });
    const young = Date.now() - new Date(created).getTime() < 30 * 86_400_000;
    return {
      id,
      text: CAPTIONS[index % CAPTIONS.length] ?? "",
      created_at: created,
      public_metrics: {
        retweet_count: c.shares,
        reply_count: c.comments,
        like_count: c.likes,
        quote_count: Math.round(c.shares * 0.2),
        bookmark_count: c.saves,
        impression_count: c.views,
      },
      ...(includePrivate && young
        ? { non_public_metrics: { impression_count: c.views, url_link_clicks: Math.round(c.views * 0.01), user_profile_clicks: Math.round(c.views * 0.004) } }
        : {}),
      ...(hasImage ? { attachments: { media_keys: [`3_${id}`] } } : {}),
    };
  });
  return { data, includes: { media }, meta: { result_count: data.length } };
}
