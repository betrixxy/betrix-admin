/**
 * Next.js sunucu açılış kancası. Ortam doğrulaması (fail-fast) Node.js'e özgü olduğundan
 * ayrı bir modülde yaşar ve yalnızca Node runtime'ında içe aktarılır — Next.js'in önerdiği
 * kalıp; böylece Edge derlemesi `process.exit`'i hiç görmez.
 */
export async function register(): Promise<void> {
  // NEXT_RUNTIME, Next.js'in kendi runtime işaretidir (uygulama env'i değil — bkz. CLAUDE.md 1.7).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
