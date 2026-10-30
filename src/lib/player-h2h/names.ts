import { originFromCountry, upperName } from "@/lib/dashboard/name-case";
import { SUPPORTED_LEAGUES } from "@/lib/services/api-football/leagues";

/**
 * Lig adları ve sağlayıcı kaydı eşleme adı — saf. Kişi KART adı burada değil: `lib/names/person-name.ts`
 * (resmi tam ad kartta yazılmaz; kısa ad / poster adı da oradan).
 */

/**
 * YALNIZCA veri eşlemesi (Sportmonks sezon kaydı araması): "D. Vlahović" + API ilk adı "Dušan" → "Dušan
 * Vlahović"; baş harf yoksa API adı olduğu gibi. Kartta kullanılmaz.
 */
export function fullNameFromApi(name: string, firstname: string | null | undefined): string {
  const initial = /^(\p{L})\.\s+(.+)$/u.exec(name.trim());
  const first = firstname?.trim().split(/\s+/)[0];
  if (initial && first && first.startsWith(initial[1] ?? "")) return `${first} ${initial[2]}`;
  return name.trim();
}

/** Lig: kartta kısa adı (desteklenen liglerde "Süper Lig") ve büyük harfi (Türk ligi Türkçe, diğeri uluslararası). */
export function leagueDisplay(id: number, providerName: string, country: string | null): { id: number; name: string; label: string } {
  const name = SUPPORTED_LEAGUES.find((league) => league.apiFootballId === id)?.shortName ?? providerName;
  return { id, name, label: upperName(name, originFromCountry(country) ?? "intl") };
}

/** "2026" → "2026/27"; takvim yılı sezonunda (MLS, Brezilya…) "2026". */
export const seasonLabel = (season: number, calendarYear = false) => (calendarYear ? String(season) : `${season}/${String((season + 1) % 100).padStart(2, "0")}`);
