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
  "POST_MATCH_CARD",
  "MATCH_STATS",
  "PLAYER_STATS",
  "MARKET_RESULTS",
  "POST_MATCH_REPORT",
  "STANDINGS",
  "HEAD_TO_HEAD",
  "DRAWS_AND_PAIRINGS",
] as const;
export type ContentTypeId = (typeof CONTENT_TYPE_IDS)[number];

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
