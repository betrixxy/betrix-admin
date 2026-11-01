import { addDays, istanbulDay, istanbulWeekday } from "@/lib/metrics/istanbul-time";
import { competitionShortName } from "@/lib/names/competition-names";

/** Reels Stüdyo seçim kuralları: görünüm aralığı, varsayılan ligler, proje durumu. Saf fonksiyonlar. */

/** Varsayılan ligler. Değiştirmek için tek yer burası. Ad: tek kaynaktan, tabloda yoksa buradaki yedek. */
const DEFAULT_LEAGUES: ReadonlyArray<{ id: number; fallback: string }> = [
  { id: 203, fallback: "Süper Lig" },
  { id: 39, fallback: "Premier Lig" },
  { id: 140, fallback: "LaLiga" },
  { id: 135, fallback: "Serie A" },
  { id: 78, fallback: "Bundesliga" },
  { id: 61, fallback: "Ligue 1" },
  { id: 2, fallback: "Şampiyonlar Ligi" },
  { id: 3, fallback: "Avrupa Ligi" },
  { id: 848, fallback: "Konferans Ligi" },
  { id: 88, fallback: "Eredivisie" },
  { id: 94, fallback: "Primeira Liga" },
];

export const REELS_DEFAULT_LEAGUE_IDS: readonly number[] = DEFAULT_LEAGUES.map((league) => league.id);
export const REELS_LEAGUE_CHOICES = DEFAULT_LEAGUES.map(({ id, fallback }) => ({ id, label: competitionShortName(id, fallback) }));

export const REELS_MAX_DAYS_AHEAD = 10;
export const REELS_DAILY_SELECTION_LIMIT = 2;

export type ReelsWeekView = "this" | "next";

export interface DayRange {
  from: string;
  to: string;
}

/** Bu hafta: bugünden pazara. Gelecek hafta: pazartesiden pazara. İkisi de bugünden en fazla 10 gün ileri. */
export function reelsWeekRange(view: ReelsWeekView, now: Date): DayRange {
  const today = istanbulDay(now);
  const sunday = addDays(today, 7 - istanbulWeekday(now));
  const limit = addDays(today, REELS_MAX_DAYS_AHEAD);
  if (view === "this") return { from: today, to: sunday };
  const nextSunday = addDays(sunday, 7);
  return { from: addDays(sunday, 1), to: nextSunday < limit ? nextSunday : limit };
}

/** Başlamış maç seçilemez: yayın penceresi başlamadan 6 saat önce biter. */
export const isReelSelectable = (kickoffUtc: Date, now: Date): boolean => kickoffUtc > now;

/** URL'deki `leagues=203,39`: yalnız varsayılan listedekiler; geçerli seçim yoksa bütün varsayılanlar. */
export function parseReelsLeagues(value: string | undefined): readonly number[] {
  const chosen = (value ?? "").split(",").map(Number).filter((id) => REELS_DEFAULT_LEAGUE_IDS.includes(id));
  return chosen.length > 0 ? chosen : REELS_DEFAULT_LEAGUE_IDS;
}

/** Başlama gününe göre (İstanbul) sınırı aşan günler; engel değil, uyarı. */
export function overbookedDays(kickoffs: readonly Date[]): Array<{ day: string; count: number }> {
  const counts = new Map<string, number>();
  for (const kickoff of kickoffs) {
    const day = istanbulDay(kickoff);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > REELS_DAILY_SELECTION_LIMIT)
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export const REEL_STATUSES = ["SELECTED", "SNAPSHOT_READY", "SCRIPT_DRAFT", "APPROVED", "RENDERING", "READY", "FAILED", "PUBLISHED"] as const;
export type ReelStatus = (typeof REEL_STATUSES)[number];

export const REEL_STATUS_LABELS: Record<ReelStatus, string> = {
  SELECTED: "Seçildi",
  SNAPSHOT_READY: "Veri donduruldu",
  SCRIPT_DRAFT: "Senaryo taslağı",
  APPROVED: "Onaylandı",
  RENDERING: "Üretiliyor",
  READY: "Hazır",
  FAILED: "Başarısız",
  PUBLISHED: "Yayınlandı",
};

const FREEZABLE: readonly ReelStatus[] = ["SELECTED", "SNAPSHOT_READY", "SCRIPT_DRAFT"];

/** Onaydan sonra (APPROVED ve sonrası) yeni veri dondurulamaz. Veritabanı trigger'ı da aynı kuralı uygular. */
export const canFreezeReel = (status: ReelStatus): boolean => FREEZABLE.includes(status);
