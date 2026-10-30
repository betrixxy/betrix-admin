import { outcomeLabel, type MatchSides } from "@/lib/prediction/catalog";
import { LEGACY_MODEL_VERSION } from "@/lib/prediction/poisson";
import { sideOf } from "@/lib/prediction/settle";
import type { ScenarioId, ScenarioOutcome } from "@/types/prediction";
import type { Goals, HitSummary } from "@/types/prediction-scorecard";

/**
 * Tahmin Karnesi dili — TEK KAYNAK (kart, gönderi metni, testler). "Tuttu / tutmadı", "isabet oranı";
 * bahis dili yok (`banned-words.ts`: "oran" tek başına yasaklı, "isabet oranı" serbest — testle sabit).
 */

/** Bu sayının altında yüzde yazılmaz: "3 tahminde 2 tuttu" + "İLK TAHMİNLER". */
export const SMALL_SAMPLE_LIMIT = 10;
export const SMALL_SAMPLE_BADGE = "İLK TAHMİNLER";
export const HIT_LABEL = "TUTTU";
export const MISS_LABEL = "TUTMADI";
export const RATE_LABEL = "İSABET ORANI";

/** Senaryo türüne göre kırılımın satır adları (B · dönem karnesi). */
export const SCENARIO_KIND_LABELS: Record<ScenarioId, string> = {
  RESULT_1X2: "Kazanma",
  BTTS: "İki takım da gol",
  GOALS_3PLUS: "Gollü maç (3+)",
  GOALS_4PLUS: "Gol yağmuru (4+)",
  HT_RESULT: "İlk yarı",
  COMBO: "Kazanma + 3+ gol",
};

/** A · maç karnesindeki soru (senaryonun sorusu; COMBO'da seçilen takımın adı). */
export function scorecardQuestion(outcome: ScenarioOutcome, sides: MatchSides): string {
  switch (outcome.scenario) {
    case "RESULT_1X2":
      return "Maçı kim kazanır?";
    case "HT_RESULT":
      return "İlk yarı kimin?";
    case "BTTS":
      return "İki takım da gol bulur mu?";
    case "GOALS_3PLUS":
      return "Maçta 3+ gol olur mu?";
    case "GOALS_4PLUS":
      return "Maçta 4+ gol olur mu?";
    case "COMBO":
      return `${outcome.team === "AWAY" ? sides.away : sides.home} kazanır ve 3+ gol olur mu?`;
  }
}

/** Modelin cevabı: "Galatasaray", "Beraberlik", "Evet", "Hayır". */
export const scorecardAnswer = (outcome: ScenarioOutcome, sides: MatchSides): string => outcomeLabel(outcome.pick, sides);

export const scoreText = (score: Goals): string => `${score.home}–${score.away}`;

/**
 * Gerçekleşen — cevapla aynı dilde + senaryonun okuduğu skor: "Galatasaray · 1–2", "İlk yarı 0–0 · Beraberlik",
 * "Evet · 1–2", "3 gol · 1–2".
 */
export function scorecardActual(outcome: ScenarioOutcome, score: Goals, sides: MatchSides): string {
  const total = score.home + score.away;
  switch (outcome.scenario) {
    case "RESULT_1X2":
      return `${outcomeLabel(sideOf(score), sides)} · ${scoreText(score)}`;
    case "HT_RESULT":
      return `${outcomeLabel(sideOf(score), sides)} · İY ${scoreText(score)}`;
    case "BTTS":
      return `${score.home > 0 && score.away > 0 ? "Evet" : "Hayır"} · ${scoreText(score)}`;
    case "GOALS_3PLUS":
    case "GOALS_4PLUS":
    case "COMBO":
      return `${total} gol · ${scoreText(score)}`;
  }
}

/** "%52" (tamsayı yüzde). */
export const percentText = (value: number): string => `%${Math.round(value)}`;

/** Ana sayı: n ≥ 10 → "%58 isabet oranı"; n < 10 → "3 tahminde 2 tuttu" + "İLK TAHMİNLER". */
export function hitSummary(total: number, hits: number): HitSummary {
  if (total < SMALL_SAMPLE_LIMIT) return { kind: "SMALL_SAMPLE", total, hits, text: `${total} tahminde ${hits} tuttu`, badge: SMALL_SAMPLE_BADGE };
  const percent = Math.round((hits / total) * 100);
  return { kind: "RATE", total, hits, percent, text: `${total} tahminde ${hits} tuttu · ${percentText(percent)} isabet oranı` };
}

/** Kırılım satırının değeri: "2/3", n ≥ 10 → "7/12 · %58". */
export function breakdownValue(total: number, hits: number): string {
  return total < SMALL_SAMPLE_LIMIT ? `${hits}/${total}` : `${hits}/${total} · ${percentText((hits / total) * 100)}`;
}

/** Kayıttaki sürüm → karne anahtarı (null = v1). */
export const versionKey = (modelVersion: string | null): string => modelVersion ?? LEGACY_MODEL_VERSION;

const VERSION_LABELS: Readonly<Record<string, string>> = { [LEGACY_MODEL_VERSION]: "Model v1", "v2-season-xg": "Model v2" };
export const versionLabel = (key: string): string => VERSION_LABELS[key] ?? `Model ${key}`;

/** "%52" → kart için; olasılık 0–1. */
export const probabilityText = (probability: number): string => percentText(probability * 100);

