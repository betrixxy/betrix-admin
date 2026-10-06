import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

/** Analist metinleri için model — bkz. CLAUDE.md (AI Market Tahmin). */
export const ANALYST_MODEL = "claude-opus-5-5";

/** Düşünmeli bir analiz isteği ~30-90 sn sürebilir; SDK yeniden denemeleri bunun üstüne eklenir. */
const REQUEST_TIMEOUT_MS = 120_000;

export function isAnthropicConfigured(): boolean {
  return env.ANTHROPIC_API_KEY.length > 0;
}

let client: Anthropic | null = null;

/** Süreç başına tek istemci. Anahtar yalnızca sunucuda okunur (bkz. CLAUDE.md 1.7). */
export function getAnthropicClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  return client;
}
