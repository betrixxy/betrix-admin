import type { SupportedLeagueId } from "@/lib/services/api-football/leagues";
import type { SocialFormatId } from "@/types/studio-formats";

/**
 * "Haftanın Maçları" stüdyosu kanonik tipleri — bkz. app/dashboard/studio/weekly-fixtures,
 * lib/services/api-football/weekly-fixtures.ts ve templates/weekly-fixtures/weekly-fixtures.tsx.
 */

/** Kartta gösterilecek durum: oynanmamış → saat, oynanan/bitmiş → skor, diğerleri kısa etiket. */
export const WEEKLY_MATCH_STATUSES = ["scheduled", "live", "finished", "postponed", "cancelled", "abandoned"] as const;
export type WeeklyMatchStatus = (typeof WEEKLY_MATCH_STATUSES)[number];

export interface WeeklyTeam {
  name: string;
  /** API-Football logo adresi (media.api-sports.io). */
  logoUrl: string;
  /** Oynanmamış maçta null. */
  goals: number | null;
}

export interface WeeklyMatch {
  /** `api-football-<id>` (bkz. toFixtureId). */
  id: string;
  kickoffUtc: string;
  /** yyyy-MM-dd, Europe/Istanbul. */
  dateKey: string;
  /** "21.30" — Europe/Istanbul; saat henüz belli değilse (TBD) boş. */
  time: string;
  status: WeeklyMatchStatus;
  /** Canlı maçta oynanan dakika. */
  elapsed: number | null;
  home: WeeklyTeam;
  away: WeeklyTeam;
  /** Kupa grup aşamasında grup harfi ("A"); lig/eleme maçlarında null. */
  group: string | null;
}

/**
 * Formdaki tur seçeneği. Grup aşamalı eski kupa formatında her grubun turu ayrı bir API turudur
 * ("Group A - 3", "Group B - 3"…) — aynı maç günü tek seçenekte birleşir (`rounds` birden çok).
 */
export interface WeeklyRoundOption {
  key: string;
  /** "7. Hafta", "Lig Aşaması · 2. Maç Günü", "Grup Aşaması · 3. Maç Günü", "Çeyrek Final"… */
  label: string;
  rounds: string[];
}

export interface WeeklyRoundsResult {
  season: number;
  /** Sağlayıcının sezonları, yeniden eskiye (form seçimi için). */
  seasons: number[];
  options: WeeklyRoundOption[];
  /** API'nin "güncel tur"u — form açılışta bunu seçer; bilinmiyorsa null. */
  currentKey: string | null;
}

export interface WeeklyRoundMatches {
  leagueLogoUrl: string;
  matches: WeeklyMatch[];
}

/** Kartın bölümlenmesi: grup aşamasında gruplara, diğer turlarda günlere göre. */
export type WeeklyGrouping = "date" | "group";

/** Formun kaydedilen/çizilen hali — maç verisi sunucuda yeniden çekilir, form yalnızca seçim ve sırayı taşır. */
export interface WeeklyFixturesDraft {
  leagueId: SupportedLeagueId;
  season: number;
  roundKey: string;
  /** Kartın büyük başlığı, ör. "7. HAFTA" / "LİG AŞAMASI · 2. MAÇ GÜNÜ" — admin değiştirebilir. */
  title: string;
  /** Kartta gösterilecek maçlar, admin'in sırasıyla (çıkarılanlar listede yok). */
  matchIds: string[];
  /** Platform/format (küresel kayıt, bkz. types/studio-formats.ts). */
  format: SocialFormatId;
}

/** Bir kartın taşıyabileceği en fazla maç — fazlası için ikinci kart üretilir. */
export const WEEKLY_MAX_MATCHES = 12;

/** Kart çizimi için hazır veri (sunucuda maçlar yeniden çekilip seçime göre süzülmüş). */
export interface WeeklyFixturesCardInput {
  leagueId: SupportedLeagueId;
  leagueName: string;
  leagueLogoUrl: string;
  title: string;
  grouping: WeeklyGrouping;
  matches: WeeklyMatch[];
  format: SocialFormatId;
}
