/**
 * Lig / turnuva KART adı — TEK KAYNAK (kurucu kararı 2026-10-30: Türkçe yayıncı adı). Anahtar API-Football
 * league id. `name` künye/başlık adı ("Trendyol Süper Lig", "Premier Lig"); `short` dar yerler (H2H künyesi,
 * Kura çok turnuvalı alt satırı). Büyük harf ayrıca köken kuralıyla (`name-case.ts::upperCompetition`).
 * Bütün kartlar, Desteklenen Ligler listesi (`api-football/leagues.ts`) ve arşiv klasörleri buradan okur;
 * bekçi test `tests/unit/competition-names.test.ts`. Sponsor adı değişirse yalnızca bu tablo güncellenir.
 */

export interface CompetitionNames {
  name: string;
  short: string;
}

export const COMPETITION_NAMES: Readonly<Record<number, CompetitionNames>> = {
  203: { name: "Trendyol Süper Lig", short: "Süper Lig" },
  204: { name: "Trendyol 1. Lig", short: "1. Lig" },
  206: { name: "Ziraat Türkiye Kupası", short: "Türkiye Kupası" },
  2: { name: "UEFA Şampiyonlar Ligi", short: "Şampiyonlar Ligi" },
  3: { name: "UEFA Avrupa Ligi", short: "Avrupa Ligi" },
  848: { name: "UEFA Konferans Ligi", short: "Konferans Ligi" },
  39: { name: "Premier Lig", short: "Premier Lig" },
  140: { name: "LaLiga", short: "LaLiga" },
  135: { name: "Serie A", short: "Serie A" },
  78: { name: "Bundesliga", short: "Bundesliga" },
  61: { name: "Ligue 1", short: "Ligue 1" },
};

/** Kart adı: tablo, yoksa sağlayıcının adı. */
export const competitionCardName = (leagueId: number, providerName: string): string => COMPETITION_NAMES[leagueId]?.name ?? providerName;

/** Kısa kart adı: tablo, yoksa sağlayıcının adı. */
export const competitionShortName = (leagueId: number, providerName: string): string => COMPETITION_NAMES[leagueId]?.short ?? providerName;
