import type { MatchDayFormatId } from "./match-day";

/**
 * MAÇ SONUCU kartı (`AiContent.contentType = "MATCH_RESULT"`, maç sonrası) — kanonik tipler.
 * Maç Günü altyapısını (format, Fal düzenleme, kural tabanlı prompt) paylaşır; veri bitmiş
 * maçtan (FT/AET/PEN) gelir.
 */

/** dergi-kapagi · kahraman-skor · cerceve */
export const MATCH_RESULT_TEMPLATE_IDS = ["MAGAZINE_COVER", "HERO_SCORE", "FRAME"] as const;
export type MatchResultTemplateId = (typeof MATCH_RESULT_TEMPLATE_IDS)[number];

/** API-Football league id'den türetilen turnuva — formda salt okunur gösterilir. */
export const COMPETITION_KINDS = ["SUPER_LIG", "UCL", "UEL", "UECL", "TR_CUP", "NATIONAL", "OTHER"] as const;
export type CompetitionKind = (typeof COMPETITION_KINDS)[number];

/** Maç önemi — admin elle seçer ("Maç tansiyonu" alanının yerini alır). */
export const MATCH_IMPORTANCE_LEVELS = ["NORMAL", "DERBY", "BIG_DERBY", "FINAL_CRITICAL"] as const;
export type MatchImportance = (typeof MATCH_IMPORTANCE_LEVELS)[number];

export type MatchSide = "HOME" | "AWAY";
export type MatchOutcome = MatchSide | "DRAW";

export interface Competition {
  kind: CompetitionKind;
  /** "UEFA Avrupa Ligi" — eşlemesi olmayan ligde sağlayıcının adı. */
  name: string;
  leagueId: number;
  logoUrl: string;
}

/** Bir oyuncunun bir taraftaki golleri tek satırda: "72'", "90+2' (P)", "34' (KK)". */
export interface ScorerLine {
  playerId: number | null;
  name: string;
  minutes: string[];
}

export interface ResultTeam {
  id: number;
  /** Türkçe eşlenmiş ad ("Besiktas" → "Beşiktaş"). */
  name: string;
  logoUrl: string;
  goals: number;
  /** Bu tarafa yazılan goller (kendi kalesine goller dahil — golü kazanan taraf). */
  scorers: ScorerLine[];
  /** Forma rengi (`#rrggbb`); dizilişte ve renk tablosunda yoksa boş. */
  colorHex: string;
}

export interface MvpCandidate {
  playerId: number;
  name: string;
  side: MatchSide;
  rating: number | null;
  goals: number;
}

/** Bitmiş maçın gerçek verisi — üretim anında `statsSnapshot`'a yazılır. */
export interface MatchResultFacts {
  fixtureId: number;
  /** ISO 8601, UTC */
  kickoffUtc: string;
  statusShort: "FT" | "AET" | "PEN";
  competition: Competition;
  /** "7. Hafta", "Lig Aşaması · 2. Maç", "Çeyrek Final" */
  roundLabel: string;
  home: ResultTeam;
  away: ResultTeam;
  outcome: MatchOutcome;
  /** Penaltı atışları skoru ("4-3"); yoksa null. */
  penaltyScore: string | null;
  /** Form önerisi; kullanıcı değiştirebilir. Veri yoksa null. */
  mvp: MvpCandidate | null;
  /** MVP'yi değiştirmek için seçilebilir oyuncular — iki takım, rating'e göre azalan. */
  players: MvpCandidate[];
}

/** Stüdyo üretim sonucu — önizleme ve maliyet özeti. */
export interface MatchResultGenerationResult {
  id: string;
  resultImageUrl: string;
  backgroundImageUrl: string;
  compositeImageUrl: string;
  prompt: string;
  format: MatchDayFormatId;
  paidCalls: number;
  savedSteps: string[];
}

export interface MatchResultActionState {
  error?: string;
  result?: MatchResultGenerationResult;
}

/** Şablona giden, metinleri biçimlenmiş ve görselleri `data:` URI'ye çözülmüş kart. */
export interface MatchResultCard {
  /** "MAÇ SONUCU" başlığı ve takım adları tr-TR büyük harfle. */
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  outcome: MatchOutcome;
  penaltyLabel: string | null;
  homeScorers: ScorerLine[];
  awayScorers: ScorerLine[];
  /** "UEFA AVRUPA LİGİ" */
  competitionLabel: string;
  /** "LİG AŞAMASI · 2. MAÇ" */
  roundLabel: string;
  /** Tek vurgu rengi (bkz. `match-result-theme.ts`) — koyu zeminde okunur. */
  accentHex: string;
  /** "OH HYEON-GYU"; MVP'siz şablonlarda null. */
  mvpName: string | null;
  homeLogo: string | null;
  awayLogo: string | null;
  leagueLogo: string | null;
  brandLogo: string;
}
