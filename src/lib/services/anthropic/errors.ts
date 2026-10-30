import Anthropic from "@anthropic-ai/sdk";
import type { AnthropicError } from "@/lib/services/anthropic/types";

/**
 * Anthropic hatası → okunur Türkçe sebep (saf). Canlı test 2026-10-31: hesap HTTP 400 "Your credit balance is too
 * low" döndü; stüdyo yalnızca "Claude isteği başarısız (400)." yazıyordu. Çağıran (Vitrin gerekçeleri, Yayın Merkezi
 * metni) kartı/metni düşürmez — kural tabanlı gerekçe / şablon metni kullanılır ve bu sebep stüdyoda yazılır.
 * İstisna fırlatılmaz: SDK dışı hata da (ağ, beklenmeyen) `API_ERROR` olur.
 */
export function anthropicFailure(error: unknown): AnthropicError {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return { code: "API_ERROR", message: "Claude zaman aşımına uğradı" };
  if (error instanceof Anthropic.APIConnectionError) return { code: "API_ERROR", message: "Claude'a bağlanılamadı" };
  if (error instanceof Anthropic.RateLimitError) return { code: "RATE_LIMITED", message: "Claude hız sınırına takıldı — birazdan tekrar deneyin" };
  if (error instanceof Anthropic.APIError) {
    const text = error.message.toLowerCase();
    const status = error.status;
    if (/credit balance|billing|insufficient/u.test(text)) return { code: "API_ERROR", message: `Anthropic hesabının kredisi yetersiz (HTTP ${status ?? 400})` };
    if (status === 401 || status === 403) return { code: "API_ERROR", message: `ANTHROPIC_API_KEY geçersiz ya da yetkisiz (HTTP ${status})` };
    if (status === 529 || status === 503) return { code: "API_ERROR", message: `Claude şu an aşırı yoğun (HTTP ${status}) — birazdan tekrar deneyin` };
    if (status !== undefined && status >= 500) return { code: "API_ERROR", message: `Claude sunucu hatası (HTTP ${status})` };
    return { code: "API_ERROR", message: `Claude isteği reddedildi (HTTP ${status ?? "?"})` };
  }
  return { code: "API_ERROR", message: `Claude isteği tamamlanamadı (${error instanceof Error ? error.message : String(error)})` };
}

/** Vitrin: AI gerekçe yazılamadı → kural tabanlı gerekçeler (stüdyo uyarısı). */
export const aiReasonsFallbackNote = (error: Pick<AnthropicError, "message">): string =>
  `AI gerekçe yazılamadı: ${error.message.replace(/[.\s]+$/u, "")} — kural tabanlı gerekçeler kullanıldı.`;
