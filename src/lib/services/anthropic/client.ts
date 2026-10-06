import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/**
 * Analist metinleri için model — bkz. CLAUDE.md (AI Market Tahmin). Kurucu kararı (2026-10-06, "Sıfır
 * Hata / Kusursuz Türkçe"): Haiku'nun Türkçesi yetersiz kaldı → en güncel Sonnet. (`claude-3-5-sonnet-*`
 * ve `claude-3-5-haiku-*` emekli; yerine Sonnet 5.5.)
 */
export const ANALYST_MODEL = "claude-sonnet-5-5";

/** Düşünmesiz ~1.5K token çıktı birkaç saniye ile ~30 sn arası sürer; SDK yeniden denemeleri bunun üstüne eklenir. */
const REQUEST_TIMEOUT_MS = 60_000;

export function isAnthropicConfigured(): boolean {
  return env.ANTHROPIC_API_KEY.length > 0;
}

let client: Anthropic | null = null;

/** Süreç başına tek istemci. Anahtar yalnızca sunucuda okunur (bkz. CLAUDE.md 1.7). */
export function getAnthropicClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  return client;
}
