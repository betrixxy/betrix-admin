import { formatNumber } from "@/lib/format/number";
import { highlightText } from "@/lib/player-stats/rows";
import { matchResultTitle } from "@/lib/dashboard/match-result-caption";
import type { PlayerNames } from "@/lib/dashboard/player-stats-card";
import type { PlayerMatchLine, PlayerStatsFacts } from "@/types/player-match-stats";

/**
 * Oyuncu İstatistikleri gönderi metni taslağı — şablondan (LLM yok): her sayı maç verisinden, olmayan satır
 * yazılmaz, analiz/bahis dili yok. Admin inceleme ekranında düzenler; onayda dil kapısından geçer.
 */

const teamName = (facts: PlayerStatsFacts, line: PlayerMatchLine) => (line.side === "HOME" ? facts.match.home.name : facts.match.away.name);
const playerLine = (facts: PlayerStatsFacts, line: PlayerMatchLine, names: PlayerNames | undefined) => {
  const parts = [`${names?.get(line.playerId)?.name ?? line.name} (${teamName(facts, line)})`];
  if (line.rating !== null) parts.push(`${formatNumber(line.rating, { decimals: 1 })} puan`);
  const highlight = highlightText(line);
  if (highlight) parts.push(highlight);
  return parts.join(" · ");
};

const footer = (facts: PlayerStatsFacts) => [`${matchResultTitle(facts.match)} · ${facts.match.competition.name} · ${facts.match.roundLabel}`, "Puan: API-Football"];

export function buildSpotlightCaption(facts: PlayerStatsFacts, line: PlayerMatchLine, names?: PlayerNames, fact?: string | null): string {
  return ["⭐ MAÇIN OYUNCUSU", playerLine(facts, line, names), fact ?? null, ...footer(facts)].filter((text): text is string => Boolean(text)).join("\n");
}

export function buildTopPlayersCaption(facts: PlayerStatsFacts, lines: PlayerMatchLine[], names?: PlayerNames): string {
  return ["MAÇIN EN İYİLERİ", ...lines.map((line, index) => `${index + 1}. ${playerLine(facts, line, names)}`), ...footer(facts)].join("\n");
}
