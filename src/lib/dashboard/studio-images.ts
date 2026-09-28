import { createHash } from "node:crypto";
import sharp from "sharp";
import type { Result } from "@/types/result";

import { MAX_UPLOAD_BYTES, PLAYER_MIN_SHORT_SIDE } from "@/lib/dashboard/image-limits";

export { MAX_UPLOAD_BYTES, PLAYER_MIN_SHORT_SIDE };

const EXTENSION_BY_FORMAT = { jpeg: "jpg", png: "png", webp: "webp" } as const;
type UploadExtension = (typeof EXTENSION_BY_FORMAT)[keyof typeof EXTENSION_BY_FORMAT];

export interface UploadedImage {
  bytes: Buffer;
  /** İçerik-adresli dosya adı için SHA-256 (bkz. CLAUDE.md 3.1 adım 2). */
  hash: string;
  extension: UploadExtension;
  /** Fal.ai'ye yüklerken kullanılan MIME tipi — sharp'ın algıladığı gerçek formattan türetilir. */
  contentType: string;
  width: number;
  height: number;
  hasAlpha: boolean;
}

function fail(code: string, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

/** Yüklenen dosyanın gerçekten JPEG/PNG/WebP olduğunu bayt içeriğinden doğrular (uzantıya güvenilmez). */
export async function inspectImageUpload(
  file: File,
  label: string,
  options: { minShortSide?: number } = {},
): Promise<Result<UploadedImage>> {
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail("FILE_TOO_LARGE", `${label} en fazla ${MAX_UPLOAD_BYTES / 1024 / 1024} MB olabilir.`);
  }
  return inspectImageBytes(Buffer.from(await file.arrayBuffer()), label, options);
}

/** Bayt dizisini doğrular — yükleme dışındaki kaynaklar (ör. medya kütüphanesindeki dosya) için. */
export async function inspectImageBytes(
  bytes: Buffer,
  label: string,
  options: { minShortSide?: number } = {},
): Promise<Result<UploadedImage>> {

  try {
    const { format, width, height, hasAlpha } = await sharp(bytes).metadata();
    const extension = format && format in EXTENSION_BY_FORMAT
      ? EXTENSION_BY_FORMAT[format as keyof typeof EXTENSION_BY_FORMAT]
      : undefined;

    if (!extension || !width || !height) {
      return fail("UNSUPPORTED_IMAGE", `${label} JPEG, PNG veya WebP olmalıdır.`);
    }
    if (options.minShortSide && Math.min(width, height) < options.minShortSide) {
      return fail(
        "IMAGE_TOO_SMALL",
        `${label} en az ${options.minShortSide}px kısa kenara sahip olmalıdır (yüklenen: ${width}×${height}).`,
      );
    }

    const hash = createHash("sha256").update(bytes).digest("hex");
    return {
      ok: true,
      data: { bytes, hash, extension, contentType: `image/${format}`, width, height, hasAlpha: hasAlpha === true },
    };
  } catch {
    return fail("UNSUPPORTED_IMAGE", `${label} okunamadı — geçerli bir görsel dosyası yükleyin.`);
  }
}

/**
 * Render şablonuna gömülecek küçültülmüş `data:` URI üretir. Şeffaf görseller PNG (alfa
 * korunur), diğerleri JPEG olarak gömülür: her SVG/tasarım aracı bu ikisini okur, WebP'yi
 * okumaz. Kaynağı bilinmeyen (ör. Fal.ai'den indirilen) baytlar için `hasAlpha` sharp
 * metadata'sından kendisi okunur; yüklenen bir dosya için zaten `inspectImageUpload`'dan gelir.
 */
export async function embedImageBytes(bytes: Buffer, maxSide: number, hasAlpha?: boolean): Promise<string> {
  const alpha = hasAlpha ?? (await sharp(bytes).metadata()).hasAlpha === true;
  const resized = sharp(bytes)
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true });

  if (alpha) {
    const png = await resized.png().toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  }
  const jpeg = await resized.jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

/** Orijinal dosya depolamada olduğu gibi kalır; yalnızca render şablonuna gömülecek küçük kopya üretilir. */
export function toEmbeddedDataUri(image: UploadedImage, maxSide: number): Promise<string> {
  return embedImageBytes(image.bytes, maxSide, image.hasAlpha);
}

/**
 * Fal.ai'nin geçici depolamasındaki bir sonucu kalıcı depolamamıza taşımak için indirir
 * (bkz. CLAUDE.md 3.1 adım 6 — Fal URL'leri saatler içinde geçersiz olur, sonuç asla
 * doğrudan referanslanmaz).
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Görsel indirilemedi (${url}): HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}
