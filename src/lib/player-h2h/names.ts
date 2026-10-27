import { originFromCountry, upperName } from "@/lib/dashboard/name-case";
import { SUPPORTED_LEAGUES } from "@/lib/services/api-football/leagues";

/**
 * Oyuncu ve lig adları — saf. Tam ad önceliği: arşivin resmi adı (admin düzeltmesi dahil) > API'nin
 * adı (baş harfli "D. Vlahović" ilk adla açılır). Kısa ad (olgu satırı, büyük ad) soyadıdır; "van",
 * "de" gibi ekler soyada dahil.
 */

const PARTICLES = new Set(["van", "von", "de", "da", "di", "del", "della", "dos", "das", "do", "du", "el", "al", "le", "la", "ter", "ten", "mac", "mc"]);

/** "D. Vlahović" + ilk ad "Dušan" → "Dušan Vlahović"; baş harf yoksa API adı olduğu gibi. */
export function fullNameFromApi(name: string, firstname: string | null | undefined): string {
  const initial = /^(\p{L})\.\s+(.+)$/u.exec(name.trim());
  const first = firstname?.trim().split(/\s+/)[0];
  if (initial && first && first.startsWith(initial[1] ?? "")) return `${first} ${initial[2]}`;
  return name.trim();
}

/** Soyadı (+ önündeki ekler): "Virgil van Dijk" → "van Dijk", "Mohamed Salah" → "Salah". */
export function shortNameOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  if (words.length <= 1) return fullName.trim();
  let start = words.length - 1;
  while (start > 1 && PARTICLES.has((words[start - 1] ?? "").toLocaleLowerCase("tr-TR"))) start -= 1;
  return words.slice(start).join(" ");
}

/** Büyük adın üstündeki küçük ilk ad (kısa ad dışında kalan). */
export function firstNameOf(fullName: string): string {
  const short = shortNameOf(fullName);
  return fullName.trim().slice(0, fullName.trim().length - short.length).trim();
}

/** Lig: kartta kısa adı (desteklenen liglerde "Süper Lig") ve büyük harfi (Türk ligi Türkçe, diğeri uluslararası). */
export function leagueDisplay(id: number, providerName: string, country: string | null): { id: number; name: string; label: string } {
  const name = SUPPORTED_LEAGUES.find((league) => league.apiFootballId === id)?.shortName ?? providerName;
  return { id, name, label: upperName(name, originFromCountry(country) ?? "intl") };
}

/** "2026" → "2026/27"; takvim yılı sezonunda (MLS, Brezilya…) "2026". */
export const seasonLabel = (season: number, calendarYear = false) => (calendarYear ? String(season) : `${season}/${String((season + 1) % 100).padStart(2, "0")}`);
