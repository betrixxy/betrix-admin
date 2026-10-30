import { findSportmonksFixture, type SportmonksFixtureQuery } from "@/lib/services/sportmonks/advanced-stats";
import type { SportmonksFixture } from "@/lib/services/sportmonks/advanced-stats-mappers";
import { isSportmonksConfigured } from "@/lib/services/sportmonks/client";
import type { SportmonksLineupPlayer } from "@/types/player-match-stats";

/**
 * Oyuncu İstatistikleri xG'si: aynı maçın Sportmonks dizilişi (oyuncu başına `MINUTES_PLAYED` +
 * `EXPECTED_GOALS`). Tip `developer_name` ile okunur. Anahtar yoksa, maç eşleşmezse ya da istek düşerse
 * `null` — kart xG'siz devam eder. ~2 istek, önbellekli.
 */

const detail = (details: SportmonksFixture["lineups"][number]["details"], name: string): number | null => {
  const value = details.find((entry) => entry.type?.developer_name === name)?.data?.value;
  const parsed = typeof value === "number" ? value : Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : null;
};

/** Saf: Sportmonks maçı → diziliş oyuncuları (süre alanlar). */
export function sportmonksLineupPlayers(fixture: SportmonksFixture): SportmonksLineupPlayer[] {
  return fixture.lineups.flatMap((entry) =>
    entry.player_name
      ? [{ teamId: entry.team_id, name: entry.player_name, jersey: entry.jersey_number ?? null, minutes: detail(entry.details, "MINUTES_PLAYED"), xg: detail(entry.details, "EXPECTED_GOALS") }]
      : [],
  );
}

export async function getSportmonksPlayerLineups(fixture: SportmonksFixtureQuery): Promise<{ players: SportmonksLineupPlayer[]; ids: { home: number; away: number } } | null> {
  if (!isSportmonksConfigured()) return null;
  const found = await findSportmonksFixture(fixture, "participants;lineups.details.type");
  return found ? { players: sportmonksLineupPlayers(found.match), ids: { home: found.home, away: found.away } } : null;
}
