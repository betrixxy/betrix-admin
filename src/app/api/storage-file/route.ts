import { getCurrentSession } from "@/lib/auth/require-session";
import { readStoredFile } from "@/lib/dashboard/storage";
import { createStorageFileHandler } from "@/lib/dashboard/storage-file-handler";

// Oturuma bağlı ve dosya sistemine dayalı — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

/**
 * Yerel `storage/` dosyalarını yalnızca giriş yapmış admine servis eder (bkz. CLAUDE.md 1.6); oturumsuz 403.
 * Mantık ve onaysız vitrin kuralı: `lib/dashboard/storage-file-handler.ts`.
 *
 * Genel adres `/api/files/<kova>/<dosya>`'dır; `next.config.ts` içindeki rewrite onu buraya
 * `?bucket=&file=` olarak yönlendirir. Route bilerek DİNAMİK SEGMENTSİZDİR: Next.js dev sunucusu
 * dinamik route'larda her yeni URL için ayrı bir "static paths" alt süreci başlatır; her yeni
 * görsel yeni bir URL olduğundan bu süreçler bellek baskısında çöküp dosya servisini sunucu
 * yeniden başlatılana kadar kilitliyordu ("Jest worker encountered 2 child process exceptions").
 */
export const GET = createStorageFileHandler({
  hasSession: async () => (await getCurrentSession()) !== null,
  readFile: readStoredFile,
});
