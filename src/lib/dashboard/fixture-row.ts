import { isPastDay } from "@/lib/dashboard/match-center-window";
import { matchRowState, type MatchRowState } from "@/lib/dashboard/match-row-state";
import { addDays, istanbulDay } from "@/lib/metrics/istanbul-time";
import type { Fixture } from "@/types/sports";

/**
 * Maç satırı — Maç Merkezi ve İçerik Planı aynı satırı çizer (`components/features/dashboard/
 * fixture-row.tsx`). Saf; istemci bileşenleri de içe aktarır. Satır sağlayıcıdan (Maç Merkezi)
 * ya da yıldızlama anındaki anlık görüntüden (İçerik Planı) beslenir — ikisi de bu şekle çevrilir.
 */
export interface FixtureRowData {
  id: string;
  /** ISO 8601, UTC */
  kickoffUtc: string;
  homeName: string;
  homeLogo: string;
  awayName: string;
  awayLogo: string;
  leagueName: string;
  state: MatchRowState;
}

/** Sabit sütun şablonu: saat/skor+lig · ev (sağa yaslı) · vs · deplasman · durum/sayaç · işlem. */
export const FIXTURE_ROW_COLUMNS = "md:grid-cols-[7.5rem_minmax(0,1fr)_2rem_minmax(0,1fr)_8.5rem_var(--fixture-row-actions)]";

export function fixtureToRow(fixture: Fixture): FixtureRowData {
  return {
    id: fixture.id,
    kickoffUtc: fixture.kickoffUtc,
    homeName: fixture.homeTeam.name,
    homeLogo: fixture.homeTeam.logoUrl,
    awayName: fixture.awayTeam.name,
    awayLogo: fixture.awayTeam.logoUrl,
    leagueName: fixture.competition.shortName,
    state: matchRowState(fixture),
  };
}

/** İçerik Planı'nın yıldız anlık görüntüsü (`WatchedFixture`) — `fresh` varsa durum/skor ondan. */
export interface WatchedSnapshot {
  fixtureId: string;
  kickoffUtc: Date;
  homeName: string;
  homeLogo: string;
  awayName: string;
  awayLogo: string;
  leagueName: string;
}

export function watchedToRow(watched: WatchedSnapshot, fresh: Fixture | undefined, now: Date): FixtureRowData {
  if (fresh) return fixtureToRow(fresh);
  // Tazelenmeyen (pencere dışı) maç: geçmişse durum bilinmez sayılmaz — başlamamış gösterilir
  // yalnızca başlama saati gelecekteyse; aksi halde kesinleşmemiş skor uydurulmaz.
  const upcoming = watched.kickoffUtc.getTime() > now.getTime();
  return {
    id: watched.fixtureId,
    kickoffUtc: watched.kickoffUtc.toISOString(),
    homeName: watched.homeName,
    homeLogo: watched.homeLogo,
    awayName: watched.awayName,
    awayLogo: watched.awayLogo,
    leagueName: watched.leagueName,
    state: upcoming ? { kind: "upcoming", phase: "pre_match" } : { kind: "inactive", phase: null, label: "Durum alınamadı" },
  };
}

const MINUTE = 60 * 1000;
const COUNTDOWN_WINDOW = 24 * 60 * MINUTE;

/** Başlamaya 24 saatten az kalan maç: "2 sa 15 dk", "45 dk", "1 dk'dan az"; aksi halde null (alan boş). */
export function formatCountdown(msUntilKickoff: number): string | null {
  if (msUntilKickoff <= 0 || msUntilKickoff > COUNTDOWN_WINDOW) return null;
  const minutes = Math.floor(msUntilKickoff / MINUTE);
  if (minutes < 1) return "1 dk'dan az";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} dk`;
  return rest === 0 ? `${hours} sa` : `${hours} sa ${rest} dk`;
}

const dayFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", weekday: "long", day: "numeric", month: "long" });

export interface FixtureDayGroup<T extends { kickoffUtc: string }> {
  /** İstanbul günü, `yyyy-MM-dd`. */
  key: string;
  title: string;
  rows: T[];
}

/**
 * Satırları İstanbul gününe göre ayırır (girdi başlama saatine göre sıralı olmalı). Geçmiş gün
 * başlığı: "Dün · 15 Ekim Perşembe — Biten maçlar".
 */
export function groupRowsByDay<T extends { kickoffUtc: string }>(rows: T[], now: Date): FixtureDayGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = istanbulDay(new Date(row.kickoffUtc));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const yesterday = addDays(istanbulDay(now), -1);
  return [...groups.entries()].map(([key, dayRows]) => {
    const label = dayFormatter.format(new Date(dayRows[0]?.kickoffUtc ?? `${key}T12:00:00+03:00`));
    const title = isPastDay(key, now) ? `${key === yesterday ? "Dün · " : ""}${label} — Biten maçlar` : label;
    return { key, title, rows: dayRows };
  });
}
