import type { HalfRow, HalfStatsSource, HalvesOutcome } from "@/types/match-analysis";

/**
 * 02 · DEVRE DEVRE — TEK KAYNAK kuralı (saf). Kaynaklar satır bazında KARIŞMAZ:
 *  1. API-Football devre istatistiği en az `MIN_HALF_ROWS` tam satır veriyorsa 02'nin BÜTÜN satırları oradan;
 *     orada eksik olan satır düşer (Sportmonks'tan doldurulmaz, 0 yazılmaz).
 *  2. Değilse Sportmonks dönem istatistiği aynı koşulla — bütün satırlar oradan.
 *  3. İkisi de yetmiyorsa 02 düşer; sebep (Türkçe) stüdyoda gösterilir, 01 tek başına üretilir.
 * `null` = kaynak okunamadı / eşleşmedi; `[]` = kaynak yanıt verdi ama devre verisi yok.
 */

export const MIN_HALF_ROWS = 2;

const SOURCE_LABELS: Record<HalfStatsSource, string> = { API_FOOTBALL: "API-Football", SPORTMONKS: "Sportmonks" };
export const halfSourceLabel = (source: HalfStatsSource): string => SOURCE_LABELS[source];

function describe(rows: HalfRow[] | null, name: string): string {
  if (rows === null) return `${name} okunamadı ya da maç eşleşmedi`;
  if (rows.length === 0) return `${name} bu maç için devre verisi vermiyor`;
  return `${name} yalnızca ${rows.length} satır veriyor (en az ${MIN_HALF_ROWS} gerekli)`;
}

export function chooseHalves(apiFootball: HalfRow[] | null, sportmonks: HalfRow[] | null, sportmonksTried = true): HalvesOutcome {
  if (apiFootball && apiFootball.length >= MIN_HALF_ROWS) return { available: true, stats: { source: "API_FOOTBALL", rows: apiFootball } };
  if (sportmonks && sportmonks.length >= MIN_HALF_ROWS) return { available: true, stats: { source: "SPORTMONKS", rows: sportmonks } };
  const parts = [describe(apiFootball, "API-Football"), sportmonksTried ? describe(sportmonks, "Sportmonks") : "Sportmonks denenmedi"];
  return { available: false, reason: `Devre verisi yok — 02 · Devre Devre üretilmedi (${parts.join("; ")}). 01 · Zaman Çizelgesi tek başına üretilebilir.` };
}

/** API-Football yeterliyse Sportmonks'a hiç gidilmez (çağıran: `match-analysis-data.ts`). */
export const apiFootballSuffices = (rows: HalfRow[] | null): boolean => rows !== null && rows.length >= MIN_HALF_ROWS;
