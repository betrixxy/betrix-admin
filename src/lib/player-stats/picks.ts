import type { MatchResultFacts } from "@/types/match-result";
import type { PlayerMatchLine } from "@/types/player-match-stats";

/**
 * Oyuncu seçimi (saf). A'nın varsayılanı Maç Sonucu'nun "MAÇIN OYUNCUSU" önerisidir — AYNI fonksiyondan
 * (`match-result-mappers.ts::pickMvp` → `facts.mvp`); burada yeniden hesaplanmaz. B: iki takımdan en yüksek
 * puanlı 3 ya da 5 oyuncu, en az 30 dakika; puan eşitliğinde dakikası fazla olan önce.
 */

export const TOP_MIN_MINUTES = 30;

/** A'nın varsayılan oyuncusu: Maç Sonucu MVP'si (kazanandan en yüksek puan; beraberlikte iki takımdan). */
export function defaultSpotlightId(match: Pick<MatchResultFacts, "mvp">): number | null {
  return match.mvp?.playerId ?? null;
}

export function topPlayers(lines: PlayerMatchLine[], size: number): PlayerMatchLine[] {
  return lines
    .filter((line) => line.rating !== null && (line.minutes ?? 0) >= TOP_MIN_MINUTES)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.minutes ?? 0) - (a.minutes ?? 0) || a.playerId - b.playerId)
    .slice(0, size);
}

/** A'da seçilebilir oyuncular: puanı olanlar, puana göre (form listesi). */
export function spotlightOptions(lines: PlayerMatchLine[]): PlayerMatchLine[] {
  return lines.filter((line) => line.rating !== null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.minutes ?? 0) - (a.minutes ?? 0));
}
