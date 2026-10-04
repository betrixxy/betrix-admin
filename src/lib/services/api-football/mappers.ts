import { SUPPORTED_LEAGUES } from "@/lib/services/api-football/leagues";
import type { ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import type { CompetitionRef, Fixture, FixtureStatus, TeamRef } from "@/types/sports";

/**
 * API-Football forma/marka rengi döndürmüyor (yalnızca logo URL'i verir). Gerçek
 * `primaryColorHex` değeri bir `teams` tablosundan zenginleştirilene kadar (bkz.
 * CLAUDE.md 3.2.2) nötr bir varsayılan kullanılır.
 */
export const FALLBACK_TEAM_COLOR_HEX = "#6B7280";

/** Kanonik fikstür kimliği ön eki — `Fixture.id` ↔ API-Football fixture ID dönüşümü. */
const FIXTURE_ID_PREFIX = "api-football-";

export function toFixtureId(apiFootballFixtureId: number): string {
  return `${FIXTURE_ID_PREFIX}${apiFootballFixtureId}`;
}

/** `api-football-123` → 123; başka biçimdeki (ör. eski mock) kimliklerde null. */
export function parseFixtureId(fixtureId: string): number | null {
  if (!fixtureId.startsWith(FIXTURE_ID_PREFIX)) return null;
  const numeric = Number(fixtureId.slice(FIXTURE_ID_PREFIX.length));
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

const STATUS_MAP: Record<string, FixtureStatus> = {
  TBD: "SCHEDULED",
  NS: "SCHEDULED",
  "1H": "LIVE",
  "2H": "LIVE",
  ET: "LIVE",
  BT: "LIVE",
  P: "LIVE",
  SUSP: "LIVE",
  INT: "LIVE",
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

const FINISHED_STATUS_CODES = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

export function isFinishedStatus(shortCode: string): boolean {
  return FINISHED_STATUS_CODES.has(shortCode);
}

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

/** Desteklenen liglerde Türkçe adı (bkz. leagues.ts), diğerlerinde sağlayıcının adını kullanır. */
function mapCompetition(raw: ApiFootballFixtureRaw["league"]): CompetitionRef {
  const supported = SUPPORTED_LEAGUES.find((league) => league.apiFootballId === raw.id);
  const logo = raw.logo ? { logoUrl: raw.logo } : {};
  return supported
    ? { id: supported.id, name: supported.name, shortName: supported.shortName, ...logo }
    : { id: String(raw.id), name: raw.name, shortName: raw.name, ...logo };
}

/**
 * Ham API-Football fikstürünü kanonik `Fixture`'a çevirir. Saf fonksiyon, side-effect
 * içermez (bkz. CLAUDE.md 1.4). Ayrı bir Fixture tablosu olmadığından `id`, sağlayıcı
 * kimliğinden deterministik olarak türetilir (`toFixtureId`).
 */
export function mapApiFootballFixtureToFixture(raw: ApiFootballFixtureRaw): Fixture {
  return {
    id: toFixtureId(raw.fixture.id),
    providerIds: { apiFootball: raw.fixture.id },
    kickoffUtc: new Date(raw.fixture.date).toISOString(),
    status: mapStatus(raw.fixture.status.short),
    homeTeam: mapTeam(raw.teams.home),
    awayTeam: mapTeam(raw.teams.away),
    competition: mapCompetition(raw.league),
    // Derbi tansiyonu sınıflandırması insan onaylı bir adımdır (bkz. CLAUDE.md 3.2.3 ve
    // taslak inceleme ekranı); burada yalnızca alan boş kalmasın diye nötr varsayılan atanır.
    derbyIntensity: "NONE",
    details: {
      venueName: raw.fixture.venue?.name ?? null,
      venueCity: raw.fixture.venue?.city ?? null,
      referee: raw.fixture.referee ?? null,
      round: raw.league.round || null,
    },
  };
}
