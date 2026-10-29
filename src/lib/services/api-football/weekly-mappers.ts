import { clock } from "@/lib/format/dates";
import { cardTeamName } from "@/lib/archive/names";
import { toFixtureId } from "@/lib/services/api-football/mappers";
import type { ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import type { WeeklyMatch, WeeklyMatchStatus, WeeklyRoundOption } from "@/types/weekly-fixtures";

/**
 * "Haftanın Maçları" — API-Football tur etiketleri ve fikstürleri → kanonik tipler (saf, side-effect yok).
 * Tüm saatler Europe/Istanbul'a çevrilir.
 */

const ISTANBUL_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });

/** Eski kupa formatı: her grubun turu ayrı ("Group A - 3"); aynı maç günü tek seçenekte birleşir. */
const GROUP_ROUND = /^Group ([A-Z]) - (\d+)$/;
const GROUP_STAGE_KEY = "group-stage-";

const STATUS_BY_SHORT: Record<string, WeeklyMatchStatus> = {
  TBD: "scheduled",
  NS: "scheduled",
  "1H": "live",
  HT: "live",
  "2H": "live",
  ET: "live",
  BT: "live",
  P: "live",
  SUSP: "live",
  INT: "live",
  LIVE: "live",
  FT: "finished",
  AET: "finished",
  PEN: "finished",
  AWD: "finished",
  WO: "finished",
  PST: "postponed",
  CANC: "cancelled",
  ABD: "abandoned",
};

const KNOCKOUT_LABELS: Record<string, string> = {
  "Preliminary Round": "Ön Eleme",
  "1st Qualifying Round": "1. Ön Eleme Turu",
  "2nd Qualifying Round": "2. Ön Eleme Turu",
  "3rd Qualifying Round": "3. Ön Eleme Turu",
  "Play-offs": "Play-off Turu",
  "Knockout Round Play-offs": "Play-off Turu",
  "Round of 32": "Son 32 Turu",
  "Round of 16": "Son 16 Turu",
  "8th Finals": "Son 16 Turu",
  "Quarter-finals": "Çeyrek Final",
  "Semi-finals": "Yarı Final",
  "3rd Place Final": "Üçüncülük Maçı",
  Final: "Final",
};

export function matchStatus(short: string): WeeklyMatchStatus {
  return STATUS_BY_SHORT[short] ?? "scheduled";
}

/** Tek bir API turunun Türkçe etiketi; tanınmayan tur olduğu gibi kalır. */
export function roundLabel(round: string): string {
  const regular = /^Regular Season - (\d+)$/.exec(round);
  if (regular) return `${regular[1]}. Hafta`;
  const leagueStage = /^League Stage - (\d+)$/.exec(round);
  if (leagueStage) return `Lig Aşaması · ${leagueStage[1]}. Maç Günü`;
  const groupStage = /^Group Stage - (\d+)$/.exec(round) ?? GROUP_ROUND.exec(round)?.slice(1);
  if (groupStage) return `Grup Aşaması · ${groupStage.at(-1)}. Maç Günü`;
  return KNOCKOUT_LABELS[round] ?? round;
}

/** Tur listesi → form seçenekleri (sağlayıcının sırası korunur; grup turları maç gününde birleşir). */
export function roundOptions(rounds: string[]): WeeklyRoundOption[] {
  const options: WeeklyRoundOption[] = [];
  const byKey = new Map<string, WeeklyRoundOption>();
  for (const round of rounds) {
    const group = GROUP_ROUND.exec(round);
    const key = group ? `${GROUP_STAGE_KEY}${group[2]}` : round;
    const existing = byKey.get(key);
    if (existing) {
      existing.rounds.push(round);
      continue;
    }
    const option = { key, label: roundLabel(round), rounds: [round] };
    byKey.set(key, option);
    options.push(option);
  }
  // Grup maç günleri sağlayıcıda karışık sırayla gelir ("Group F - 1", "Group A - 1"…) — harf sırasına dizilir.
  for (const option of options) option.rounds.sort();
  return options;
}

/** Bir API turunun ait olduğu seçenek anahtarı ("Group C - 2" → "group-stage-2"). */
export function roundKeyOf(round: string): string {
  const group = GROUP_ROUND.exec(round);
  return group ? `${GROUP_STAGE_KEY}${group[2]}` : round;
}

/** Grup harfi: önce tur etiketinden ("Group A - 3"), yoksa puan durumundan (takım → grup). */
function groupOf(raw: ApiFootballFixtureRaw, standingsGroups: ReadonlyMap<number, string>): string | null {
  const fromRound = GROUP_ROUND.exec(raw.league.round)?.[1];
  if (fromRound) return fromRound;
  const home = standingsGroups.get(raw.teams.home.id);
  return home && home === standingsGroups.get(raw.teams.away.id) ? home : null;
}

export function toWeeklyMatch(raw: ApiFootballFixtureRaw, standingsGroups: ReadonlyMap<number, string> = new Map()): WeeklyMatch {
  const kickoff = new Date(raw.fixture.date);
  const timeKnown = raw.fixture.status.short !== "TBD";
  return {
    id: toFixtureId(raw.fixture.id),
    kickoffUtc: kickoff.toISOString(),
    dateKey: ISTANBUL_DATE.format(kickoff),
    time: timeKnown ? clock(kickoff) : "",
    status: matchStatus(raw.fixture.status.short),
    elapsed: raw.fixture.status.elapsed,
    home: { name: cardTeamName(raw.teams.home.name), logoUrl: raw.teams.home.logo, goals: raw.goals.home },
    away: { name: cardTeamName(raw.teams.away.name), logoUrl: raw.teams.away.logo, goals: raw.goals.away },
    group: groupOf(raw, standingsGroups),
  };
}

/** Puan durumu grup adı → harf ("Group A" → "A"); tek tablolu (lig aşaması) yarışmada boş harita. */
export function standingsGroupMap(groups: { group: string; teamId: number }[]): Map<number, string> {
  const letters = new Set(groups.map((entry) => /^Group ([A-Z])$/.exec(entry.group)?.[1]).filter(Boolean));
  if (letters.size < 2) return new Map();
  const map = new Map<number, string>();
  for (const entry of groups) {
    const letter = /^Group ([A-Z])$/.exec(entry.group)?.[1];
    if (letter) map.set(entry.teamId, letter);
  }
  return map;
}
