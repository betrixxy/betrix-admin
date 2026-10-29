import { matchPerson } from "@/lib/names/person-name";
import type { PlayerMatchLine, SportmonksLineupPlayer } from "@/types/player-match-stats";
import type { SportmonksPerson } from "@/types/person-name";

/**
 * xG eşleşmesi (saf) — API-Football'da oyuncu xG'si yok; Sportmonks'tan YALNIZCA şu koşulla alınır: aynı
 * maç (sağlayıcı eşlemesi `findSportmonksFixture`), aynı takım, ad eşleşmesi tek aday (`matchPerson`:
 * "S. Mbangula" ↔ "Samuel Mbangula", gerekirse forma numarası) VE iki kaynağın o maçtaki dakikası birebir
 * aynı. Biri tutmazsa xG yok — tahmin edilmez, 0 yazılmaz. Sportmonks'un diğer satırları kullanılmaz (tek kaynak).
 */

const asPerson = (player: SportmonksLineupPlayer): SportmonksPerson & { source: SportmonksLineupPlayer } => {
  const [first = "", ...rest] = player.name.split(/\s+/u);
  return { displayName: player.name, firstname: first, lastname: rest.join(" "), nationality: null, jersey: player.jersey, source: player };
};

export function withSportmonksXg(lines: PlayerMatchLine[], lineups: SportmonksLineupPlayer[], ids: { home: number; away: number }): { lines: PlayerMatchLine[]; matched: number } {
  let matched = 0;
  const out = lines.map((line) => {
    const teamId = line.side === "HOME" ? ids.home : ids.away;
    const people = lineups.filter((player) => player.teamId === teamId).map(asPerson);
    const found = matchPerson(line.name, people);
    const source = found ? people.find((person) => person === found)?.source : undefined;
    if (!source || source.xg === null || source.minutes === null || source.minutes !== line.minutes) return line;
    matched += 1;
    return { ...line, xg: source.xg };
  });
  return { lines: out, matched };
}
