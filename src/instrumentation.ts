/**
 * Next.js sunucu açılış kancası. `lib/env.ts` normalde ilk istekte tembelce yüklenir;
 * burada açılışta içe aktarılarak eksik/geçersiz ortam değişkeninde süreç hemen durur
 * (fail-fast) — konteyner "sağlıklı görünüp" ilk girişte 500 dönmez.
 */
export async function register(): Promise<void> {
  // NEXT_RUNTIME, Next.js'in kendi runtime işaretidir (uygulama env'i değil — bkz. CLAUDE.md 1.7).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  try {
    await import("@/lib/env");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
