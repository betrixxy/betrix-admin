import { getCurrentSession } from "@/lib/auth/require-session";
import { isSafeFileName, isStorageBucket, readStoredFile } from "@/lib/dashboard/storage";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

// Oturuma bağlı ve dosya sistemine dayalı — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

/** Yerel `storage/` dosyalarını yalnızca giriş yapmış admine servis eder (bkz. CLAUDE.md 1.6). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  if (!(await getCurrentSession())) return new Response("Yetkisiz", { status: 401 });

  const { path: segments } = await params;
  const [bucket, fileName] = segments;
  if (segments.length !== 2 || !bucket || !fileName || !isStorageBucket(bucket) || !isSafeFileName(fileName)) {
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
