import { nameOrigin, originFromCountry, upperName, type NameOrigin } from "@/lib/dashboard/name-case";
import { nameFor } from "@/lib/names/card-name-forms";
import { hasInitial, shortNameOf } from "@/lib/names/person-name";
import { SUPPORTED_LEAGUES } from "@/lib/services/api-football/leagues";
import type { CardPersonName } from "@/types/person-name";

/**
 * Lig adları, sağlayıcı kaydı eşleme adı ve posterin ad alanları — saf. Kişi KART adı kuralı burada değil:
 * `lib/names/person-name.ts` (resmi tam ad kartta yazılmaz); bu dosya yalnızca onu poster biçimine bağlar.
 */

/**
 * Poster ad alanları (`player-h2h-data.ts` ve görsel test aynı yoldan): elle verilen ad (offline araç) düzeltme
 * gibi kazanır; yoksa kart adı uzun biçimde (`PLAYER_H2H_POSTER`); o da yoksa API adı.
 */
export function h2hPosterName(card: CardPersonName | null, given: string | null | undefined, api: { name: string; nationality: string | null }): { fullName: string; shortName: string; nameReliable: boolean; nameOrigin: NameOrigin | null } {
  const manual = given?.trim();
  const fullName = manual || (card ? nameFor("PLAYER_H2H_POSTER", card) : null) || api.name;
  return {
    fullName,
    shortName: shortNameOf(fullName),
    nameReliable: manual ? !hasInitial(manual) : (card?.reliable ?? false),
    nameOrigin: card?.origin ?? nameOrigin(fullName) ?? originFromCountry(api.nationality),
  };
}

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
