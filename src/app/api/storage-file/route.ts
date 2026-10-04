import { getCurrentSession } from "@/lib/auth/require-session";
import { isSafeFileName, isStorageBucket, parseStoredFileUrl, readStoredFile } from "@/lib/dashboard/storage";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

// Oturuma bağlı ve dosya sistemine dayalı — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

/**
 * Yerel `storage/` dosyalarını yalnızca giriş yapmış admine servis eder (bkz. CLAUDE.md 1.6).
 *
 * Genel adres `/api/files/<kova>/<dosya>`'dır; `next.config.ts` içindeki rewrite onu buraya
 * `?bucket=&file=` olarak yönlendirir. Route bilerek DİNAMİK SEGMENTSİZDİR: Next.js dev sunucusu
 * dinamik route'larda her yeni URL için ayrı bir "static paths" alt süreci başlatır; her yeni
 * görsel yeni bir URL olduğundan bu süreçler bellek baskısında çöküp dosya servisini sunucu
 * yeniden başlatılana kadar kilitliyordu ("Jest worker encountered 2 child process exceptions").
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await getCurrentSession())) return new Response("Yetkisiz", { status: 401 });

  // Rewrite sonrası `request.url` istemcinin istediği özgün adresi (`/api/files/<kova>/<dosya>`)
  // taşır; doğrudan çağrıda ise `?bucket=&file=` kullanılır. İkisi de katı doğrulamadan geçer.
  const url = new URL(request.url);
  const fromPath = parseStoredFileUrl(url.pathname);
  const bucket = fromPath?.bucket ?? url.searchParams.get("bucket");
  const fileName = fromPath?.fileName ?? url.searchParams.get("file");
  if (!bucket || !fileName || !isStorageBucket(bucket) || !isSafeFileName(fileName)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const contentType = CONTENT_TYPES[fileName.split(".").pop()?.toLowerCase() ?? ""];
  const data = await readStoredFile(bucket, fileName);
  if (!contentType || !data) return new Response("Bulunamadı", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Doğrudan açılan SVG içinde script çalışmasını engeller.
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
