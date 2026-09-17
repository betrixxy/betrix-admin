import { z } from "zod";

const envSchema = z.object({
  FAL_KEY: z.string().optional().default(""),
  SPORTMONKS_API_KEY: z.string().optional().default(""),
});

/**
 * Tüm sunucu taraflı ortam değişkeni erişimi buradan geçer (bkz. CLAUDE.md 1.7).
 * Çıplak `process.env.X` kullanımı kod tabanında yasaktır.
 */
export const env = envSchema.parse({
  FAL_KEY: process.env.FAL_KEY,
  SPORTMONKS_API_KEY: process.env.SPORTMONKS_API_KEY,
});
