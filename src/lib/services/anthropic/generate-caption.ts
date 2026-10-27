import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ANALYST_MODEL, getAnthropicClient, isAnthropicConfigured } from "@/lib/services/anthropic/client";
import type { AnthropicError } from "@/lib/services/anthropic/types";
import type { PublishPlatform } from "@/types/publishing";
import type { Result } from "@/types/result";

/**
 * Platforma özel gönderi metni (Yayın Merkezi). Model yalnızca olgu paketini görür: içeriğin türü, takım/lig
 * adları ve kartın şablon metni (her sayı oradan gelir). Çıktıdaki sayılar çağıran tarafta pakete karşı
 * denetlenir (bkz. lib/dashboard/publish-caption.ts). İstemler sabittir — önbellek öneki bozulmasın.
 */

const COMMON_RULES = `Sen CheckMatch.net'in sosyal medya editörüsün; kusursuz Türkçe yazıyorsun. Görev: verilen içerik kartı için gönderi metni yazmak.

Veri kuralları — pazarlık konusu değil:
- Yalnızca kullanıcı mesajındaki JSON olgu paketini kullan. Pakette olmayan hiçbir sayı, skor, oyuncu, sakatlık, transfer ya da tarihsel bilgi yazma; genel futbol bilginden olgu ekleme.
- Bir sayıyı kullanacaksan paketteki değeri aynen yaz; yeni oran, toplam ya da fark türetme.
- Takım ve lig adlarını paketteki resmi yazımıyla kullan; kısaltma ve lakap kullanma ("Gala", "Fener", "GS", "BJK" yasak). Hashtag'lerde boşluksuz resmi ad kullanılabilir (#Galatasaray, #SüperLig).
- Tahmin/market içeriğinde "kesin", "garanti", "banko" deme; bu bir olasılık değerlendirmesidir.
- Türkçe imla: ç, ğ, ı, İ, ö, ş, ü eksiksiz; özel adlara gelen ekler kesme işaretiyle ("Galatasaray'ın"); yüzde işareti sayıdan önce ("%57").
- CheckMatch.net'i en fazla bir kez, doğal biçimde an (ör. "Detaylı analiz CheckMatch.net'te").
- Yalnızca gönderi metnini yaz; açıklama, başlık ya da tırnak ekleme.`;

const PROMPTS: Record<PublishPlatform, string> = {
  IG_POST: `${COMMON_RULES}

Platform: INSTAGRAM GÖNDERİ.
- İlk satır güçlü bir kanca olsun (emoji ile başlayabilir).
- Bol ama yerinde emoji kullan (⚽🔥📊🎯👇 gibi); okuması kolay, 2-4 kısa paragrafa böl, paragraflar arasında boş satır bırak.
- Verideki en çarpıcı 2-4 bilgiyi öne çıkar.
- Sonda bir etkileşim çağrısı olsun (ör. "Sizce maç kaç kaç biter? Yorumlara bekliyoruz 👇").
- En alta, ayrı bir satırda 5-8 hashtag koy: popüler (#SüperLig, #Futbol) ve niş (takım/lig/içerik türü) karışık.
- Toplam en fazla 1.200 karakter.`,
  IG_REELS_STORY: `${COMMON_RULES}

Platform: INSTAGRAM REELS / STORY.
- Çok kısa ve enerjik: 1-3 kısa satır, ilk satır kanca.
- 2-4 emoji yeterli.
- Bir etkileşim çağrısı (ör. "Tahminini yaz 👇" ya da "Kaydet, maç günü bak 📌").
- En alta 3-5 hashtag.
- Toplam en fazla 400 karakter.`,
  X: `${COMMON_RULES}

Platform: X (TWITTER).
- KESİN SINIR: toplam 280 karakteri asla aşma (hedef 200-260).
- İlk cümle kanca olsun; ciddi, istatistik odaklı, vurucu bir dil kullan.
- En fazla 1 emoji (tercihen hiç).
- 2-3 hashtag'i cümlenin içine yedir (ör. "#Galatasaray son 5 maçta…"); sona hashtag yığını koyma.
- Paragraf yok; tek blok.`,
};

/** Instagram metni uzun olabilir; X kısa. Sınıra takılan yanıt TRUNCATED döner (yarım metin forma yazılmaz). */
const MAX_TOKENS: Record<PublishPlatform, number> = { IG_POST: 900, IG_REELS_STORY: 400, X: 300 };

const captionSchema = z.object({ caption: z.string().min(1).describe("Yalnızca gönderi metni.") });

/** `maxHashtags`: içerik türünün üst sınırı (ör. Kura 5) — platform kuralını ezer; sistem istemi önbellekte kalsın diye kullanıcı mesajında. */
export async function generateCaption(platform: PublishPlatform, facts: unknown, options: { maxHashtags?: number | null } = {}): Promise<Result<{ caption: string }, AnthropicError>> {
  if (!isAnthropicConfigured()) {
    return { ok: false, error: { code: "NOT_CONFIGURED", message: "ANTHROPIC_API_KEY tanımlı değil — AI metin üretimi devre dışı." } };
  }
  try {
    const response = await getAnthropicClient().messages.parse({
      model: ANALYST_MODEL,
      max_tokens: MAX_TOKENS[platform],
      // Sonnet 5.5'in en düşük düşünme ayarı (bkz. expert-analysis.ts).
      thinking: { type: "between_tools" },
      output_config: { format: zodOutputFormat(captionSchema) },
      system: [{ type: "text", text: PROMPTS[platform], cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Olgu paketi (JSON):\n${JSON.stringify(facts)}\n\nBu içerik için gönderi metnini yaz.${options.maxHashtags ? ` Bu içerik türünde EN FAZLA ${options.maxHashtags} hashtag kullan (platform kuralındaki sayıyı ezer).` : ""}` }],
    });

    const { usage } = response;
    console.info(`[anthropic] metin (${platform}): girdi ${usage.input_tokens} · önbellek okuma ${usage.cache_read_input_tokens ?? 0} · çıktı ${usage.output_tokens}`);

    if (response.stop_reason === "refusal") return { ok: false, error: { code: "REFUSED", message: "Model bu isteği yanıtlamadı (refusal)." } };
    if (response.stop_reason === "max_tokens") return { ok: false, error: { code: "TRUNCATED", message: "Yanıt token sınırında kesildi — tekrar deneyin." } };
    if (!response.parsed_output) return { ok: false, error: { code: "INVALID_RESPONSE", message: "Model yanıtı beklenen şemaya uymadı." } };
    return { ok: true, data: { caption: response.parsed_output.caption.trim() } };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: { code: "RATE_LIMITED", message: "Claude hız sınırına takıldı — birazdan tekrar deneyin." } };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`[anthropic] metin isteği başarısız: ${error.status ?? "?"} ${error.message}`);
      return { ok: false, error: { code: "API_ERROR", message: `Claude isteği başarısız (${error.status ?? "bağlantı"}).` } };
    }
    throw error;
  }
}
