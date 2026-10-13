/**
 * Medya havuzunun kapsadığı 44 öncelikli lig (API-Football `league.id`).
 * Stüdyo'nun fikstür filtresi (`api-football/leagues.ts::SUPPORTED_LEAGUES`) bundan bağımsızdır.
 * Script her ligin API'deki gerçek adını loglar — yanlış bir kimlik orada hemen görünür.
 */
export interface MediaLeague {
  apiFootballId: number;
  label: string;
}

export const MEDIA_SERVER_LEAGUES: readonly MediaLeague[] = [
  // UEFA kulüp turnuvaları
  { apiFootballId: 2, label: "UEFA Şampiyonlar Ligi" },
  { apiFootballId: 3, label: "UEFA Avrupa Ligi" },
  { apiFootballId: 848, label: "UEFA Konferans Ligi" },
  // İngiltere
  { apiFootballId: 39, label: "Premier League" },
  { apiFootballId: 40, label: "Championship" },
  { apiFootballId: 41, label: "League One" },
  { apiFootballId: 42, label: "League Two" },
  // İspanya
  { apiFootballId: 140, label: "La Liga" },
  { apiFootballId: 141, label: "Segunda División" },
  // İtalya
  { apiFootballId: 135, label: "Serie A" },
  { apiFootballId: 136, label: "Serie B" },
  // Almanya
  { apiFootballId: 78, label: "Bundesliga" },
  { apiFootballId: 79, label: "2. Bundesliga" },
  { apiFootballId: 80, label: "3. Liga" },
  // Fransa
  { apiFootballId: 61, label: "Ligue 1" },
  { apiFootballId: 62, label: "Ligue 2" },
  // Türkiye
  { apiFootballId: 203, label: "Süper Lig" },
  { apiFootballId: 204, label: "1. Lig" },
  // Hollanda / Portekiz / Belçika / İskoçya
  { apiFootballId: 88, label: "Eredivisie" },
  { apiFootballId: 89, label: "Eerste Divisie" },
  { apiFootballId: 94, label: "Primeira Liga" },
  { apiFootballId: 95, label: "Liga Portugal 2" },
  { apiFootballId: 144, label: "Jupiler Pro League" },
  { apiFootballId: 179, label: "Scottish Premiership" },
  { apiFootballId: 180, label: "Scottish Championship" },
  // Avrupa'nın geri kalanı
  { apiFootballId: 218, label: "Avusturya Bundesliga" },
  { apiFootballId: 207, label: "İsviçre Super League" },
  { apiFootballId: 197, label: "Yunanistan Super League 1" },
  { apiFootballId: 119, label: "Danimarka Superliga" },
  { apiFootballId: 103, label: "Norveç Eliteserien" },
  { apiFootballId: 113, label: "İsveç Allsvenskan" },
  { apiFootballId: 106, label: "Polonya Ekstraklasa" },
  { apiFootballId: 345, label: "Çekya Czech Liga" },
  { apiFootballId: 210, label: "Hırvatistan HNL" },
  { apiFootballId: 286, label: "Sırbistan Super Liga" },
  { apiFootballId: 333, label: "Ukrayna Premier Liga" },
  { apiFootballId: 235, label: "Rusya Premier Liga" },
  { apiFootballId: 283, label: "Romanya Liga I" },
  // Avrupa dışı
  { apiFootballId: 307, label: "Suudi Pro Lig" },
  { apiFootballId: 253, label: "MLS" },
  { apiFootballId: 71, label: "Brezilya Série A" },
  { apiFootballId: 128, label: "Arjantin Liga Profesional" },
  { apiFootballId: 262, label: "Meksika Liga MX" },
  { apiFootballId: 98, label: "Japonya J1 League" },
];
