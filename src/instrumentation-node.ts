/**
 * Yalnızca Node.js runtime'ında yüklenir (bkz. instrumentation.ts) — `process.exit` Edge'de
 * yoktur. `lib/env.ts`'i açılışta içe aktarır; eksik/geçersiz ortam değişkeninde süreci
 * hemen durdurur (fail-fast), konteyner "sağlıklı görünüp" ilk girişte 500 dönmez.
 */
try {
  await import("@/lib/env");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

export {};
