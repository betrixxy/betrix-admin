import { z } from "zod";

const envSchema = z.object({
  FAL_KEY: z.string().optional().default(""),
  SPORTMONKS_API_KEY: z.string().optional().default(""),
  API_FOOTBALL_KEY: z.string().optional().default(""),
  CHECKMATCH_MAC_SERVER_URL: z.string().optional().default(""),
  CHECKMATCH_API_SECRET: z.string().optional().default(""),
  /** Oturum JWT'lerini imzalamak için — bkz. lib/auth/session.ts. */
  JWT_SECRET: z.string().optional().default(""),
  /** Tek admin hesabını oluşturmak için `prisma db seed` tarafından okunur. */
  ADMIN_EMAIL: z.string().optional().default(""),
  ADMIN_PASSWORD: z.string().optional().default(""),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  /** Prisma/libSQL bağlantı adresi — bkz. lib/prisma.ts. */
  DATABASE_URL: z.string().optional().default("file:./prisma/dev.db"),
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
  JWT_SECRET: process.env.JWT_SECRET,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
});
