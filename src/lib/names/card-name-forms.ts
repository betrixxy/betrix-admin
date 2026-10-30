import type { CardPersonName, NameForm } from "@/types/person-name";

/**
 * Hangi kart hangi ad biçimini yazar — TEK KAYNAK (2026-10-30, testle sabit: `tests/unit/card-name-forms.test.ts`).
 * İki biçim de `cardPersonName`'den: uzun posterlerde ("Uğurcan Çakır"; güvenilir yaygın ad yoksa soyad),
 * kısa liste ve sahada ("U. ÇAKIR", "S. MBANGULA"; ad bilinmiyorsa yalnız soyad).
 */
export const CARD_NAME_FORMS = {
  /** Oyuncu İstatistikleri A · Maçın Oyuncusu (poster: küçük ilk ad + büyük soyad). */
  PLAYER_STATS_SPOTLIGHT: "long",
  /** Oyuncu Karşılaştırması 01 poster. */
  PLAYER_H2H_POSTER: "long",
  /** Muhtemel 11 saha + Kahraman Liste. */
  LINEUP_PLAYERS: "short",
  /** Muhtemel 11 künyesindeki teknik direktör ("TEKNİK DİREKTÖR İlhan Palut"). */
  LINEUP_COACH: "long",
  /** Maç Sonucu (01) ve Maç İstatistikleri (02) golcü satırları. */
  SET_SCORERS: "short",
  /** Maç Sonucu "MAÇIN OYUNCUSU" satırı. */
  MATCH_RESULT_MVP: "short",
  /** Oyuncu İstatistikleri B · Maçın En İyileri. */
  PLAYER_STATS_TOP: "short",
  /** Maç Günü künyesindeki hakem ("HAKEM REŞAT ONUR COŞKUNSES"). */
  MATCH_DAY_REFEREE: "long",
} as const satisfies Record<string, NameForm>;

export type CardNameSlot = keyof typeof CARD_NAME_FORMS;

/** Kartın biçimindeki ad. */
export function nameFor(slot: CardNameSlot, person: Pick<CardPersonName, "name" | "short">): string {
  return CARD_NAME_FORMS[slot] === "long" ? person.name : person.short;
}
