import type { MatchOutcome, ScorerLine } from "./match-result";

/**
 * "CheckMatch set" — maç sonrası kartların (01 Maç Sonucu, 02 İstatistikler, 03 Detay) ortak alanı.
 * Set kartları çoğu zaman carousel olarak arka arkaya paylaşılır: skor şeridi, sayfa etiketi ve alt
 * künye her kartta aynı bileşenle, aynı boyut ve konumda çizilir (`templates/checkmatch-set/`).
 */

export const SET_PAGES = ["RESULT", "STATS", "DETAIL"] as const;
export type SetPage = (typeof SET_PAGES)[number];

export const SET_PAGE_LABELS: Record<SetPage, string> = {
  RESULT: "01 · MAÇ SONUCU",
  STATS: "02 · İSTATİSTİKLER",
  DETAIL: "03 · DETAY",
};

export interface SetCard {
  /** tr-TR büyük harf. */
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  outcome: MatchOutcome;
  penaltyLabel: string | null;
  homeScorers: ScorerLine[];
  awayScorers: ScorerLine[];
  /** "UEFA AVRUPA LİGİ" */
  competitionLabel: string;
  /** "2. ÖN ELEME TURU" */
  roundLabel: string;
  /** Setin tek vurgu rengi (Maç Sonucu kuralı, bkz. `match-result-theme.ts`). */
  accentHex: string;
  /** "01 · MAÇ SONUCU"; tek başına paylaşılan kartta null (etiket çizilmez). */
  pageLabel: string | null;
  /** Sağ üstte, sayfa etiketiyle simetrik: maç tarihi "23.07.2026" (İstanbul günü). */
  dateLabel: string;
  homeLogo: string | null;
  awayLogo: string | null;
  leagueLogo: string | null;
  brandLogo: string;
}
