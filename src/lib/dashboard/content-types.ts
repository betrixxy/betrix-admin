import type { ActiveContentType, ContentTypeDef, ContentTypeId } from "@/types/content-type";

/**
 * Maç Merkezi'nin içerik türü kataloğu — TEK kaynak. Yeni bir tür eklemek: `types/content-type.ts`'teki
 * `CONTENT_TYPE_IDS`'e kimliği, buraya bir satır. Stüdyosu hazır olduğunda `status: "active"` ve
 * `route` verilir; menü, "(Yakında)" etiketi ve buton durumu buradan türetilir. Sunucu bağımlılığı
 * yoktur — istemci bileşenleri doğrudan içe aktarır.
 */
export const CONTENT_TYPES: readonly ContentTypeDef[] = [
  {
    id: "MATCH_DAY",
    label: "Maç Günü Kartı",
    description: "Oyuncu fotoğraflı, AI sahneli maç önü posteri — 3 şablon, 4 platform formatı.",
    status: "active",
    route: "/dashboard/studio/match-day",
  },
  { id: "WEEKLY_FIXTURES", label: "Haftanın Maçları", description: "Haftanın fikstürü tek görselde.", status: "coming_soon", route: null },
  { id: "PROBABLE_LINEUPS", label: "Muhtemel 11", description: "İki takımın muhtemel ilk 11'i ve dizilişi.", status: "coming_soon", route: null },
  {
    id: "AI_MARKET_PREDICTION",
    label: "AI Market Tahmin & Analiz",
    description: "CheckMatch verisiyle maç öncesi market tahmini ve gerekçesi.",
    status: "coming_soon",
    route: null,
  },
  { id: "POST_MATCH_CARD", label: "Maç Sonu Kartı", description: "Skor ve maçın öne çıkanları.", status: "coming_soon", route: null },
  { id: "MATCH_STATS", label: "Maç İstatistikleri", description: "Topa sahip olma, şut, xG karşılaştırması.", status: "coming_soon", route: null },
  { id: "PLAYER_STATS", label: "Oyuncu İstatistikleri", description: "Maçın/oyuncunun bireysel performans kartı.", status: "coming_soon", route: null },
  { id: "MARKET_RESULTS", label: "Market Sonuçları", description: "Tahminlerin maç sonu tutma durumu.", status: "coming_soon", route: null },
  {
    id: "POST_MATCH_REPORT",
    label: "Maç Sonrası Analiz Raporu",
    description: "Maçın veriye dayalı analiz raporu.",
    status: "coming_soon",
    route: null,
  },
  { id: "STANDINGS", label: "Puan Durumu", description: "Ligin güncel puan tablosu.", status: "coming_soon", route: null },
  { id: "HEAD_TO_HEAD", label: "Head to Head", description: "İki takımın aralarındaki son maçlar.", status: "coming_soon", route: null },
  {
    id: "DRAWS_AND_PAIRINGS",
    label: "Kuralar ve Maç Eşleşmeleri",
    description: "Kura çekimi ve turnuva eşleşmeleri.",
    status: "coming_soon",
    route: null,
  },
];

/** Menüde varsayılan seçili tür: ilk aktif olan. */
export const DEFAULT_CONTENT_TYPE_ID: ContentTypeId = CONTENT_TYPES.find((type) => type.status === "active")?.id ?? "MATCH_DAY";

export function getContentType(id: string): ContentTypeDef | undefined {
  return CONTENT_TYPES.find((type) => type.id === id);
}

export function contentTypeOptionLabel(type: ContentTypeDef): string {
  return type.status === "coming_soon" ? `${type.label} (Yakında)` : type.label;
}

/** Aktif türün stüdyo adresi, maç kimliğiyle — form bu parametreden otomatik dolar. */
export function buildStudioHref(type: ActiveContentType, fixtureId: string): string {
  return `${type.route}?${new URLSearchParams({ fixtureId }).toString()}`;
}
