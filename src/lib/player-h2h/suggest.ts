import type { H2HPosition } from "@/types/player-h2h";

/**
 * Maçtan başlarken karşı tarafın önerisi — saf, istemcide çalışır. Admin bir tarafın oyuncusunu
 * değiştirince diğer taraf AYNI MEVKİDEN önerilir: diğer taraf hâlâ öneride duruyorsa (elle seçilmediyse)
 * kendiliğinden değişir; elle seçildiyse dokunulmaz, öneri yalnızca gösterilir. Farklı mevki seçilirse
 * karşılaştırmanın uyarısı (`comparisonWarnings`) aynen kalır.
 */

/** Takım başına mevki → arşivdeki oyuncu anahtarı ("<apiId>:<takımId>"). */
export type PositionSuggestions = Partial<Record<H2HPosition, string>>;

const POSITIONS: readonly string[] = ["FWD", "MID", "DEF", "GK"];

/** Arşiv mevkisi (PersonPosition) → karşılaştırma mevkisi; bilinmiyorsa null. */
export function slotPosition(position: string | null | undefined): H2HPosition | null {
  return position && POSITIONS.includes(position) ? (position as H2HPosition) : null;
}

export interface CounterpartInput {
  /** Değiştirilen oyuncunun mevkisi. */
  position: H2HPosition | null;
  /** Diğer takımın mevki önerileri. */
  other: PositionSuggestions;
  /** Diğer tarafın şu anki seçimi. */
  otherKey: string | null;
  /** Diğer taraf hâlâ öneride mi (elle değiştirilmedi). */
  otherIsSuggested: boolean;
}

export interface CounterpartResult {
  /** Diğer tarafa kendiliğinden yazılacak anahtar; yazılmayacaksa null. */
  apply: string | null;
  /** Elle seçilmiş tarafta gösterilecek öneri (zaten seçiliyse null). */
  hint: string | null;
}

export function counterpartSuggestion({ position, other, otherKey, otherIsSuggested }: CounterpartInput): CounterpartResult {
  const key = position ? (other[position] ?? null) : null;
  if (!key || key === otherKey) return { apply: null, hint: null };
  return otherIsSuggested ? { apply: key, hint: null } : { apply: null, hint: key };
}
