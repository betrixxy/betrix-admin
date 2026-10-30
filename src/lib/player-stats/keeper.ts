import { countedGoals } from "@/lib/services/api-football/match-result-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";

/**
 * Kalecinin yenilediği gol — API-Football maç olaylarından (saf; kaynak aynı sağlayıcı, karışım sayılmaz).
 * Sağlayıcı `goals.conceded`'i kalecilerde de boş bırakıyor (Milan 2-4 Bologna). Kural: kalecinin sahada
 * olduğu süre OLAY SIRASIYLA belirlenir — ilk 11'deyse baştan, değilse girdiği değişiklik olayından
 * (`assist` = giren); çıktığı değişiklik (`player` = çıkan) ya da kırmızı kartına kadar. Bu aralıkta
 * RAKİBİN hanesine yazılan sayılan goller (kendi kalesine goller dahil — API KK olayını golün yazıldığı
 * takımla verir; kaçan penaltı, penaltı atışı ve VAR iptali `countedGoals` ile düşer) yenilen goldür.
 * Aynı dakikadaki gol ile değişiklik olay sırasıyla ayrılır. Giriş olayı bulunamazsa null (tahmin yok).
 */

const RED = /red card|second yellow/i;

export function keeperConceded(raw: ApiFootballFixtureResultRaw, playerId: number, teamId: number): number | null {
  const started = raw.lineups.some((lineup) => lineup.team.id === teamId && (lineup.startXI ?? []).some((entry) => entry.player.id === playerId));
  const events = raw.events;
  const entered = started ? -1 : events.findIndex((event) => event.type === "subst" && event.team.id === teamId && event.assist?.id === playerId);
  if (!started && entered < 0) return null;
  const leftAt = events.findIndex(
    (event, index) => index > entered && event.team.id === teamId && event.player.id === playerId && ((event.type === "subst" && event.assist?.id !== playerId) || (event.type === "Card" && RED.test(event.detail ?? ""))),
  );
  const end = leftAt < 0 ? events.length : leftAt;
  const counted = new Set(countedGoals(events));
  return events.filter((event, index) => index > entered && index < end && counted.has(event) && event.team.id !== teamId).length;
}
