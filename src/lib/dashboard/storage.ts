import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Yerel dosya depolaması (bkz. CLAUDE.md 1.6): `public/` dışında, proje kökünde `storage/`.
 * Dosyalara doğrudan URL yoktur; yalnızca oturum doğrulayan `/api/files/...` üzerinden servis edilir.
 */
const STORAGE_ROOT = path.join(process.cwd(), "storage");

export const STORAGE_BUCKETS = ["uploads", "generated", "renders", "library"] as const;
export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function isStorageBucket(value: string): value is StorageBucket {
  return STORAGE_BUCKETS.some((bucket) => bucket === value);
}

/** Yol gezinmesini (`..`, `/`, `\`) engelleyen katı dosya adı kontrolü. */
export function isSafeFileName(name: string): boolean {
  return SAFE_FILE_NAME.test(name) && !name.includes("..");
}

function resolveStoredPath(bucket: StorageBucket, fileName: string): string {
  if (!isSafeFileName(fileName)) throw new Error(`Geçersiz dosya adı: ${fileName}`);
  return path.join(STORAGE_ROOT, bucket, fileName);
}

export function storedFileUrl(bucket: StorageBucket, fileName: string): string {
  return `/api/files/${bucket}/${fileName}`;
}

/** `/api/files/<bucket>/<dosya>` biçimindeki URL'den kovayı ve adı çıkarır. */
export function parseStoredFileUrl(url: string | null | undefined): { bucket: StorageBucket; fileName: string } | null {
  if (!url) return null;
  const match = /^\/api\/files\/([a-z]+)\/([^/]+)$/.exec(url);
  const bucket = match?.[1];
  const fileName = match?.[2];
  if (!bucket || !fileName || !isStorageBucket(bucket) || !isSafeFileName(fileName)) return null;
  return { bucket, fileName };
}

export async function saveStoredFile(bucket: StorageBucket, fileName: string, data: Buffer): Promise<string> {
  const filePath = resolveStoredPath(bucket, fileName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, data);
  return storedFileUrl(bucket, fileName);
}

export async function readStoredFile(bucket: StorageBucket, fileName: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveStoredPath(bucket, fileName));
  } catch {
    return null;
  }
}

/** Dosya zaten yoksa sessizce geçer. */
export async function deleteStoredFile(bucket: StorageBucket, fileName: string): Promise<void> {
  try {
    await unlink(resolveStoredPath(bucket, fileName));
  } catch {
    /* zaten silinmiş */
  }
}
