import type { PlayerMatchLine, PlayerStatKey, PlayerStatRow } from "@/types/player-match-stats";
import { positionKeys, readStat } from "./catalog";

/**
 * Kartın satırları (saf): mevki listesi + yedek sırasıyla okunur, okunamayan (eksik) satır düşer, sıradaki
 * gelir. Orta saha/defans oyuncusu gol attıysa gol satırı başa alınır. A kartı 6–8 satır hedefler; kahraman ilk 2–3 SIFIR OLMAYAN satırdır (sıfır rakam büyük yazılmaz),
 * kalanlar sırasını koruyarak kompakt listeye.
 */

export const SPOTLIGHT_MAX_ROWS = 8;
export const SPOTLIGHT_TARGET_ROWS = 6;
/** Bundan azında A kartı üretilmez (kaleci: kurtarış + pas isabeti + pas). */
export const SPOTLIGHT_MIN_ROWS = 3;

/** Orta saha ve defansta gol attıysa gol satırı listenin başına gelir (listelerinde gol yok ya da yedekte). */
function orderedKeys(line: PlayerMatchLine): PlayerStatKey[] {
  const keys = positionKeys(line.position);
  const scored = (line.numbers.goals ?? 0) > 0 && line.position !== "F" && line.position !== "G";
  return scored ? ["goals", ...keys.filter((key) => key !== "goals")] : keys;
}

export function statRows(line: PlayerMatchLine, max = SPOTLIGHT_MAX_ROWS): PlayerStatRow[] {
  const rows: PlayerStatRow[] = [];
  for (const key of orderedKeys(line)) {
    if (rows.length >= max) break;
    const row = readStat(line, key);
    if (row) rows.push(row);
  }
  return rows;
}

export function spotlightRows(line: PlayerMatchLine): { hero: PlayerStatRow[]; rows: PlayerStatRow[] } {
  const all = statRows(line);
  const heroCount = all.length >= SPOTLIGHT_TARGET_ROWS ? 3 : 2;
  const hero = all.filter((row) => !row.zero).slice(0, heroCount);
  return { hero, rows: all.filter((row) => !hero.includes(row)) };
}

/** B satırının "en belirgin 1–2 istatistiği": mevki sırasıyla ilk iki sıfır olmayan satır ("3 gol · 1 asist"). */
export function highlightText(line: PlayerMatchLine): string {
  return statRows(line)
    .filter((row) => !row.zero)
    .slice(0, 2)
    .map((row) => row.short)
    .join(" · ");
}
