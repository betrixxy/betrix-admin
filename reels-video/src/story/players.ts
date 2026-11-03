import { formatDecimal, formatInt } from "../lib/motion";
import type { CompareRow } from "../schema";
import type { OpponentMatch, PlayerSeason, PlayerVsOpponent } from "./match-data";

/** Oyuncu sahnelerinin saf kuralları. Kaynak API-Football; checkmatch oyuncu/kadro verisi kullanılmaz. */

/** Bu dakikanın altı küçük örneklem (`lib/player-h2h/stats.ts::SMALL_SAMPLE_MINUTES` ile aynı). */
export const MIN_DUEL_MINUTES = 270;
export const MIN_DUEL_ROWS = 5;
export const DUEL_SCOPE = "Tüm kulvarlar · bu sezon";
export const VS_SCOPE = "Tüm kulvarlar · sahaya çıktığı maçlar";
export const VS_MIN_MATCHES = 3;
export const VS_MIN_STREAK = 3;
export const VS_MIN_RATIO = 1.5;

const per90 = (value: number, minutes: number): number => (minutes > 0 ? (value * 90) / minutes : 0);
const two = (value: number): string => formatDecimal(value, 2);

/** Yıldız: yeterli dakikası olanlardan en çok gol + asist; eşitlikte daha az dakika. */
export function pickStar(candidates: readonly PlayerSeason[]): PlayerSeason | null {
  const score = (player: PlayerSeason) => (player.goals ?? 0) + (player.assists ?? 0);
  return [...candidates].filter((player) => player.minutes >= MIN_DUEL_MINUTES).sort((a, b) => score(b) - score(a) || a.minutes - b.minutes)[0] ?? null;
}

function row(key: string, label: string, home: number | null, away: number | null, format: (value: number) => string): CompareRow | null {
  if (home === null || away === null) return null;
  const [homeText, awayText] = [format(home), format(away)];
  // Üstün taraf ekranda yazan değere göre: yazılan iki değer aynıysa vurgu yok.
  return { key, label, home: homeText, away: awayText, better: homeText === awayText ? null : home > away ? "home" : "away" };
}

/** Maç, dakika, gol, asist, şut, isabetli şut, kilit pas, 90 dk başına. Eksik istatistik satırı düşer, 0 yazılmaz. */
export function duelRows(home: PlayerSeason, away: PlayerSeason): CompareRow[] {
  const contribution = (player: PlayerSeason) => (player.goals === null || player.assists === null ? null : per90(player.goals + player.assists, player.minutes));
  return [
    row("appearances", "Maç", home.appearances, away.appearances, formatInt),
    row("minutes", "Dakika", home.minutes, away.minutes, formatInt),
    row("goals", "Gol", home.goals, away.goals, formatInt),
    row("assists", "Asist", home.assists, away.assists, formatInt),
    row("shots", "Şut", home.shots, away.shots, formatInt),
    row("shots_on_target", "İsabetli şut", home.shots_on_target, away.shots_on_target, formatInt),
    row("key_passes", "Kilit pas", home.key_passes, away.key_passes, formatInt),
    row("per90", "Gol + asist / 90 dk", contribution(home), contribution(away), two),
  ].flatMap((item) => (item ? [item] : []));
}

/** Tarihe göre (eski → yeni) en uzun ardışık gol/asist serisi. */
export function longestContributionStreak(matches: readonly OpponentMatch[]): number {
  let best = 0;
  let current = 0;
  for (const match of [...matches].sort((a, b) => a.date.localeCompare(b.date))) {
    current = match.goals + match.assists > 0 ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

export interface VsOpponentStory {
  reason: "streak" | "ratio";
  streak: number;
  goals: number;
  assists: number;
  minutes: number;
  vsPer90: number;
  seasonPer90: number;
}

/**
 * "Rakibine karşı" yalnız gerçek hikâye varsa: en az 3 maç VE (en az 3 maçlık gol/asist serisi VEYA rakibe karşı gol/90 ≥
 * 1,5 × sezon gol/90). Hiç golü olmayan oyuncu, sezon golü de 0 diye orandan geçemez.
 */
export function vsOpponentStory(history: PlayerVsOpponent, season: Pick<PlayerSeason, "goals" | "minutes">): VsOpponentStory | null {
  const { matches } = history;
  if (matches.length < VS_MIN_MATCHES) return null;
  const goals = matches.reduce((sum, match) => sum + match.goals, 0);
  const assists = matches.reduce((sum, match) => sum + match.assists, 0);
  const minutes = matches.reduce((sum, match) => sum + match.minutes, 0);
  const vsPer90 = per90(goals, minutes);
  const seasonPer90 = season.goals === null ? null : per90(season.goals, season.minutes);
  const streak = longestContributionStreak(matches);
  const base = { streak, goals, assists, minutes, vsPer90, seasonPer90: seasonPer90 ?? 0 };
  if (streak >= VS_MIN_STREAK) return { reason: "streak", ...base };
  if (seasonPer90 !== null && goals > 0 && vsPer90 >= VS_MIN_RATIO * seasonPer90) return { reason: "ratio", ...base };
  return null;
}
