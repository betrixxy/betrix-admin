import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { checkPhotoQuality, MIN_SHARPNESS, precheckSharpness, type PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";

/**
 * Kırpma önizlemesinde erken keskinlik uyarısı (2026-10-30): yumuşak fotoğraf önizlemeyi geçip üretimde
 * "keskinlik 2 < 45" ile düşüyordu. Ön denetim ücretsizdir (ESRGAN tetiklenmez) ve üretim kapısıyla aynı
 * mesajı verir; kısa kenar < 1080'de büyütmesiz ölçtüğünü söyler. Sentetik görseller.
 */

async function image(width: number, height: number, noisy: boolean) {
  const data = Buffer.alloc(width * height * 3);
  let seed = 11;
  for (let i = 0; i < data.length; i++) data[i] = noisy ? (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 23 : 90 + Math.round((i / data.length) * 40);
  const bytes = await sharp(data, { raw: { width, height, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
  const inspected = await inspectImageBytes(bytes, "Sentetik");
  assert.ok(inspected.ok);
  return inspected.data;
}

let upscaleCalls = 0;
const fakeUpscale: PhotoUpscaler = async () => {
  upscaleCalls += 1;
  return { ok: false, error: { code: "UPSCALE_DISABLED", message: "testte büyütme yok" } };
};

describe("keskinlik ön denetimi (önizleme)", () => {
  it("yumuşak, kısa kenar ≥ 1080: üretim kapısıyla BİREBİR aynı mesaj", async () => {
    const soft = await image(1200, 1500, false);
    const pre = await precheckSharpness(soft);
    assert.ok(pre.sharpness < MIN_SHARPNESS);
    assert.equal(pre.beforeUpscale, false);
    const gate = await checkPhotoQuality(soft, fakeUpscale);
    assert.equal(gate.ok, false);
    assert.equal(pre.warning, gate.ok ? null : gate.error.message);
    assert.match(pre.warning ?? "", /^Fotoğraf yeterince net değil: keskinlik \d+ < 45/u);
  });

  it("yumuşak, kısa kenar < 1080: büyütme çağrılmadan uyarı, büyütmesiz ölçüldüğünü söyler", async () => {
    upscaleCalls = 0;
    const pre = await precheckSharpness(await image(800, 1000, false));
    assert.equal(pre.beforeUpscale, true);
    assert.match(pre.warning ?? "", /AI büyütmeden önce, kaynakta ölçüldü/u);
    assert.equal(upscaleCalls, 0);
  });

  it("net (dokulu) fotoğraf: uyarı yok", async () => {
    const pre = await precheckSharpness(await image(1200, 1500, true));
    assert.ok(pre.sharpness >= MIN_SHARPNESS, String(pre.sharpness));
    assert.equal(pre.warning, null);
  });
});
