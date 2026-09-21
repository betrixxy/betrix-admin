import { z } from "zod";

const envSchema = z.object({
  FAL_KEY: z.string().optional().default(""),
  SPORTMONKS_API_KEY: z.string().optional().default(""),
  API_FOOTBALL_KEY: z.string().optional().default(""),
  CHECKMATCH_MAC_SERVER_URL: z.string().optional().default(""),
  CHECKMATCH_API_SECRET: z.string().optional().default(""),
});

/**
 * Tüm sunucu taraflı ortam değişkeni erişimi buradan geçer (bkz. CLAUDE.md 1.7).
 * Çıplak `process.env.X` kullanımı kod tabanında yasaktır.
 */
export const env = envSchema.parse({
  FAL_KEY: process.env.FAL_KEY,
  SPORTMONKS_API_KEY: process.env.SPORTMONKS_API_KEY,
  API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY,
  CHECKMATCH_MAC_SERVER_URL: process.env.CHECKMATCH_MAC_SERVER_URL,
  CHECKMATCH_API_SECRET: process.env.CHECKMATCH_API_SECRET,
});
