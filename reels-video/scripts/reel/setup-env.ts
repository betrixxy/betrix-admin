import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Komut satırı aracının çevresi. İlk içe aktarılan dosya olmalı: `@/lib/env` içe aktarılırken okur.
 * Yalnız gereken anahtarlar alınır, değerleri hiçbir yere yazılmaz. `DATABASE_URL` bilerek gerçek değil: bu araç canlı veritabanına
 * bağlanamaz, yanlışlıkla Prisma yüklense bile yer tutucu adrese gider.
 */

const WANTED = ["API_FOOTBALL_KEY", "FAL_KEY", "ELEVENLABS_API_KEY", "REELS_API_KEY"] as const;
/** Öncelik sırası. `.env.production` yalnız yerelde olmayan anahtar için okunur. */
const FILES = [".env.local", "../.env.local", "../.env.production"];

export const REELS_LOCAL_PORT = 18011;

function parse(file: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of readFileSync(file, "utf8").split(/\r?\n/u)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/u.exec(line);
    if (match?.[1] && match[2] !== undefined) values.set(match[1], match[2].trim().replace(/^(['"])(.*)\1$/u, "$2"));
  }
  return values;
}

for (const file of FILES) {
  const full = path.resolve(process.cwd(), file);
  if (!existsSync(full)) continue;
  const values = parse(full);
  for (const name of WANTED) {
    const value = values.get(name);
    if (value && !process.env[name]) process.env[name] = value;
  }
}

process.env.NEXT_PHASE = "phase-production-build";
process.env.REELS_API_URL = `http://127.0.0.1:${REELS_LOCAL_PORT}`;

export const hasKey = (name: (typeof WANTED)[number]): boolean => Boolean(process.env[name]);
