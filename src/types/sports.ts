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

export interface InjuryReport {
  playerId: string;
  teamId: string;
  status: "OUT" | "DOUBTFUL" | "SUSPENDED";
  /** ISO 8601 tarih, biliniyorsa */
  expectedReturn?: string;
  /** 0-100, iç hesaplanan etki skoru */
  squadImpactScore: number;
}
