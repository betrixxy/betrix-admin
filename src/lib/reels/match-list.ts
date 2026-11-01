import { addDays, istanbulDay } from "@/lib/metrics/istanbul-time";
import { competitionShortName } from "@/lib/names/competition-names";
import { foldName } from "@/lib/names/person-name";
import { formatIstanbulDayHeading, formatIstanbulTime, publishDeadline, publishWindow, type PublishWindowPhase } from "@/lib/reels/publish-window";
import type { ReelsMatchListItem } from "@/lib/services/reels-schema";

/**
 * Maç listesinin görünüm modeli: İstanbul gününe göre gruplar. Etiketler sunucuda hesaplanır, istemciye hazır gider
 * (saat dilimi ve "şimdi" tarayıcıya göre değişmesin). Saf fonksiyonlar.
 */

export interface ReelListTeam {
  name: string;
  logoUrl: string | null;
}

export interface ReelListRow {
  matchId: number;
  time: string;
  league: string;
  home: ReelListTeam;
  away: ReelListTeam;
  analysisAvailable: boolean;
  deadline: string;
  phase: PublishWindowPhase;
  phaseLabel: string;
  selected: boolean;
  /** Aksan duyarsız arama anahtarı. */
  searchKey: string;
}

export interface ReelListDay {
  key: string;
  heading: string;
  /** Varsayılan: yalnız bugün ve yarın açık. */
  defaultOpen: boolean;
  rows: ReelListRow[];
}

/** Liste maç saatine göre sıralı gelir; gün sırası korunur. */
export function buildReelListDays(matches: readonly ReelsMatchListItem[], selectedIds: ReadonlySet<number>, now: Date): ReelListDay[] {
  const today = istanbulDay(now);
  const openDays = new Set([today, addDays(today, 1)]);
  const days = new Map<string, ReelListDay>();
  for (const match of matches) {
    const kickoff = new Date(match.kickoff_utc);
    const key = istanbulDay(kickoff);
    const day = days.get(key) ?? { key, heading: formatIstanbulDayHeading(kickoff), defaultOpen: openDays.has(key), rows: [] };
    const deadline = publishDeadline(publishWindow(kickoff), now);
    day.rows.push({
      matchId: match.match_id,
      time: formatIstanbulTime(kickoff),
      league: competitionShortName(match.league.id, match.league.name),
      home: { name: match.home.name, logoUrl: match.home.logo_url },
      away: { name: match.away.name, logoUrl: match.away.logo_url },
      analysisAvailable: match.analysis.available,
      deadline: deadline.label,
      phase: deadline.phase,
      phaseLabel: deadline.phaseLabel,
      selected: selectedIds.has(match.match_id),
      searchKey: `${foldName(match.home.name)} ${foldName(match.away.name)}`,
    });
    days.set(key, day);
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Takım adına göre süzer: "gencler" → "Gençlerbirliği". Eşleşmeyen gün düşer. Boş arama listeyi değiştirmez. */
export function filterReelDays(days: readonly ReelListDay[], query: string): ReelListDay[] {
  const needle = foldName(query);
  if (!needle) return [...days];
  return days
    .map((day) => ({ ...day, rows: day.rows.filter((row) => row.searchKey.includes(needle)) }))
    .filter((day) => day.rows.length > 0);
}
