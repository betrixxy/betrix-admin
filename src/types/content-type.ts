/**
 * Ajans içerik türleri (Maç Merkezi → "Stüdyoya Git"). Liste `lib/dashboard/content-types.ts`'te
 * yaşar; burada yalnızca şekli tanımlanır. Statü discriminated union'dır: aktif bir türün stüdyo
 * adresi zorunludur, "yakında" olanın adresi yoktur — yarım tanımlı bir tür derlenmez.
 */
export const CONTENT_TYPE_IDS = [
  "MATCH_DAY",
  "WEEKLY_FIXTURES",
  "PROBABLE_LINEUPS",
  "AI_MARKET_PREDICTION",
  "PLAYER_H2H",
  "MATCH_RESULT",
  "MATCH_STATS",
  "PLAYER_STATS",
  "PREDICTION_SCORECARD",
  "MATCH_ANALYSIS",
  "STANDINGS",
  "DRAWS_AND_PAIRINGS",
] as const;
export type ContentTypeId = (typeof CONTENT_TYPE_IDS)[number];

/**
 * Eski kimlikler (2026-10-30 yeniden adlandırma): yalnızca okuma eşlemesi. Bu kimliklerin stüdyosu hiç olmadı;
 * veritabanında ancak eski planlama placeholder'ı (görselsiz DRAFT, İçerik Kontrol Merkezi) olarak kalabilirler.
 * Yazan kod yolu yok; UTM `utm_campaign` yalnızca yayınlanan kayıttan üretilir (placeholder yayınlanmaz).
 */
export const LEGACY_CONTENT_TYPE_IDS: Readonly<Record<string, ContentTypeId>> = {
  MARKET_RESULTS: "PREDICTION_SCORECARD",
  POST_MATCH_REPORT: "MATCH_ANALYSIS",
};

/** Takvimdeki kontrol merkezinde gruplama: maç öncesi mi, maç sonrası mı üretilir. */
export const CONTENT_PHASES = ["pre_match", "post_match"] as const;
export type ContentPhase = (typeof CONTENT_PHASES)[number];

interface ContentTypeBase {
  id: ContentTypeId;
  label: string;
  /** Seçim menüsünde/ipucunda gösterilen tek cümlelik açıklama. */
  description: string;
  phase: ContentPhase;
}

export interface ActiveContentType extends ContentTypeBase {
  status: "active";
  /** Stüdyo sayfası; maç seçiliyse `?fixtureId=` ile açılır ve form otomatik dolar. */
  route: `/dashboard/${string}`;
}

export interface ComingSoonContentType extends ContentTypeBase {
  status: "coming_soon";
  route: null;
}

/**
 * İleride eklenecek alanlar (ör. `rules` — hangi maçta/ligde/zamanda önerileceği) bu birleşime
 * eklenir; tüketen bileşenler yalnızca `status` ve `route`'a baktığı için değişmez.
 */
export type ContentTypeDef = ActiveContentType | ComingSoonContentType;
