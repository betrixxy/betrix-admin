/** Bkz. CLAUDE.md 2.2 — kanonik iç veri modelleri. Servis katmanları ham veriyi bu tiplere dönüştürür. */

export type FixtureStatus =
  | "SCHEDULED"
  | "LIVE"
  | "HT"
  | "FT"
  | "POSTPONED"
  | "CANCELLED";

export type DerbyIntensity = "NONE" | "RIVALRY" | "DERBY" | "ELITE_DERBY";

export type MatchResultLetter = "W" | "D" | "L";

export interface TeamRef {
  id: string;
  name: string;
  shortName: string;
  primaryColorHex: string;
  logoUrl: string;
}

export interface CompetitionRef {
  id: string;
  name: string;
  shortName: string;
  /** Sağlayıcının lig logosu (media.api-sports.io/football/leagues/<id>.png), varsa. */
  logoUrl?: string;
}

export interface Fixture {
  /** İçsel UUID, sağlayıcı ID'si değil — bkz. providerIds. */
  id: string;
  providerIds: { sportmonks?: number; apiFootball?: number };
  kickoffUtc: string;
  status: FixtureStatus;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  competition: CompetitionRef;
  derbyIntensity: DerbyIntensity;
  /** Sağlayıcı verdiyse maç künyesi (stadyum, hakem, tur) — "Maç Günü" kartı bunları kullanır. */
  details?: FixtureDetails;
}

export interface FixtureDetails {
  venueName: string | null;
  venueCity: string | null;
  referee: string | null;
  /** Sağlayıcının ham tur etiketi, ör. "Regular Season - 3". */
  round: string | null;
}

export interface TeamForm {
  teamId: string;
  last5: MatchResultLetter[];
  homeLast5?: MatchResultLetter[];
  awayLast5?: MatchResultLetter[];
  /** Maç başı ortalama */
  xgFor: number;
  xgAgainst: number;
  dangerousAttacksAvgPerMatch: number;
}

/**
 * Bir takımın maç öncesi son N maçlık gerçek form özeti (API-Football). `TeamForm`'dan ayrı
 * tutulur çünkü sağlayıcı "tehlikeli atak" vermez ve xG her maç için bulunmayabilir —
 * olmayan metrik `null`'dır, asla sıfır gösterilmez (bkz. CLAUDE.md 2.4 madde 3).
 */
export interface TeamRecentForm {
  teamId: string;
  teamName: string;
  logoUrl: string;
  /** Eskiden yeniye — son harf en son oynanan maç. */
  last5: MatchResultLetter[];
  /** Formun hesaplandığı maç sayısı (5'ten az olabilir). */
  matchesSampled: number;
  goalsForAvg: number | null;
  goalsAgainstAvg: number | null;
  /** Maç başı xG — hiçbir örnek maçta xG yoksa null. */
  xgForAvg: number | null;
  xgAgainstAvg: number | null;
  /** xG ortalamasına giren maç sayısı (kapsam dışı maçlar atlanır). */
  xgMatchesSampled: number;
}

export interface HeadToHeadMatch {
  kickoffUtc: string;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
}

/** İki takımın son karşılaşmaları — galibiyetler, bu maçın ev sahibine göre sayılır. */
export interface HeadToHeadSummary {
  matches: HeadToHeadMatch[];
  homeWins: number;
  draws: number;
  awayWins: number;
}

/** Stüdyo/taslak motorunun kullandığı, tek bir maça ait gerçek istatistik paketi. */
export interface MatchStats {
  fixture: Fixture;
  home: TeamRecentForm;
  away: TeamRecentForm;
  headToHead: HeadToHeadSummary;
  source: "api-football";
  /** ISO 8601 — verinin çekildiği an (taslakta "veri tazeliği" olarak gösterilir). */
  fetchedAtUtc: string;
}

export interface InjuryReport {
  playerId: string;
  teamId: string;
  status: "OUT" | "DOUBTFUL" | "SUSPENDED";
  /** ISO 8601 tarih, biliniyorsa */
  expectedReturn?: string;
  /** 0-100, iç hesaplanan etki skoru */
  squadImpactScore: number;
}
