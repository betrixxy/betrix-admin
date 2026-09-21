import type { ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import type { Fixture, FixtureStatus, TeamRef } from "@/types/sports";

/**
 * API-Football forma/marka rengi döndürmüyor (yalnızca logo URL'i verir). Gerçek
 * `primaryColorHex` değeri Supabase `teams` tablosundan zenginleştirilene kadar (bkz.
 * CLAUDE.md 3.2.2) nötr bir varsayılan kullanılır.
 */
export const FALLBACK_TEAM_COLOR_HEX = "#6B7280";

const STATUS_MAP: Record<string, FixtureStatus> = {
  TBD: "SCHEDULED",
  NS: "SCHEDULED",
  "1H": "LIVE",
  "2H": "LIVE",
  ET: "LIVE",
  P: "LIVE",
  LIVE: "LIVE",
  HT: "HT",
  FT: "FT",
  AET: "FT",
  PEN: "FT",
  PST: "POSTPONED",
  CANC: "CANCELLED",
  ABD: "CANCELLED",
  AWD: "FT",
  WO: "FT",
};

function mapStatus(shortCode: string): FixtureStatus {
  return STATUS_MAP[shortCode] ?? "SCHEDULED";
}

function mapTeam(raw: { id: number; name: string; logo: string }): TeamRef {
  return {
    id: String(raw.id),
    name: raw.name,
    shortName: raw.name,
    primaryColorHex: FALLBACK_TEAM_COLOR_HEX,
    logoUrl: raw.logo,
  };
}

/**
 * Ham API-Football fikstürünü kanonik `Fixture`'a çevirir. Saf fonksiyon, side-effect
 * içermez (bkz. CLAUDE.md 1.4).
 *
 * `id`: gerçek içsel UUID, fikstür Supabase'e yazıldığında oradan gelecek (bkz. 1.6);
 * o entegrasyon bağlanana kadar sağlayıcı ID'sinden türetilen deterministik bir
 * placeholder kullanılır ki fonksiyon saf kalsın (aynı girdi → aynı çıktı).
 */
export function mapApiFootballFixtureToFixture(raw: ApiFootballFixtureRaw): Fixture {
  return {
    id: `api-football-${raw.fixture.id}`,
    providerIds: { apiFootball: raw.fixture.id },
    kickoffUtc: new Date(raw.fixture.date).toISOString(),
    status: mapStatus(raw.fixture.status.short),
    homeTeam: mapTeam(raw.teams.home),
    awayTeam: mapTeam(raw.teams.away),
    competition: {
      id: String(raw.league.id),
      name: raw.league.name,
      shortName: raw.league.name,
    },
    // Derbi tansiyonu sınıflandırması ayrı bir adımdır (bkz. CLAUDE.md 3.2.3); burada
    // yalnızca alan boş kalmasın diye nötr varsayılan atanır.
    derbyIntensity: "NONE",
  };
}
