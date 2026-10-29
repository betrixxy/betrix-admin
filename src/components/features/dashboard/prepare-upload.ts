"use client";

import { CLIENT_LONG_SIDE_STEPS, CLIENT_QUALITIES, CLIENT_TARGET_BYTES, formatMegabytes, planUpload } from "@/lib/dashboard/upload-prep";

/**
 * Tarayıcıda yükleme öncesi hazırlık (kural: `lib/dashboard/upload-prep.ts`): dosya çözülebiliyor mu (bozuk
 * dosya yakalanır), sunucunun kabul edeceği boyutta mı; değilse 6000 px'e sığdırılıp yeniden kodlanır
 * (kalite yetmezse uzun kenar adım adım küçülür). Sığan dosya HİÇ değiştirilmez (orijinal baytlar).
 */

export type PreparedUpload =
  | { ok: true; file: File; note: string | null }
  | { ok: false; message: string };

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);

async function decode(file: File): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(file);
  } catch {
    return null;
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareUploadFile(file: File): Promise<PreparedUpload> {
  if (!ACCEPTED.has(file.type)) return { ok: false, message: `${file.name}: yalnızca JPEG, PNG ya da WebP yüklenebilir.` };
  const bitmap = await decode(file);
  if (!bitmap) return { ok: false, message: `${file.name} açılamadı — dosya bozuk ya da desteklenmeyen bir görsel.` };
  const plan = planUpload(file.size, bitmap.width, bitmap.height);
  if (!plan.resize) {
    bitmap.close();
    return { ok: true, file, note: null };
  }

  const original = { width: bitmap.width, height: bitmap.height };
  const longSide = Math.max(original.width, original.height);
  const first = Math.max(plan.width, plan.height);
  // Saydamlık taşıyabilen PNG/WebP → WebP (saydamlık korunur); JPEG → JPEG.
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
  try {
    for (const side of [first, ...CLIENT_LONG_SIDE_STEPS.filter((step) => step < first)]) {
      const scale = Math.min(1, side / longSide);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(original.width * scale));
      canvas.height = Math.max(1, Math.round(original.height * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of CLIENT_QUALITIES) {
        const blob = await encode(canvas, type, quality);
        if (blob && blob.size <= CLIENT_TARGET_BYTES) {
          const name = file.name.replace(/\.[^.]+$/u, "") + (type === "image/jpeg" ? ".jpg" : ".webp");
          const note = `Büyük fotoğraf yüklemeden önce küçültüldü: ${formatMegabytes(file.size)} · ${original.width}×${original.height} → ${formatMegabytes(blob.size)} · ${canvas.width}×${canvas.height}`;
          return { ok: true, file: new File([blob], name, { type, lastModified: file.lastModified }), note };
        }
      }
    }
  } finally {
    bitmap.close();
  }
  return { ok: false, message: `${file.name} (${formatMegabytes(file.size)}) yeterince küçültülemedi — daha küçük bir dosya seçin.` };
}
