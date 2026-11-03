import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ANALYST_MODEL, getAnthropicClient, isAnthropicConfigured } from "@/lib/services/anthropic/client";
import { anthropicFailure } from "@/lib/services/anthropic/errors";
import type { AnthropicError } from "@/lib/services/anthropic/types";
import { acceptPolishedClaims, type ReelClaimInput } from "@/lib/reels/commentary";
import type { Result } from "@/types/result";

/**
 * Reels yorum şablonlarını doğal Türkçeye çevirir. Modele rakam ve veri gitmez, yalnız yuvalı şablon gider; rakamı kod yerleştirir.
 * Çıktı `acceptPolishedClaims` denetiminden geçer, geçemeyen kod şablonunda kalır. Hata istisna fırlatmaz: şablonlarla devam edilir.
 * Yalnızca admin tıklamasıyla çağrılır (CLAUDE.md 1.10).
 */

const SYSTEM_PROMPT = `Bir futbol analiz şirketinin kısa video metinlerini düzenleyen Türkçe editörsün.
Sana yuvalı cümle şablonları gelir. Her birini aynı anlamda, doğal ve akıcı Türkçeyle yeniden yaz.
Kurallar:
- {yuva} işaretlerinin hepsi aynen kalır; yeni yuva eklenmez, yuva silinmez, yuva adı değişmez. Yuvaya ek getirme: takım adı ya da rakamdan sonra ek gelmeyecek biçimde kur.
- Rakam yazma. Yeni bilgi, taktik, oyuncu, transfer, sakatlık, moral ya da neden ekleme. Yalnız şablondaki bilgiyi söyle.
- Bahis dili kullanma: oran, kupon, iddaa, bahis, banko, market, alt, üst, KG, MS gibi sözcükler yasak.
- Şablondan en fazla %20 uzun olsun. Sıfat yığma, abartma, kesinlik iddia etme.`;

const outputSchema = z.object({ items: z.array(z.object({ id: z.string(), text: z.string() })) });
const MAX_TOKENS = 2000;

export interface ReelCommentaryDeps {
  configured: () => boolean;
  client: () => Pick<Anthropic, "messages">;
}
const PRODUCTION_DEPS: ReelCommentaryDeps = { configured: isAnthropicConfigured, client: getAnthropicClient };

export async function polishReelClaims(claims: readonly ReelClaimInput[], deps: ReelCommentaryDeps = PRODUCTION_DEPS): Promise<Result<ReturnType<typeof acceptPolishedClaims>, AnthropicError>> {
  if (!deps.configured()) return { ok: false, error: { code: "NOT_CONFIGURED", message: "ANTHROPIC_API_KEY tanımlı değil" } };
  try {
    const response = await deps.client().messages.parse({
      model: ANALYST_MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { format: zodOutputFormat(outputSchema) },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Şablonlar (JSON):\n${JSON.stringify(claims)}\n\nHer kimlik için yeniden yazılmış metni döndür.` }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: { code: "REFUSED", message: "Model bu isteği yanıtlamadı (refusal)." } };
    if (response.stop_reason === "max_tokens") return { ok: false, error: { code: "TRUNCATED", message: "Yanıt token sınırında kesildi." } };
    if (!response.parsed_output) return { ok: false, error: { code: "INVALID_RESPONSE", message: "Model yanıtı beklenen şemaya uymadı." } };
    return { ok: true, data: acceptPolishedClaims(claims, response.parsed_output.items) };
  } catch (error) {
    const failure = anthropicFailure(error);
    console.error(`[anthropic] reels yorumu başarısız: ${failure.message}`);
    return { ok: false, error: failure };
  }
}
