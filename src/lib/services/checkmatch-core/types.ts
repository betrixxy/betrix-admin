import { z } from "zod";

export const checkmatchMarketSelectionRawSchema = z.object({
  label: z.string(),
  odds: z.number(),
  probability: z.number(),
});

export const checkmatchMarketCalculationRawSchema = z.object({
  market: z.string(),
  selections: z.array(checkmatchMarketSelectionRawSchema),
});

export const checkmatchMatchCalculationsRawSchema = z.object({
  fixture_id: z.string(),
  computed_at: z.string(),
  markets: z.array(checkmatchMarketCalculationRawSchema),
});

export type CheckmatchMatchCalculationsRaw = z.infer<typeof checkmatchMatchCalculationsRawSchema>;

export interface CheckmatchCoreError {
  code: "NOT_CONFIGURED" | "TIMEOUT" | "NETWORK" | "HTTP_STATUS" | "INVALID_RESPONSE";
  message: string;
  status?: number;
}
