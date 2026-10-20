import { z } from "zod";
import { MATCH_DAY_FORMAT_IDS } from "@/types/match-day";
import { SCENARIO_IDS, type PredictionSet } from "@/types/prediction";
import type { VitrinRenderOptions } from "@/types/vitrin";

/**
 * Tahmin kaydı (Tahmin Karnesi'nin kaynağı) — saf eşleme. Vitrin kartı onaylanınca açık 2 senaryo
 * `PredictionRecord`'a yazılır (`draft-engine.ts::decideDraft`, onayla aynı transaction). Tablo
 * değiştirilemez (veritabanı trigger'ı); burada güncelleme/silme yolu yok.
 */

const scenarioId = z.enum(SCENARIO_IDS);
const outcomeSchema = z.union([
  z.object({ scenario: z.enum(["RESULT_1X2", "HT_RESULT"]), pick: z.enum(["HOME", "DRAW", "AWAY"]) }),
  z.object({ scenario: z.enum(["BTTS", "GOALS_3PLUS", "GOALS_4PLUS"]), pick: z.enum(["YES", "NO"]) }),
  z.object({ scenario: z.literal("COMBO"), team: z.enum(["HOME", "AWAY"]), pick: z.enum(["YES", "NO"]) }),
]);
const scenarioSchema = z.object({
  id: scenarioId,
  outcome: outcomeSchema,
  probability: z.number().min(0).max(1),
  outcomeProbabilities: z.record(z.string(), z.number()),
  reason: z.string(),
});
const predictionSchema = z.object({
  sourceId: z.string(),
  sourceVersion: z.string(),
  computedAtUtc: z.string(),
  scenarios: z.array(scenarioSchema),
  scenarioCount: z.number().int(),
  surprisePct: z.number().int(),
});

/** `AiContent.renderOptions` (kind = "VITRIN") — onay ve inceleme bunu doğrulayarak okur. */
export const vitrinOptionsSchema = z.object({
  kind: z.literal("VITRIN"),
  format: z.enum(MATCH_DAY_FORMAT_IDS),
  prediction: predictionSchema,
  open: z.tuple([scenarioId, scenarioId]),
  locked: z.tuple([scenarioId, scenarioId, scenarioId]),
  photoId: z.string().nullable(),
});

export function parseVitrinOptions(value: unknown): VitrinRenderOptions | null {
  const parsed = vitrinOptionsSchema.safeParse(value);
  return parsed.success ? (parsed.data as VitrinRenderOptions) : null;
}

export interface PredictionRecordInput {
  aiContentId: string;
  fixtureId: string;
  scenarioId: string;
  outcome: object;
  probability: string;
  outcomeProbabilities: Record<string, number>;
  sourceId: string;
  sourceVersion: string;
  reason: string;
  computedAt: Date;
}

/** Açık 2 senaryonun kayıt satırları (olasılık 4 ondalık, Decimal(5,4)). Senaryo eksikse hata. */
export function predictionRecordsFor(aiContentId: string, fixtureId: string, options: Pick<VitrinRenderOptions, "open"> & { prediction: PredictionSet }): PredictionRecordInput[] {
  return options.open.map((id) => {
    const scenario = options.prediction.scenarios.find((entry) => entry.id === id);
    if (!scenario) throw new Error(`Tahmin setinde açık senaryo yok: ${id}`);
    return {
      aiContentId,
      fixtureId,
      scenarioId: id,
      outcome: scenario.outcome,
      probability: scenario.probability.toFixed(4),
      outcomeProbabilities: scenario.outcomeProbabilities,
      sourceId: options.prediction.sourceId,
      sourceVersion: options.prediction.sourceVersion,
      reason: scenario.reason,
      computedAt: new Date(options.prediction.computedAtUtc),
    };
  });
}
