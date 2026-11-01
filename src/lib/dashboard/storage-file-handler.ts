import { isSafeFileName, isStorageBucket, parseStoredFileUrl, type StorageBucket } from "@/lib/dashboard/storage";

/**
 * `/api/files/<kova>/<dosya>` mantığı — bağımlılıkları dışarıdan alır, böylece rota birim testinde gerçek
 * isteklerle denenir (oturumlu 200 / oturumsuz 403).
 *
 * Kural (son kart düzeltmeleri, 2026-11-01): `storage/` yalnızca giriş yapmış admine servis edilir; oturumsuz
 * her istek 403. Oturum açmış admin ONAYSIZ vitrin görselini de görür — onay kuyruğu küçük resmi, taslak
 * ekranı ve indirme aynı adresi kullanır. Onaysız vitrinin dışarı çıkışını engelleyen kapı imzalı, oturumsuz
 * `/api/public-media` adresindedir (Instagram'ın indirdiği yol) ve orada 403 kalır.
 */

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

export interface StorageFileDeps {
  hasSession: () => Promise<boolean>;
  readFile: (bucket: StorageBucket, fileName: string) => Promise<Buffer | null>;
}

export const STORAGE_FILE_UNAUTHORIZED = "Yetkisiz";

export function createStorageFileHandler(deps: StorageFileDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!(await deps.hasSession())) return new Response(STORAGE_FILE_UNAUTHORIZED, { status: 403, headers: { "Cache-Control": "no-store" } });

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
    const data = await deps.readFile(bucket, fileName);
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
  };
}
