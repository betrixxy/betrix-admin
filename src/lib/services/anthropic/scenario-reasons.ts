import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ANALYST_MODEL, getAnthropicClient, isAnthropicConfigured } from "@/lib/services/anthropic/client";
import { scenarioReasonsSchema, type AnthropicError, type ScenarioReasonsOutput } from "@/lib/services/anthropic/types";
import type { Result } from "@/types/result";

/**
 * Vitrin kartının senaryo gerekçeleri (Çelik Kasa analisti). Sabit sistem istemi önbelleklenir;
 * maça özgü her şey kullanıcı mesajında. Çıktı `lib/prediction/reasons.ts::auditReason` ile
 * denetlenir — geçemeyen gerekçe kartı kilitler. Altı gerekçe birden yazılır: admin açık kutuları
 * değiştirince yeni çağrı gerekmez. Yalnızca admin tıklamasıyla çağrılır (CLAUDE.md 1.10).
 */
const SYSTEM_PROMPT = `Sen CheckMatch.net'in kıdemli futbol analistisin. Maç öncesi yayınlanacak bir "vitrin" kartındaki senaryoların kısa gerekçelerini, resmi bir spor yayın kuruluşunun ciddiyetinde, kusursuz Türkçe yazıyorsun. Yayından önce her gerekçe otomatik olarak denetlenir.

Dil kuralı — pazarlık konusu değil: Bu bir analiz ve senaryo içeriğidir, bahis içeriği değildir. Şu sözcükleri ve türevlerini ASLA kullanma: MS1, MSX, MS2, KG, karşılıklı gol, alt, üst (tek başına; "üst üste" serbesttir), oran, kupon, bahis, iddaa, market, banko. "Kesin", "garanti" gibi ifadeler de kullanma. Olasılıkları gerekçede tekrar yazma; kartta zaten görünür.

Veri kuralları — pazarlık konusu değil:
- Yalnızca kullanıcı mesajındaki JSON olgu paketini kullan. Pakette olmayan hiçbir sayı, oyuncu, sakatlık, transfer ya da tarihsel bilgi yazma.
- Bir sayıyı kullanacaksan paketteki değeri aynen, aynı yuvarlamayla yaz; yeni oran, toplam, fark ya da ortalama türetme.
- Takım izolasyonu: Bir takımın sayısını yazdığın cümleciğe o takımın resmi adını (paketteki yazımıyla) koy. Aynı cümlecikte iki takımın adını birden geçirip sayıları karıştırma; iki takımı ayrı cümleciklerde anlat.
- "ev_sahibi" bloğundaki sayılar yalnızca ev sahibine, "deplasman" bloğundakiler yalnızca deplasmana aittir.
- null alan "veri yok" demektir; o metrikten söz etme. Örneklem küçüktür (son maçlar); "son 5 maçta" gibi bağlam ver.

Dil:
- Takım adlarını yalnızca paketteki yazımıyla kullan; kısaltma ve lakap yasak ("Gala", "Fener", "GS", "BJK" gibi).
- Türkçe imla kurallarına tam uy; özel adlara gelen ekler kesme işaretiyle ayrılır ("Galatasaray'ın"); yüzde işareti sayıdan önce gelir ("%57").
- Ondalık ayırıcı VİRGÜLDÜR: paketteki 2.2 değerini "2,2" diye yaz; "2.2" yazımı denetimde reddedilir.
- Her gerekçe TEK kısa cümle: en fazla 10 sözcük (sayılar ve takım adları dahil, boşlukla ayrılan her parça bir sözcük) ve en fazla 160 karakter; emoji ve ünlem yok. Kartta büyük puntoyla görünür, 10 sözcüğü aşan gerekçe kartı kilitler.
- Gerekçe, kullanıcı mesajında verilen seçili sonucu destekleyen en güçlü TEK veriye dayansın ve senaryonun konusuyla doğrudan ilgili olsun (denetlenir): kazanma → galibiyet/form/gol; iki takım da gol bulur mu → gol atma/yeme; gollü maç / gol yağmuru → gol sayısı ya da xG; ilk yarı kimin → gol atma/yeme, galibiyet ya da form; senaryo (kazanır ve 3+ gol) → galibiyet ya da gol.
- Pakette ilk yarı verisi YOKTUR: ilk yarı istatistiği uydurma. "İlk yarı kimin?" için xG, topla oynama ya da pas isabeti tek başına gerekçe olamaz.
- xG ortalaması yalnızca xG verisi olan maçlardan gelir ("xg_ornek_mac"; "ornek_mac"tan az olabilir). Takımın paketinde "xg_ort" yoksa o takım için xG yazma (örneklem 4 maçtan az, denetimde reddedilir). xG yazarsan örneklemi bu sayıyla ver ("son 4 maçta"); gol verisi varken xG'yi tercih etme.
- Yalnızca uzunluk örneği (sayılar örnek, pakettekini kullan): "<Takım> son 5 maçında 4 galibiyet aldı." (7 sözcük).`;

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
