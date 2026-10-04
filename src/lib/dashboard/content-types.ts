import { CONTENT_PHASES, type ActiveContentType, type ContentPhase, type ContentTypeDef, type ContentTypeId } from "@/types/content-type";

/**
 * Maç Merkezi'nin ve Takvim kontrol merkezinin içerik türü kataloğu — TEK kaynak. Yeni bir tür
 * eklemek: `types/content-type.ts`'teki `CONTENT_TYPE_IDS`'e kimliği, buraya bir satır. Stüdyosu
 * hazır olduğunda `status: "active"` ve `route` verilir; menü, "(Yakında)" etiketi, buton durumu ve
 * takvimdeki ilerleme buradan türetilir. Sunucu bağımlılığı yoktur — istemci bileşenleri doğrudan
 * içe aktarır.
 */
export const CONTENT_TYPES: readonly ContentTypeDef[] = [
  // ---- Maç öncesi ----
  {
    id: "MATCH_DAY",
    label: "Maç Günü Kartı",
    description: "Oyuncu fotoğraflı, AI sahneli maç önü posteri — 3 şablon, 4 platform formatı.",
    phase: "pre_match",
    status: "active",
    route: "/dashboard/studio/match-day",
  },
  { id: "WEEKLY_FIXTURES", label: "Haftanın Maçları", description: "Haftanın fikstürü tek görselde.", phase: "pre_match", status: "coming_soon", route: null },
  { id: "PROBABLE_LINEUPS", label: "Muhtemel 11", description: "İki takımın muhtemel ilk 11'i ve dizilişi.", phase: "pre_match", status: "coming_soon", route: null },
  {
    id: "AI_MARKET_PREDICTION",
    label: "AI Market Tahmin & Analiz",
    description: "CheckMatch verisiyle maç öncesi market tahmini ve gerekçesi.",
    phase: "pre_match",
    status: "coming_soon",
    route: null,
  },
  { id: "HEAD_TO_HEAD", label: "Head to Head", description: "İki takımın aralarındaki son maçlar.", phase: "pre_match", status: "coming_soon", route: null },
  {
    id: "DRAWS_AND_PAIRINGS",
    label: "Kuralar ve Maç Eşleşmeleri",
    description: "Kura çekimi ve turnuva eşleşmeleri.",
    phase: "pre_match",
    status: "coming_soon",
    route: null,
  },
  // ---- Maç sonrası ----
  { id: "POST_MATCH_CARD", label: "Maç Sonu Kartı", description: "Skor ve maçın öne çıkanları.", phase: "post_match", status: "coming_soon", route: null },
  { id: "MATCH_STATS", label: "Maç İstatistikleri", description: "Topa sahip olma, şut, xG karşılaştırması.", phase: "post_match", status: "coming_soon", route: null },
  { id: "PLAYER_STATS", label: "Oyuncu İstatistikleri", description: "Maçın/oyuncunun bireysel performans kartı.", phase: "post_match", status: "coming_soon", route: null },
  { id: "MARKET_RESULTS", label: "Market Sonuçları", description: "Tahminlerin maç sonu tutma durumu.", phase: "post_match", status: "coming_soon", route: null },
  {
    id: "POST_MATCH_REPORT",
    label: "Maç Sonrası Analiz Raporu",
    description: "Maçın veriye dayalı analiz raporu.",
    phase: "post_match",
    status: "coming_soon",
    route: null,
  },
  { id: "STANDINGS", label: "Puan Durumu", description: "Ligin güncel puan tablosu.", phase: "post_match", status: "coming_soon", route: null },
];

export const CONTENT_PHASE_LABELS: Record<ContentPhase, string> = {
  pre_match: "Maç Öncesi İçerikler",
  post_match: "Maç Sonrası İçerikler",
};

/** Katalog, evre sırasıyla gruplanmış — kontrol merkezi bu sırayla listeler. */
export const CONTENT_TYPES_BY_PHASE: readonly { phase: ContentPhase; types: ContentTypeDef[] }[] = CONTENT_PHASES.map((phase) => ({
  phase,
  types: CONTENT_TYPES.filter((type) => type.phase === phase),
}));

/** Menüde varsayılan seçili tür: ilk aktif olan. */
export const DEFAULT_CONTENT_TYPE_ID: ContentTypeId = CONTENT_TYPES.find((type) => type.status === "active")?.id ?? "MATCH_DAY";

export function getContentType(id: string): ContentTypeDef | undefined {
  return CONTENT_TYPES.find((type) => type.id === id);
}

export function isContentTypeId(value: string): value is ContentTypeId {
  return CONTENT_TYPES.some((type) => type.id === value);
}

export function contentTypeOptionLabel(type: ContentTypeDef): string {
  return type.status === "coming_soon" ? `${type.label} (Yakında)` : type.label;
}

/** Aktif türün stüdyo adresi, maç kimliğiyle — form bu parametreden otomatik dolar. */
export function buildStudioHref(type: ActiveContentType, fixtureId: string): string {
  return `${type.route}?${new URLSearchParams({ fixtureId }).toString()}`;
}
