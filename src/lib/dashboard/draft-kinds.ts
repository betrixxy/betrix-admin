/**
 * Maç sonrası kart taslaklarının (inceleme ekranında "match-result" görünümüyle açılanlar) türe göre etiketi ve
 * indirme adı (saf). Maç Analizi (01 + 02 carousel) ve Tahmin Karnesi (tek kart) de bu görünümle incelenir/yayınlanır.
 */
export const SET_DRAFT_KINDS = {
  MATCH_RESULT: { label: "Maç Sonucu", slug: "mac-sonucu" },
  MATCH_STATS: { label: "Maç İstatistikleri", slug: "mac-sonucu" },
  PLAYER_STATS: { label: "Oyuncu İstatistikleri", slug: "oyuncu-istatistik" },
  MATCH_ANALYSIS: { label: "Maç Analizi", slug: "mac-analizi" },
  PREDICTION_SCORECARD: { label: "Tahmin Karnesi", slug: "tahmin-karnesi" },
} as const;

export type SetDraftKind = keyof typeof SET_DRAFT_KINDS;
export const SET_DRAFT_KIND_IDS = Object.keys(SET_DRAFT_KINDS) as [SetDraftKind, ...SetDraftKind[]];

export function isSetDraftKind(value: string | null): value is SetDraftKind {
  return value !== null && value in SET_DRAFT_KINDS;
}
