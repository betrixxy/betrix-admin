import { formatNumber } from "@/lib/format/number";
import { highlightText } from "@/lib/player-stats/rows";
import { CONTENT_TAGS, hashtagLine } from "@/lib/dashboard/caption-hashtags";
import { matchResultTitle } from "@/lib/dashboard/match-result-caption";
import type { PlayerNames } from "@/lib/dashboard/player-stats-card";
import type { PlayerMatchLine, PlayerStatsFacts } from "@/types/player-match-stats";

/**
 * Oyuncu İstatistikleri gönderi metni taslağı — şablondan (LLM yok): her sayı maç verisinden, olmayan satır
 * yazılmaz, analiz/bahis dili yok; sonunda etkileşim sorusu ve 3–5 hashtag (A: oyuncu + takımlar, B: takımlar
 * + turnuva). Admin inceleme ekranında düzenler; onayda dil kapısından geçer.
 */

export const PLAYER_STATS_QUESTION = "Sizce maçın oyuncusu kimdi? Yorumlara yazın 👇";

const teamName = (facts: PlayerStatsFacts, line: PlayerMatchLine) => (line.side === "HOME" ? facts.match.home.name : facts.match.away.name);
const displayName = (line: PlayerMatchLine, names: PlayerNames | undefined) => names?.get(line.playerId)?.name ?? line.name;
const playerLine = (facts: PlayerStatsFacts, line: PlayerMatchLine, names: PlayerNames | undefined) => {
  const parts = [`${displayName(line, names)} (${teamName(facts, line)})`];
  if (line.rating !== null) parts.push(`${formatNumber(line.rating, { decimals: 1 })} puan`);
  const highlight = highlightText(line);
  if (highlight) parts.push(highlight);
  return parts.join(" · ");
};

const footer = (facts: PlayerStatsFacts) => [`${matchResultTitle(facts.match)} · ${facts.match.competition.name} · ${facts.match.roundLabel}`];
const ending = (tags: string) => ["", PLAYER_STATS_QUESTION, "", tags];

export function buildSpotlightCaption(facts: PlayerStatsFacts, line: PlayerMatchLine, names?: PlayerNames, fact?: string | null): string {
  const { home, away, competition } = facts.match;
  const tags = hashtagLine({ names: [displayName(line, names), home.name, away.name, competition.name], type: CONTENT_TAGS.PLAYER_SPOTLIGHT });
  const head = ["⭐ MAÇIN OYUNCUSU", playerLine(facts, line, names), fact ?? null, ...footer(facts)].filter((text): text is string => Boolean(text));
  return [...head, ...ending(tags)].join("\n");
}

export function buildTopPlayersCaption(facts: PlayerStatsFacts, lines: PlayerMatchLine[], names?: PlayerNames): string {
  const { home, away, competition } = facts.match;
  const tags = hashtagLine({ names: [home.name, away.name], competitions: [competition.name], type: CONTENT_TAGS.PLAYER_TOP });
  return ["MAÇIN EN İYİLERİ", ...lines.map((line, index) => `${index + 1}. ${playerLine(facts, line, names)}`), ...footer(facts), ...ending(tags)].join("\n");
}
