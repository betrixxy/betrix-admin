import sharp from "sharp";
import { verifyPublicMedia } from "@/lib/dashboard/public-media";
import { readStoredFile } from "@/lib/dashboard/storage";
import { isUnapprovedVitrinFile, VITRIN_FILE_FORBIDDEN } from "@/lib/prediction/vitrin-files";

// İmzası ve süresi her istekte denetlenir — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

/**
 * İmzalı, kısa ömürlü genel medya (bkz. lib/dashboard/public-media.ts) — Instagram Graph API'nin
 * paylaşım sırasında görseli indirdiği adres. Oturum istemez; imza/süre geçersizse 403. Instagram yalnızca
 * JPEG kabul ettiği için kart (PNG/SVG) anında JPEG'e çevrilir. Rota bilerek dinamik segmentsizdir
 * (bkz. app/api/storage-file).
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const stored = verifyPublicMedia(url.searchParams.get("f"), url.searchParams.get("e"), url.searchParams.get("s"));
  if (!stored) return new Response("Yetkisiz ya da süresi dolmuş bağlantı", { status: 403 });

  // İmza geçerli olsa da onaysız vitrin görseli verilmez (yayın kapısının arkasındaki ikinci savunma).
  if (await isUnapprovedVitrinFile(stored.bucket, stored.fileName)) return new Response(VITRIN_FILE_FORBIDDEN, { status: 403 });
  const data = await readStoredFile(stored.bucket, stored.fileName);
  if (!data) return new Response("Bulunamadı", { status: 404 });

  let jpeg: Buffer;
  try {
    // Kartlar opaktır; şeffaf kalan bölge (eski SVG/PNG) koyu zemine oturtulur.
    jpeg = await sharp(data).flatten({ background: "#0a1a2f" }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
  } catch {
    return new Response("Görsel okunamadı", { status: 422 });
  }
  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
