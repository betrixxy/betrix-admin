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

  // ---- İleri metrikler (API-Football'dan türetilir; veri yoksa null) ----
  shotsAvg: number | null;
  /** Rakibe izin verilen maç başı şut. */
  shotsConcededAvg: number | null;
  shotsInsideBoxPct: number | null;
  shotAccuracyPct: number | null;
  /** Şutların gole dönüşme oranı. */
  conversionPct: number | null;
  xgPerShot: number | null;
  /** Maç başı kilit pas (oyuncu toplamı). */
  keyPassesAvg: number | null;
  dribbleSuccessPct: number | null;
  /**
   * PPDA — TÜM SAHA YAKLAŞIMI: rakip pas / (müdahale + top kesme + faul). Gerçek PPDA yalnızca
   * rakibin kendi yarı/%60 alanındaki pasları sayar; iki sağlayıcı da bölge verisi sunmadığından
   * bu yaklaşım kullanılır. Düşük = yoğun pres.
   */
  ppdaFullPitch: number | null;

  /** Sportmonks'tan gelen ek metrikler — maç eşleşmezse veya anahtar yoksa null. */
  sportmonks: SportmonksAdvancedMetrics | null;
}

/**
 * Sportmonks maç istatistiklerinden takımın son maç ortalamaları — API-Football'da olmayan
 * metrikler. Maçlar iki sağlayıcı arasında tarih + takım adıyla eşlenir (kimlik tablosu yok).
 */
export interface SportmonksAdvancedMetrics {
  matchesSampled: number;
  bigChancesCreatedAvg: number | null;
  bigChancesMissedAvg: number | null;
  /** Rakibin yarattığı büyük şans — savunmanın izin verdiği. */
  bigChancesConcededAvg: number | null;
  dangerousAttacksAvg: number | null;
  crossAccuracyPct: number | null;
  longPassAccuracyPct: number | null;
}

export interface DeepAnalysisStats {
  fixture: Fixture;
  home: TeamDeepStats;
  away: TeamDeepStats;
  headToHead: HeadToHeadSummary;
  source: "api-football";
  /** Sportmonks zenginleştirmesinin durumu — "matched" değilse `sportmonks` alanları null'dır. */
  sportmonksStatus: "matched" | "unmatched" | "not-configured";
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
