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

  /* ---------- Sosyal medya OAuth + metrik senkronizasyonu (bkz. lib/services/social/) ---------- */

  /**
   * Uygulamanın dışarıdan erişilen kök adresi — OAuth `redirect_uri` bundan üretilir ve her
   * sağlayıcının geliştirici panelinde birebir kayıtlı olmalıdır. Caddy arkasında `request.url`
   * iç adresi (app:3000) gösterdiği için istekten türetilmez.
   */
  APP_BASE_URL: z
    .string()
    .optional()
    .default("http://localhost:3000")
    .pipe(z.url("APP_BASE_URL geçerli bir URL olmalı.")),
  /**
   * OAuth token'larını veritabanında şifrelemek için 32 baytlık anahtar (64 hex karakter):
   * `openssl rand -hex 32`. Üretimde zorunlu (ilk bağlantıda); geliştirmede boşsa JWT_SECRET'tan türetilir.
   */
  SOCIAL_TOKEN_ENCRYPTION_KEY: z
    .string()
    .optional()
    .default("")
    .refine((value) => value === "" || /^[0-9a-f]{64}$/i.test(value), {
      message: "SOCIAL_TOKEN_ENCRYPTION_KEY 64 hex karakter (32 bayt) olmalı.",
    }),
  /**
   * `true` iken OAuth ve metrik çağrıları gerçek API'ye gitmez, mock adaptörü kullanılır
   * (bkz. CLAUDE.md 5.2). Tanımsızsa üretim dışındaki her ortamda `true`'dur.
   */
  SOCIAL_USE_MOCKS: z.enum(["true", "false"]).optional(),
  META_APP_ID: z.string().optional().default(""),
  META_APP_SECRET: z.string().optional().default(""),
  TIKTOK_CLIENT_KEY: z.string().optional().default(""),
  TIKTOK_CLIENT_SECRET: z.string().optional().default(""),
  YOUTUBE_CLIENT_ID: z.string().optional().default(""),
  YOUTUBE_CLIENT_SECRET: z.string().optional().default(""),
  X_CLIENT_ID: z.string().optional().default(""),
  X_CLIENT_SECRET: z.string().optional().default(""),
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
  APP_BASE_URL: read("APP_BASE_URL"),
  SOCIAL_TOKEN_ENCRYPTION_KEY: read("SOCIAL_TOKEN_ENCRYPTION_KEY"),
  SOCIAL_USE_MOCKS: read("SOCIAL_USE_MOCKS"),
  META_APP_ID: read("META_APP_ID"),
  META_APP_SECRET: read("META_APP_SECRET"),
  TIKTOK_CLIENT_KEY: read("TIKTOK_CLIENT_KEY"),
  TIKTOK_CLIENT_SECRET: read("TIKTOK_CLIENT_SECRET"),
  YOUTUBE_CLIENT_ID: read("YOUTUBE_CLIENT_ID"),
  YOUTUBE_CLIENT_SECRET: read("YOUTUBE_CLIENT_SECRET"),
  X_CLIENT_ID: read("X_CLIENT_ID"),
  X_CLIENT_SECRET: read("X_CLIENT_SECRET"),
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

/** Sosyal medya servisleri mock modunda mı — açıkça ayarlanmadıysa yalnızca üretimde kapalı. */
export const socialUseMocks: boolean =
  env.SOCIAL_USE_MOCKS === undefined ? env.NODE_ENV !== "production" : env.SOCIAL_USE_MOCKS === "true";
