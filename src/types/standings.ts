import type { SupportedLeagueId } from "@/lib/services/api-football/leagues";
import type { SocialFormatId } from "@/types/studio-formats";

/**
 * "Puan Durumu" stüdyosu kanonik tipleri — bkz. app/dashboard/studio/standings,
 * lib/services/api-football/standings.ts ve templates/standings/standings-card.tsx.
 */

/** Tablodaki bölge (sıra çubuğunun rengi): üst sıralar (Avrupa/terfi), play-off, küme düşme. */
export type StandingZone = "top" | "playoff" | "relegation" | null;

export interface StandingRow {
  rank: number;
  teamId: number;
  teamName: string;
  /** API-Football logo adresi (media.api-sports.io). */
  logoUrl: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  zone: StandingZone;
}

/** Tek tablo (lig) ya da bir grup ("A" → "A GRUBU"). */
export interface StandingsGroup {
  /** API grup adı ("Group A", "Süper Lig") — seçim anahtarı. */
  key: string;
  /** Kartta bölüm başlığı: "A GRUBU"; tek tablolu ligde boş. */
  label: string;
  rows: StandingRow[];
}

export interface StandingsTable {
  season: number;
  leagueLogoUrl: string;
  groups: StandingsGroup[];
}

/** Form açılışı: ligin sezonları + seçilen sezonun tablosu. */
export interface StandingsLoadResult extends StandingsTable {
  /** Sağlayıcının sezonları, yeniden eskiye. */
  seasons: number[];
}

/** Grup seçicide "tüm gruplar" (her grup ayrı bölüm). */
export const ALL_GROUPS = "*";

/** Formun kaydedilen/çizilen hali — tablo sunucuda yeniden çekilir, form yalnızca seçimi taşır. */
export interface StandingsDraft {
  leagueId: SupportedLeagueId;
  season: number;
  /** Grup anahtarı ya da `ALL_GROUPS`; tek tablolu ligde tablonun anahtarı. */
  groupKey: string;
  /** Tek tabloda gösterilecek sıra aralığı (1 tabanlı, dahil) — uzun tablo iki karta bölünebilir. */
  rankFrom: number;
  rankTo: number;
  /** Büyük başlık, ör. "PUAN DURUMU". */
  title: string;
  format: SocialFormatId;
}

/** Kart çizimi için hazır veri: seçilen bölümler (tek tablo ya da gruplar), aralık uygulanmış. */
export interface StandingsCardInput {
  leagueId: SupportedLeagueId;
  leagueName: string;
  leagueLogoUrl: string;
  season: number;
  title: string;
  /** Başlığın altındaki etiket: "8. HAFTA SONU" / "GRUP AŞAMASI". */
  kindLabel: string;
  sections: StandingsGroup[];
  format: SocialFormatId;
}
