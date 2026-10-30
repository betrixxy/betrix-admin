import type { ScenarioId } from "@/types/prediction";
import type { SettledStatus } from "@/types/prediction-scorecard";

/**
 * Tahmin Karnesi kart alanları (Satori şablonunun okuduğu, büyük harfi/biçimi uygulanmış metinler). Kurucu
 * `lib/dashboard/prediction-scorecard-card.ts`; şablonlar `templates/prediction-scorecard/`.
 */

/** Büyük isabet özeti: n ≥ 10 → dev yüzde + "İSABET ORANI · 24 TAHMİNDE 14 TUTTU"; n < 10 → dev metin + etiket. */
export type ScorecardHero =
  | { kind: "RATE"; percent: number; line: string }
  | { kind: "SMALL_SAMPLE"; text: string; badge: string | null };

export interface ScorecardCardBase {
  /** Üst satır ("MAÇ KARNESİ", "AYLIK KARNE"; set sayfasında sayfa etiketi). */
  kicker: string;
  /** "TAHMİN KARNESİ" */
  title: string;
  /** A: "KONYASPOR 1–2 GALATASARAY"; B: "EKİM 2026". */
  subtitle: string;
  hero: ScorecardHero;
  /** ✅/❌ şeridi, eskiden yeniye. */
  strip: SettledStatus[];
  footnote: string;
  /** Künye: A "TRENDYOL SÜPER LİG · 10. HAFTA · 30.10.2026"; B "YAYINLANAN BÜTÜN TAHMİNLER". */
  footerLine: string;
  brandLogo: string;
  /** Zemin ışığı (renk kuralı; altın/marka rengi değil). */
  glowHexes: [string, string];
}

export interface MatchScorecardCardRow {
  scenarioId: ScenarioId;
  question: string;
  /** "Model: Galatasaray · %52" */
  model: string;
  /** "Sonuç: Galatasaray · 1–2" */
  actual: string;
  status: SettledStatus;
  statusLabel: string;
}

export interface MatchScorecardCard extends ScorecardCardBase {
  kind: "MATCH";
  rows: MatchScorecardCardRow[];
}

export interface PeriodScorecardCardRow {
  label: string;
  value: string;
  /** 0–1, çubuk doluluğu. */
  ratio: number;
}

export interface PeriodScorecardCard extends ScorecardCardBase {
  kind: "PERIOD";
  breakdown: PeriodScorecardCardRow[];
  /** Sürüme göre ayrım: "MODEL V1 · 6 TAHMİNDE 4 TUTTU". */
  versions: { label: string; value: string }[] | null;
}

export type ScorecardCard = MatchScorecardCard | PeriodScorecardCard;
