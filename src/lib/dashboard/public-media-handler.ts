import sharp from "sharp";
import type { StorageBucket } from "@/lib/dashboard/storage";

/**
 * İmzalı, kısa ömürlü genel medya (`/api/public-media`, bkz. `public-media.ts`) mantığı — bağımlılıklar dışarıdan
 * (rota birim testi). Oturum istemez; imza/süre geçersizse 403. İmza geçerli olsa da ONAYSIZ vitrin görseli 403
 * (yayın kapısının arkasındaki ikinci savunma — admin oturumu `/api/files` adresinden görür). Instagram yalnızca
 * JPEG kabul ettiği için kart (PNG/SVG) anında JPEG'e çevrilir.
 */

export interface PublicMediaDeps {
  verify: (target: string | null, expires: string | null, sig: string | null) => { bucket: StorageBucket; fileName: string } | null;
  isUnapprovedVitrin: (bucket: string, fileName: string) => Promise<boolean>;
  readFile: (bucket: StorageBucket, fileName: string) => Promise<Buffer | null>;
}

export const VITRIN_FILE_FORBIDDEN = "Onaysız vitrin görseli paylaşım adresinden verilmez — önce taslağı onaylayın.";

export function createPublicMediaHandler(deps: PublicMediaDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const stored = deps.verify(url.searchParams.get("f"), url.searchParams.get("e"), url.searchParams.get("s"));
    if (!stored) return new Response("Yetkisiz ya da süresi dolmuş bağlantı", { status: 403 });

    if (await deps.isUnapprovedVitrin(stored.bucket, stored.fileName)) return new Response(VITRIN_FILE_FORBIDDEN, { status: 403, headers: { "Cache-Control": "no-store" } });
    const data = await deps.readFile(stored.bucket, stored.fileName);
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
  };
}
