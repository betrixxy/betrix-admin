import type { Fixture, HeadToHeadSummary, TeamRecentForm } from "@/types/sports";

/**
 * "AI Market Tahmin & Analiz" (Derinlemesine Analiz) içerik türünün tipleri — bkz.
 * lib/services/api-football/deep-analysis.ts (veri), lib/dashboard/deep-analysis-insights.ts
 * (veriden form önerileri) ve /dashboard/studio/market-analysis (stüdyo).
 */

/** API-Football oyuncu pozisyonu: Kaleci, Defans, Orta saha, Forvet. */
export type PlayerPosition = "G" | "D" | "M" | "F";

/** Takımın son maçlarındaki oyuncu performansının toplamı — "Anahtar Oyuncular" adayı. */
export interface KeyPlayerStats {
  id: number;
  name: string;
  photoUrl: string;
  position: PlayerPosition | null;
  appearances: number;
  minutes: number;
  /** Maç puanlarının ortalaması (API-Football rating) — puanı olmayan maçlar girmez. */
  avgRating: number | null;
  goals: number;
  assists: number;
  keyPasses: number;
}

/** Bir takımın derin analiz paketi: form/xG (mevcut hesap) + maç istatistikleri + oyuncular. */
export interface TeamDeepStats {
  form: TeamRecentForm;
  /** Takım istatistiği olan maç sayısı (ortalamaların örneklemi). */
  statMatchesSampled: number;
  possessionAvg: number | null;
  passAccuracyAvg: number | null;
  shotsOnTargetAvg: number | null;
  /**
   * Maç başı top kazanma = müdahale + top kesme (oyuncu istatistiklerinden). API-Football
   * "başarılı pres" verisi sunmaz; bu en yakın gerçek göstergedir.
   */
  ballWinsAvg: number | null;
  /** İkili mücadele kazanma yüzdesi. */
  duelsWonPct: number | null;
  /** Son maçlarda iki takımın da gol attığı / 2.5 üst biten / gol yemediği / gol atamadığı maç sayıları. */
  bttsCount: number;
  over25Count: number;
  cleanSheets: number;
  failedToScore: number;
  /** Son maçlarda en sık kullanılan diziliş (ör. "4-2-3-1"). */
  formation: string | null;
  /** Ortalama puana göre en iyi oyuncular (en fazla 5). */
  keyPlayers: KeyPlayerStats[];
}

export interface DeepAnalysisStats {
  fixture: Fixture;
  home: TeamDeepStats;
  away: TeamDeepStats;
  headToHead: HeadToHeadSummary;
  source: "api-football";
  fetchedAtUtc: string;
}

// ---- Stüdyo formu ----

export const ANALYSIS_POINT_COUNT = 3;
export const KEY_PLAYER_COUNT = 3;
export const STAT_TILE_COUNT = 4;

export interface KeyPlayerDraft {
  name: string;
  /** Taktiksel rol — ör. "Forvet · 3 gol · 7.4 puan" ya da elle "Oyun kurucu". */
  role: string;
  photoUrl: string;
}

export interface StatTileDraft {
  label: string;
  value: string;
}

/** Görseldeki tek takımlık analiz kartının düzenlenebilir içeriği. */
export interface TeamAnalysisDraft {
  teamName: string;
  logoUrl: string;
  /** Kart arka planındaki takım rengi parıltısı (#RRGGBB); boşsa CheckMatch yeşili. */
  colorHex: string;
  strengths: string[];
  cautions: string[];
  keyPlayers: KeyPlayerDraft[];
  stats: StatTileDraft[];
  /** Rakibe karşı önerilen yaklaşım (taktiksel analiz metni). */
  approach: string;
  /** Kartın altındaki alıntı/yorum. */
  quote: string;
}

export interface MarketSuggestion {
  pick: string;
  /** Önerinin dayandığı sayılar — "Beklenen toplam gol 3.1". */
  reason: string;
}

export interface MarketAnalysisDraft {
  fixtureId: string;
  home: TeamAnalysisDraft;
  away: TeamAnalysisDraft;
  /** Olası market tahmini — admin'in son kararı. */
  marketPick: string;
  marketRationale: string;
}

export type TeamSide = "home" | "away";
