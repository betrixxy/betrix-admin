import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ANALYST_MODEL, getAnthropicClient, isAnthropicConfigured } from "@/lib/services/anthropic/client";
import { SCENARIO_REASONS_SYSTEM_PROMPT } from "@/lib/services/anthropic/scenario-reasons-prompt";
import { scenarioReasonsSchema, type AnthropicError, type ScenarioReasonsOutput } from "@/lib/services/anthropic/types";
import type { Result } from "@/types/result";

/**
 * Vitrin kartının senaryo gerekçeleri (Çelik Kasa analisti). Sabit sistem istemi önbelleklenir;
 * maça özgü her şey kullanıcı mesajında. Çıktı `lib/prediction/reasons.ts::auditReason` ile
 * denetlenir (yön ve örneklem dahil) — geçemeyen gerekçe kural tabanlı gerekçeye düşer ya da kartı
 * kilitler (`auditedReasons`). Altı gerekçe birden yazılır: admin açık kutuları değiştirince yeni çağrı gerekmez. Yalnızca admin tıklamasıyla çağrılır (CLAUDE.md 1.10).
 */
const SYSTEM_PROMPT = SCENARIO_REASONS_SYSTEM_PROMPT;

const MAX_TOKENS = 900;

export async function generateScenarioReasons(facts: unknown, scenarios: unknown): Promise<Result<ScenarioReasonsOutput, AnthropicError>> {
  if (!isAnthropicConfigured()) {
    return { ok: false, error: { code: "NOT_CONFIGURED", message: "ANTHROPIC_API_KEY tanımlı değil — kural tabanlı gerekçeler kullanılıyor." } };
  }
  try {
    const response = await getAnthropicClient().messages.parse({
      model: ANALYST_MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "between_tools" },
      output_config: { format: zodOutputFormat(scenarioReasonsSchema) },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Olgu paketi (JSON):\n${JSON.stringify(facts)}\n\nSenaryolar ve seçili sonuçlar (JSON):\n${JSON.stringify(scenarios)}\n\nAltı senaryonun gerekçesini yaz.`,
        },
      ],
    });
    const { usage } = response;
    console.info(`[anthropic] senaryo gerekçeleri: girdi ${usage.input_tokens} · önbellek okuma ${usage.cache_read_input_tokens ?? 0} · çıktı ${usage.output_tokens}`);
    if (response.stop_reason === "refusal") return { ok: false, error: { code: "REFUSED", message: "Model bu isteği yanıtlamadı (refusal)." } };
    if (response.stop_reason === "max_tokens") return { ok: false, error: { code: "TRUNCATED", message: "Yanıt token sınırında kesildi." } };
    if (!response.parsed_output) return { ok: false, error: { code: "INVALID_RESPONSE", message: "Model yanıtı beklenen şemaya uymadı." } };
    return { ok: true, data: response.parsed_output };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, error: { code: "RATE_LIMITED", message: "Claude hız sınırına takıldı — birazdan tekrar deneyin." } };
    if (error instanceof Anthropic.APIError) {
      console.error(`[anthropic] senaryo gerekçeleri başarısız: ${error.status ?? "?"} ${error.message}`);
      return { ok: false, error: { code: "API_ERROR", message: `Claude isteği başarısız (${error.status ?? "bağlantı"}).` } };
    }
    throw error;
  }
}
