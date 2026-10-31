import type { PlayerMatchLine, PlayerStatKey, PlayerStatRow } from "@/types/player-match-stats";
import { positionKeys, readStat } from "./catalog";

/**
 * Kartın satırları (saf): mevki listesi + yedek sırasıyla okunur, okunamayan (eksik) satır düşer, sıradaki
 * gelir. Orta saha/defans oyuncusu gol attıysa gol satırı başa alınır. A kartı 6–8 satır hedefler; kahraman ilk 2–3 SIFIR OLMAYAN satırdır (sıfır rakam büyük yazılmaz),
 * kalanlar sırasını koruyarak kompakt listeye.
 *
 * SIFIR satırı yazılmaz (canlı test v2, 2026-10-31: "TOP ÇALMA 0", "ASİST 0" anlamsız): yerine yedekten sıradaki
 * sıfır olmayan satır gelir. Anlamlı sıfır istisnadır — kalecinin YENİLEN GOL 0'ı (kalesini gole kapattı). Sıfırsız
 * satır `SPOTLIGHT_MIN_ROWS`'a yetmezse eksik kadar sıfır satırı (sırasıyla) geri gelir — kart kurala göre yine düşebilir.
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

/** Sıfırı bilgi taşıyan satırlar (kartta kalır). */
export const MEANINGFUL_ZERO: ReadonlySet<PlayerStatKey> = new Set<PlayerStatKey>(["conceded"]);

export function statRows(line: PlayerMatchLine, max = SPOTLIGHT_MAX_ROWS): PlayerStatRow[] {
  const read = orderedKeys(line).flatMap((key) => {
    const row = readStat(line, key);
    return row ? [row] : [];
  });
  const kept = read.filter((row) => !row.zero || MEANINGFUL_ZERO.has(row.key));
  const missing = Math.max(0, SPOTLIGHT_MIN_ROWS - kept.length);
  const restored = new Set(read.filter((row) => !kept.includes(row)).slice(0, missing));
  return read.filter((row) => kept.includes(row) || restored.has(row)).slice(0, max);
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
