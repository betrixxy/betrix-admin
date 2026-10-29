/**
 * API kaynaklı şüpheli aksan (saf) — Ad Raporu'nda "aksan şüpheli" olarak listelenir, OTOMATİK DÜZELTME YOK.
 *
 * Kural: sözcük sonunda ağır aksanlı "è" ("Cissè"). Fransızca ve Batı Afrika adlarında sözcük sonu
 * neredeyse her zaman "é"dir (Cissé, Koné, Touré); API-Football bazı adları yanlış aksanla verir. Diğer
 * ağır aksanlar listelenmez: İtalyanca "Niccolò" gibi doğru yazımlar çoktur, yanlış alarm admin'i yorar.
 */

const FINAL_GRAVE_E = /(\p{L})([èÈ])(?=$|[\s'’.,-])/gu;

export interface AccentSuspicion {
  /** Şüpheli sözcük(ler), adın içindeki yazımıyla. */
  words: string[];
  /** Öneri: sözcük sonu è → é (yalnızca öneri; admin onaylarsa Ad Raporu'ndan düzeltilir). */
  suggestion: string;
}

export function suspiciousAccent(name: string): AccentSuspicion | null {
  const words = name.split(/\s+/u).filter((word) => new RegExp(FINAL_GRAVE_E.source, "u").test(word));
  if (words.length === 0) return null;
  const suggestion = name.replace(FINAL_GRAVE_E, (_match, letter: string, grave: string) => `${letter}${grave === "È" ? "É" : "é"}`);
  return { words, suggestion };
}
