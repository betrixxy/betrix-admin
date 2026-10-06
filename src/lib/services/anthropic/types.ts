import { z } from "zod";

/**
 * Analistin yapılandırılmış çıktısı — `output_config.format` ile şemaya zorlanır. Uzunluk sınırları
 * kartın taşmaması için istemde verilir ve sonradan ayrıca kırpılır (şema kısıtı olarak değil:
 * yapılandırılmış çıktı her JSON Schema kısıtını desteklemez).
 */
const teamAnalysisSchema = z.object({
  strengths: z.array(z.string()).describe("Tam 3 madde, her biri en fazla 70 karakter"),
  cautions: z.array(z.string()).describe("Tam 3 madde, her biri en fazla 70 karakter"),
  key_players: z
    .array(z.object({ name: z.string(), role: z.string() }))
    .describe("Olgu paketindeki oyunculardan tam 3'ü; name paketteki adla birebir aynı, role en fazla 55 karakter"),
  approach: z.string().describe("Rakibe karşı önerilen yaklaşım, 2-3 cümle, en fazla 380 karakter"),
  quote: z.string().describe("Kartın altındaki analist yorumu, tek cümle, en fazla 200 karakter"),
});

export const expertAnalysisSchema = z.object({
  home: teamAnalysisSchema,
  away: teamAnalysisSchema,
  market: z.object({
    pick: z.string().describe("Tek market, ör. '2.5 Üst', 'KG Var', 'MS 1'"),
    rationale: z.string().describe("Gerekçe, en fazla 150 karakter"),
  }),
});

export type ExpertAnalysisOutput = z.infer<typeof expertAnalysisSchema>;

export interface AnthropicError {
  code: "NOT_CONFIGURED" | "REFUSED" | "INVALID_RESPONSE" | "TRUNCATED" | "RATE_LIMITED" | "API_ERROR";
  message: string;
}
