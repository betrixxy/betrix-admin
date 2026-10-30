import { shortTeamName } from "@/lib/names/team-short-names";

/**
 * Hangi kart alanı hangi TAKIM adı biçimini yazar — TEK KAYNAK (2026-10-31, testle sabit:
 * `tests/unit/team-name-forms.test.ts`). Uzun: kart adı (`cardTeamName`, "Borussia Mönchengladbach"); kısa:
 * yayıncı kısa adı (`team-short-names.ts`, "M'gladbach"). Kural: poster, başlık ve geniş satır uzun; sabit
 * genişlikli dar kutu (çubuk etiketi, gösterge altı, skorlu tek satır) kısa. Kişi adları ayrı tabloda
 * (`card-name-forms.ts`).
 */
export const TEAM_NAME_FORMS = {
  /** Vitrin 01 poster: dev "EV × DEPLASMAN" satırı ve manşet (en küçük puntoda sığmazsa — 16:9 dar sütun — kısa ada düşer). */
  VITRIN_POSTER_TEAMS: "long",
  /** Vitrin 01 kazanma çubuğunun altındaki üç etiket (dar segment). */
  VITRIN_BAR_LABELS: "short",
  /** Vitrin 02 form rehberi satırı (geniş satır, punto sığdırılır). */
  VITRIN_FORM_ROWS: "long",
  /** Vitrin 02 göstergesinin altındaki seçenek adı (360 px yay). */
  VITRIN_GAUGE_LABEL: "short",
  /** Vitrin gönderi metni. */
  VITRIN_CAPTION: "long",
  /** Maç Analizi 01/02 "logo · AD · skor · AD · logo" satırı. */
  MATCH_ANALYSIS_TEAMS_ROW: "short",
  /** Maç Analizi 02 olgu cümleleri (sarılan paragraf). */
  MATCH_ANALYSIS_FACTS: "long",
} as const satisfies Record<string, "long" | "short">;

export type TeamNameSlot = keyof typeof TEAM_NAME_FORMS;

/** Alanın biçimindeki takım adı (büyütülmemiş kart adından). */
export function teamNameFor(slot: TeamNameSlot, cardName: string): string {
  return TEAM_NAME_FORMS[slot] === "long" ? cardName : shortTeamName(cardName);
}
