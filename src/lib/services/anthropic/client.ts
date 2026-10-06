import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/**
 * Analist metinleri için model — bkz. CLAUDE.md (AI Market Tahmin). Bütçe kararı (2026-10-06): en
 * güncel Haiku. (`claude-3-5-haiku-*` Şubat 2026'da emekli edildi.)
 */
export const ANALYST_MODEL = "claude-haiku-4-5";

/** Haiku, düşünmesiz ~1.5K token çıktıyı birkaç saniyede üretir; SDK yeniden denemeleri bunun üstüne eklenir. */
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
