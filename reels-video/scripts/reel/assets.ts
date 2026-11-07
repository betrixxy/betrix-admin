import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { prominentFaces } from "@/lib/dashboard/match-photo/crop";
import { detectFaces } from "@/lib/dashboard/match-photo/faces";
import type { ReelPhoto } from "../../src/schema";

/**
 * Videonun görsel varlıkları: oyuncu kesimi (gerekirse ESRGAN, sonra birefnet; yüz iyileştirme YOK) ve bulanık sahne zemini.
 * Gerçek fotoğraflar ve türevleri yalnız `public/_local/` (gitignore) ve maç klasörüne yazılır, repoya girmez.
 */

/** fal fiyat ucu (2026-11-06): birefnet/v2 ve esrgan 0,000575 USD / işlem saniyesi. Süre ağ + kuyruğu da içerir: üst sınırdır. */
export const FAL_USD_PER_SECOND = 0.000575;
const MIN_FACE_TOP = 0.14;
export const falSpend = { calls: 0, seconds: 0 };

const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const upright = async (file: string) => sharp(readFileSync(file)).rotate().jpeg({ quality: 95 }).toBuffer();

async function timed<T>(work: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await work();
  } finally {
    falSpend.calls += 1;
    falSpend.seconds += (Date.now() - started) / 1000;
  }
}

/** Kaynak + (gerekirse) büyütülmüş sürüm. Büyütme önbelleği uygulamanınkiyle aynı (`storage/generated`, kaynak özetiyle). */
async function workingImage(file: string, cache: string): Promise<{ bytes: Buffer; key: string }> {
  const bytes = await upright(file);
  const key = sha(readFileSync(file)).slice(0, 12);
  const { width = 0, height = 0 } = await sharp(bytes).metadata();
  const short = Math.min(width, height);
  if (short >= 1080) return { bytes, key };
  const stored = path.join(cache, `${key}-buyutulmus.jpg`);
  if (existsSync(stored)) return { bytes: readFileSync(stored), key };
  const { inspectImageBytes } = await import("@/lib/dashboard/studio-images");
  const { falPhotoUpscaler, hasCachedUpscale } = await import("@/lib/dashboard/match-photo/quality");
  const inspected = await inspectImageBytes(bytes, "Fotoğraf");
  if (!inspected.ok) throw new Error(`Fotoğraf okunamadı: ${path.basename(file)}`);
  const scale = Math.min(4, Math.ceil(1080 / short));
  const run = () => falPhotoUpscaler(inspected.data, scale);
  const upscaled = (await hasCachedUpscale(inspected.data)) ? await run() : await timed(run);
  if (!upscaled.ok) throw new Error(`Büyütme başarısız (${path.basename(file)}): ${upscaled.error.message}`);
  writeFileSync(stored, upscaled.data.bytes);
  return { bytes: upscaled.data.bytes, key };
}

/** Şeffaf kesim, kenar boşluğu kırpılmış; yüz kutuları kesimin kendi oranlarında. */
export async function prepareCutout(file: string, side: "home" | "away", cache: string, publicDir: string, slug: string): Promise<{ photo: ReelPhoto; faceCount: number; size: string }> {
  mkdirSync(cache, { recursive: true });
  const working = await workingImage(file, cache);
  const cutoutFile = path.join(cache, `${working.key}-cutout.png`);
  if (!existsSync(cutoutFile)) {
    const { removePlayerBackground } = await import("@/lib/services/fal");
    const { downloadImage } = await import("@/lib/dashboard/studio-images");
    const result = await timed(() => removePlayerBackground({ bytes: working.bytes, contentType: "image/jpeg" }));
    if (!result.ok) throw new Error(`Kesim başarısız (${path.basename(file)}): ${result.error.message}`);
    writeFileSync(cutoutFile, await downloadImage(result.data.transparentImageUrl));
  }
  const cutout = readFileSync(cutoutFile);
  const { info } = await sharp(cutout).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const left = -(info.trimOffsetLeft ?? 0);
  const top = -(info.trimOffsetTop ?? 0);
  // Yüz tespiti büyütülmüş tam karede (kesimle aynı boyut), kırpma ofsetiyle kesime taşınır.
  const faces = prominentFaces(await detectFaces(working.bytes, `reel-${working.key}`));
  const main = [...faces].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!main) throw new Error(`Kesimde yüz bulunamadı: ${path.basename(file)}`);
  // Baş kesimin üst kenarına dayanırsa (yakın plan) yerleşimde başlığın altına girer: üste şeffaf pay eklenir, yüz kutusu en az
  // %14'ten başlar. Görüntü kırpılmaz, yalnız boşluk eklenir (GS–Amed, Osimhen yakın planı, 11-06).
  const faceTop = (main.y - top) / info.height;
  const pad = faceTop < MIN_FACE_TOP ? Math.ceil(((MIN_FACE_TOP - faceTop) * info.height) / (1 - MIN_FACE_TOP)) : 0;
  const height = info.height + pad;
  const trimmed = await sharp(cutout).extract({ left, top, width: info.width, height: info.height }).extend({ top: pad, bottom: 0, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const face = { x: (main.x - left) / info.width, y: (main.y - top + pad) / height, width: main.width / info.width, height: main.height / height };
  const target = path.join(publicDir, "_local", "reel", slug, `${side}-${working.key}.png`);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, trimmed);
  const full = { x: 0, y: 0, width: 1, height: 1 };
  return {
    photo: { src: `_local/reel/${slug}/${side}-${working.key}.png`, aspect: info.width / height, side, focus: { x: face.x + face.width / 2, y: face.y + face.height / 2 }, faces: [face], crops: { vertical: full, square: full } },
    faceCount: faces.length,
    size: `${info.width}×${height}${pad ? ` (üstte ${pad} px pay)` : ""}`,
  };
}

/** Bulanık, karartılmış 1080×1920 zemin. `darkness` = parlaklık çarpanı (küçük = koyu). */
export async function prepareBackdrop(file: string, name: string, darkness: number, publicDir: string, slug: string): Promise<string> {
  const relative = `_local/reel/${slug}/bg-${name}-${Math.round(darkness * 100)}.jpg`;
  const target = path.join(publicDir, relative);
  if (!existsSync(target)) {
    mkdirSync(path.dirname(target), { recursive: true });
    const base = await sharp(await upright(file)).resize(1080, 1920, { fit: "cover", position: sharp.strategy.attention }).blur(22).modulate({ brightness: darkness, saturation: 0.85 }).jpeg({ quality: 86 }).toBuffer();
    writeFileSync(target, base);
  }
  return relative;
}

export const copyInto = (from: string, to: string) => { mkdirSync(path.dirname(to), { recursive: true }); copyFileSync(from, to); };
