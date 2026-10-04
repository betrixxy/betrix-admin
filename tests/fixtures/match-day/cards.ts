import { readFileSync } from "node:fs";
import path from "node:path";
import type { MatchDayCard, MatchDayStats } from "@/types/match-day";

/**
 * Maç Günü görsel regresyon testinin kart senaryoları (kurgusal veri — bkz. CLAUDE.md 5.2).
 * Logolar ağdan değil `public/brand/`'dan gömülür: test çevrimdışı ve deterministik çalışır.
 */

function embed(file: string): string {
  const bytes = readFileSync(path.join(process.cwd(), "public", "brand", file));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

const BRAND = embed("checkmatch-logo-net.png");
const MARK = embed("checkmatch-mark.png");

const STATS: MatchDayStats = {
  homeForm: ["W", "D", "L", "W", "W"],
  awayForm: ["L", "L", "D", "W", "D"],
  homeGoalsForAvg: 1.8,
  awayGoalsForAvg: null,
  homeGoalsAgainstAvg: 1,
  awayGoalsAgainstAvg: 1.2,
  h2h: { played: 5, homeWins: 2, draws: 1, awayWins: 2 },
};

const BASE: MatchDayCard = {
  homeTeam: "GALATASARAY",
  awayTeam: "FENERBAHÇE",
  homeTeamName: "Galatasaray",
  awayTeamName: "Fenerbahçe",
  leagueLabel: "SÜPER LİG",
  weekLabel: "8. HAFTA",
  dateLabel: "5 EKİM",
  weekdayLabel: "Pazar",
  timeLabel: "20:00",
  stadiumLabel: "RAMS Park",
  refereeLabel: "Ali Şansalan",
  homePlayerImg: null,
  awayPlayerImg: null,
  homeLogo: MARK,
  awayLogo: null,
  brandLogo: BRAND,
  leagueLogo: MARK,
  homeColorHex: "#A90432",
  awayColorHex: "#163962",
  stats: null,
};

/** normal: tam veri · nostats_nologos: istatistik/logo/hafta yok · long_empty: uzun adlar, künye ve form boş. */
export const MATCH_DAY_SCENARIOS: Record<string, MatchDayCard> = {
  normal: { ...BASE, stats: STATS },
  nostats_nologos: { ...BASE, homeLogo: null, leagueLogo: null, weekLabel: null, weekdayLabel: null },
  long_empty: {
    ...BASE,
    homeTeam: "BORUSSIA MÖNCHENGLADBACH",
    awayTeam: "WOLVERHAMPTON WANDERERS",
    homeTeamName: "Borussia Mönchengladbach",
    awayTeamName: "Wolverhampton Wanderers",
    leagueLabel: "UEFA AVRUPA KONFERANS LİGİ ELEME TURU",
    dateLabel: "—",
    timeLabel: "—",
    stadiumLabel: "—",
    refereeLabel: "—",
    stats: { ...STATS, homeForm: [], awayForm: [], h2h: { played: 0, homeWins: 0, draws: 0, awayWins: 0 } },
  },
};
