import { buildMarketAnalysisDraft } from "@/lib/dashboard/deep-analysis-insights";
import { MARKET_LINES, applyExpertAnalysis } from "@/lib/dashboard/expert-analysis-apply";
import { allowedNumbers, buildAnalysisFacts } from "@/lib/dashboard/expert-analysis-facts";
import { ANALYST_MODEL, generateExpertAnalysis } from "@/lib/services/anthropic";
import type { DeepAnalysisStats, MarketAnalysisDraft } from "@/types/deep-analysis";
import type { Result } from "@/types/result";

export interface ExpertAnalysisResult {
  draft: MarketAnalysisDraft;
  warnings: string[];
  model: string;
}

/** Gerçek veriden olgu paketi → Claude → forma uygulanmış taslak + sayı denetimi uyarıları. */
export async function createExpertAnalysisDraft(fixtureId: string, stats: DeepAnalysisStats): Promise<Result<ExpertAnalysisResult>> {
  const facts = buildAnalysisFacts(stats);
  const output = await generateExpertAnalysis(facts);
  if (!output.ok) return { ok: false, error: { code: output.error.code, message: output.error.message } };

  const allowed = allowedNumbers(facts);
  for (const line of MARKET_LINES) allowed.add(line);
  const { draft, warnings } = applyExpertAnalysis(buildMarketAnalysisDraft(fixtureId, stats), output.data, stats, allowed);
  return { ok: true, data: { draft, warnings, model: ANALYST_MODEL } };
}
