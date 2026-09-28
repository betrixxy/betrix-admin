import { z } from "zod";

const isProduction = process.env.NODE_ENV === "production";

/**
 * `next build` sayfa verisini toplarken modülleri içe aktarır; Docker build aşamasında gizli
 * anahtarlar yoktur (olmamalıdır da — imaja gömülürler). Bu aşamada zorunlu alanlar yalnızca
 * derlemenin geçmesi için yer tutucuyla doldurulur; çalışma zamanında (`NEXT_PHASE` yokken)
 * gerçek doğrulama her zaman uygulanır.
 */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/** HS256 için anahtar en az 256 bit olmalı — üretimde kısa/tahmin edilebilir sır reddedilir. */
const MIN_JWT_SECRET_LENGTH = isProduction ? 32 : 1;

const BUILD_PHASE_PLACEHOLDERS = {
  JWT_SECRET: "build-phase-placeholder-never-used-at-runtime",
  DATABASE_URL: "postgresql://build:build@localhost:5432/build",
} as const;

const envSchema = z.object({
  FAL_KEY: z.string().optional().default(""),
  SPORTMONKS_API_KEY: z.string().optional().default(""),
  API_FOOTBALL_KEY: z.string().optional().default(""),
  CHECKMATCH_MAC_SERVER_URL: z.string().optional().default(""),
  CHECKMATCH_API_SECRET: z.string().optional().default(""),
  /** Oturum JWT'lerini imzalamak için — bkz. lib/auth/session.ts. Zorunlu; yoksa uygulama açılmaz. */
  JWT_SECRET: z
    .string({ error: "JWT_SECRET tanımlı değil." })
    .min(MIN_JWT_SECRET_LENGTH, `JWT_SECRET en az ${MIN_JWT_SECRET_LENGTH} karakter olmalı.`),
  /** Tek admin hesabını oluşturmak için `prisma db seed` tarafından okunur. */
  ADMIN_EMAIL: z.string().optional().default(""),
  ADMIN_PASSWORD: z.string().optional().default(""),
  NODE_ENV: z.enum(["development", "production", "test"]).optional().default("development"),
  /** Prisma/PostgreSQL bağlantı adresi — bkz. lib/prisma.ts. Zorunlu; varsayılan değer yoktur. */
  DATABASE_URL: z
    .string({ error: "DATABASE_URL tanımlı değil." })
    .regex(/^postgres(ql)?:\/\/.+/, "DATABASE_URL geçerli bir postgresql:// adresi olmalı."),
  /** `/api/track`'e CORS ile izin verilen kaynaklar, virgülle ayrılmış — bkz. app/api/track/route.ts. */
  TRACK_ALLOWED_ORIGINS: z
    .string()
    .optional()
    .default("https://checkmatch.net,https://www.checkmatch.net"),
  /** İsteğe bağlı, gizli olmayan "site anahtarı" (GA/Plausible ölçüm ID'si gibi) — boşsa zorunlu tutulmaz. */
  TRACK_SITE_KEY: z.string().optional().default(""),
});

/** Boş string'i "tanımsız" say — `.env`'de `JWT_SECRET=` satırı sessizce geçmesin. */
function read(name: keyof typeof envSchema.shape): string | undefined {
  const value = process.env[name];
  if (value !== undefined && value !== "") return value;
  if (isBuildPhase && name in BUILD_PHASE_PLACEHOLDERS) {
    return BUILD_PHASE_PLACEHOLDERS[name as keyof typeof BUILD_PHASE_PLACEHOLDERS];
  }
  return undefined;
}

const parsed = envSchema.safeParse({
  FAL_KEY: read("FAL_KEY"),
  SPORTMONKS_API_KEY: read("SPORTMONKS_API_KEY"),
  API_FOOTBALL_KEY: read("API_FOOTBALL_KEY"),
  CHECKMATCH_MAC_SERVER_URL: read("CHECKMATCH_MAC_SERVER_URL"),
  CHECKMATCH_API_SECRET: read("CHECKMATCH_API_SECRET"),
  JWT_SECRET: read("JWT_SECRET"),
  ADMIN_EMAIL: read("ADMIN_EMAIL"),
  ADMIN_PASSWORD: read("ADMIN_PASSWORD"),
  NODE_ENV: read("NODE_ENV"),
  DATABASE_URL: read("DATABASE_URL"),
  TRACK_ALLOWED_ORIGINS: read("TRACK_ALLOWED_ORIGINS"),
  TRACK_SITE_KEY: read("TRACK_SITE_KEY"),
});

/**
 * Fail-fast: eksik/geçersiz zorunlu değişkenle uygulama açılmaz. Hata mesajı yalnızca alan
 * adlarını ve kuralı içerir, değerleri asla loglamaz. `src/instrumentation.ts` bu modülü
 * sunucu açılışında içe aktarır, böylece hata ilk istekte değil başlangıçta patlar.
 */
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Ortam değişkenleri geçersiz, uygulama başlatılmıyor:\n${issues}`);
}

/**
 * Tüm sunucu taraflı ortam değişkeni erişimi buradan geçer (bkz. CLAUDE.md 1.7).
 * Çıplak `process.env.X` kullanımı kod tabanında yasaktır.
 */
export const env = parsed.data;
