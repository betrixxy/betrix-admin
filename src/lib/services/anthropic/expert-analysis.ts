import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ANALYST_MODEL, getAnthropicClient, isAnthropicConfigured } from "@/lib/services/anthropic/client";
import { expertAnalysisSchema, type AnthropicError, type ExpertAnalysisOutput } from "@/lib/services/anthropic/types";
import type { Result } from "@/types/result";

/**
 * Sabit sistem istemi — istekten isteğe değişmez (önbellek öneki bozulmasın). Maça özgü her şey
 * kullanıcı mesajındaki olgu paketindedir.
 */
const SYSTEM_PROMPT = `Sen CheckMatch.net'in kıdemli futbol analistisin. Sky Sports ya da The Athletic'teki bir taktik analistinin ciddiyetinde, Türkçe yazıyorsun. Çıktın, maç öncesi yayınlanacak "Derinlemesine Analiz" kartlarına (her takım için bir kart) ve bir market tahminine dönüşüyor.

Veri kuralları — bunlar pazarlık konusu değil:
- Yalnızca kullanıcı mesajındaki JSON olgu paketini kullan. Pakette olmayan hiçbir sayı, oyuncu, sakatlık, transfer, teknik direktör ya da tarihsel bilgi yazma; genel futbol bilginden olgu ekleme.
- Bir sayıyı kullanacaksan paketteki değeri aynen (aynı yuvarlamayla) kullan; yeni oran, toplam ya da ortalama türetme.
- null alan "veri yok" demektir; o metrikten hiç söz etme.
- "ppda_tum_saha" tüm sahada hesaplanmış bir yaklaşımdır: düşük değer daha yoğun pres demektir. Ondan söz edersen "PPDA" de, ama bölgesel pres verisi varmış gibi yazma.
- Örneklem küçüktür (son 5 maç). Kesinlik iddia etme; "son 5 maçta" gibi bağlam ver.

Yazım:
- Taktik dil kullan (yüksek pres, geçiş savunması, blok yüksekliği, kanat organizasyonu, bitiricilik, şut kalitesi, top kazanma, ikinci top…) ama her yargıyı paketteki bir veriye dayandır.
- Güçlü yönler ve dikkat edilmesi gerekenler kısa, keskin maddeler olsun; her maddede tercihen bir somut veri bulunsun. Klişe ("iyi oynuyor", "formda") yerine ne yaptığını söyle.
- Anahtar oyuncular: paketteki oyunculardan en etkili 3'ünü seç, adı paketteki yazımla birebir yaz; rolü taktik işleviyle anlat (ör. "Sol kanattan içe kat eden yaratıcı").
- Önerilen yaklaşım: takımın, rakibin paketteki zaaflarına karşı nasıl oynaması gerektiği; somut bir oyun planı.
- Alıntı: kartın altına gidecek, tek cümlelik, akılda kalan bir analist yorumu.
- Market: iki takımın verisinden en savunulabilir tek market ve sayıya dayalı kısa gerekçe. "Kesin", "garanti", "banko" gibi ifadeler kullanma; bu bir olasılık değerlendirmesidir.
- Uzunluk sınırları şemadaki açıklamalarda; kart alanı sınırlı, aşma.`;

/** Taktik çıkarım ve veriye sadakat kalite için kritik; istek başına bir kez çalışır. */
const EFFORT = "high";
const MAX_TOKENS = 16_000;

/**
 * Olgu paketinden iki takımın analist metinlerini ve market tahminini üretir (Claude, yapılandırılmış
 * çıktı). Güvenlik sınıflandırıcısı reddederse sunucu tarafı yedek model devreye girer ("default").
 */
export async function generateExpertAnalysis(facts: unknown): Promise<Result<ExpertAnalysisOutput, AnthropicError>> {
  if (!isAnthropicConfigured()) {
    return { ok: false, error: { code: "NOT_CONFIGURED", message: "ANTHROPIC_API_KEY tanımlı değil — AI analist devre dışı." } };
  }

  try {
    const response = await getAnthropicClient().beta.messages.parse({
      model: ANALYST_MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: { effort: EFFORT, format: betaZodOutputFormat(expertAnalysisSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Olgu paketi (JSON):\n${JSON.stringify(facts, null, 2)}\n\nİki takım için analizi ve market tahminini üret.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: { code: "REFUSED", message: "Model bu isteği yanıtlamadı (refusal)." } };
    }
    if (response.stop_reason === "max_tokens") {
      return { ok: false, error: { code: "TRUNCATED", message: "Yanıt token sınırında kesildi." } };
    }
    if (!response.parsed_output) {
      return { ok: false, error: { code: "INVALID_RESPONSE", message: "Model yanıtı beklenen şemaya uymadı." } };
    }
    return { ok: true, data: response.parsed_output };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: { code: "RATE_LIMITED", message: "Claude hız sınırına takıldı — birazdan tekrar deneyin." } };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[anthropic] analiz isteği başarısız: ${error.status ?? "?"} ${error.message}`);
      return { ok: false, error: { code: "API_ERROR", message: `Claude isteği başarısız (${error.status ?? "bağlantı"}).` } };
    }
    throw error;
  }
}
