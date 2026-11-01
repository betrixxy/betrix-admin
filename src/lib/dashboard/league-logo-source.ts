/**
 * Lig logosu kuralı (son kart düzeltmeleri, 2026-11-01) — saf. Haftanın Maçları, Puan Durumu ve Maç Günü'nde kaynak
 * önceliği: Medya Kütüphanesi'nde o lig için admin'in yüklediği logo → API-Football logosu → logo yok (kartta
 * yalnızca tipografik lig adı). Diğer kartlar (Maç Sonucu seti vb.) logosuz kalır.
 */

/** Admin yüklemesinde en az kısa kenar — "yüksek çözünürlüklü" (kartta 200 px'e kadar çizilir). */
export const LEAGUE_LOGO_MIN_SIDE = 400;

export const apiLeagueLogoUrl = (leagueId: number): string => `https://media.api-sports.io/football/leagues/${leagueId}.png`;

/** `media.api-sports.io/football/leagues/203.png` → 203; başka adres null. */
export function leagueIdFromLogoUrl(url: string | null | undefined): number | null {
  const match = url?.match(/^https:\/\/media\.api-sports\.io\/football\/leagues\/(\d+)\.png$/u);
  return match?.[1] ? Number(match[1]) : null;
}

/** Kaynak önceliği: admin logosu → API-Football → "" (tipografik). */
export function chooseLeagueLogo(adminFileUrl: string | null | undefined, apiUrl: string | null | undefined): string {
  return adminFileUrl || apiUrl || "";
}
