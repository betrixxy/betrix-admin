import { clock } from "@/lib/format/dates";
import type { MatchSide } from "@/types/match-result";
import type { PlayerDataSettlement, PlayerMatchLine } from "@/types/player-match-stats";

/**
 * Oyuncu verisi kesinleşti mi (saf). API-Football puanları ve maç içi sayıları maç bittikten bir süre sonra
 * doldurur/düzeltir; kesinleşmemiş veriyle kart üretilmez, stüdyo sebebi yazar ve "yeniden dene" sunar.
 *   1. Oyuncu bloğu boş → henüz gelmedi.
 *   2. Maç yeni bitti: başlama + normal süre (FT 115 dk, uzatma/penaltı 150 dk) + 30 dk bekleme dolmadı.
 *   3. Puanlar eksik: bir takımda süre alanların puanlısı min(11, süre alan) altında.
 */

const MATCH_MINUTES: Record<string, number> = { FT: 115, AET: 150, PEN: 165 };
export const SETTLE_BUFFER_MINUTES = 30;
const MINUTE_MS = 60 * 1000;

export function settledAt(kickoffUtc: string, statusShort: string): Date {
  return new Date(Date.parse(kickoffUtc) + ((MATCH_MINUTES[statusShort] ?? 115) + SETTLE_BUFFER_MINUTES) * MINUTE_MS);
}

export function playerDataSettlement(input: { kickoffUtc: string; statusShort: string; lines: PlayerMatchLine[]; now: Date }): PlayerDataSettlement {
  if (input.lines.length === 0) return { settled: false, reason: "Oyuncu istatistikleri henüz gelmedi (API-Football maç oyuncu verisi boş).", readyAt: null };
  const ready = settledAt(input.kickoffUtc, input.statusShort);
  if (input.now < ready) {
    return { settled: false, reason: `Maç yeni bitti — oyuncu puanları genelde maç bitiminden ~${SETTLE_BUFFER_MINUTES} dk sonra kesinleşir (en erken ${clock(ready)}).`, readyAt: ready.toISOString() };
  }
  const missing = (["HOME", "AWAY"] as const satisfies readonly MatchSide[]).flatMap((side) => {
    const played = input.lines.filter((line) => line.side === side);
    const rated = played.filter((line) => line.rating !== null).length;
    return rated < Math.min(11, played.length) ? [`${side === "HOME" ? "ev sahibi" : "deplasman"} ${rated}/${played.length}`] : [];
  });
  if (missing.length > 0) return { settled: false, reason: `Oyuncu puanları henüz eksik (${missing.join(", ")} puanlı).`, readyAt: null };
  return { settled: true };
}
