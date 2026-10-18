import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { flatBackgroundAlpha, logoSilhouette, transparentShare, type RgbaImage } from "@/lib/dashboard/logo-silhouette";

/** 40×40, düz zemin + ortada 20×20 kırmızı kare; `inner` verilirse karenin içinde zemin renkli 6×6 delik. */
function flatLogo(background: [number, number, number], inner = false): RgbaImage {
  const width = 40;
  const height = 40;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const square = x >= 10 && x < 30 && y >= 10 && y < 30;
      const hole = inner && x >= 17 && x < 23 && y >= 17 && y < 23;
      const [r, g, b] = square && !hole ? [220, 20, 40] : background;
      data.set([r, g, b, 255], o);
    }
  }
  return { data, width, height };
}

async function png(image: RgbaImage): Promise<Buffer> {
  return sharp(Buffer.from(image.data), { raw: { width: image.width, height: image.height, channels: 4 } }).png().toBuffer();
}

async function alphaOf(dataUri: string): Promise<Uint8Array> {
  const bytes = Buffer.from(dataUri.split(",")[1] ?? "", "base64");
  const { data } = await sharp(bytes).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  return new Uint8Array(data);
}

describe("turnuva rozeti — düz zemin temizleme", () => {
  it("beyaz zemin kenardan silinir, logo kalır, içteki zemin rengi korunur", () => {
    const alpha = flatBackgroundAlpha(flatLogo([255, 255, 255], true));
    assert.ok(alpha);
    assert.equal(alpha[0], 0); // köşe: zemin
    assert.equal(alpha[20 * 40 + 12], 255); // kare
    assert.equal(alpha[20 * 40 + 20], 255); // karenin içindeki beyaz delik kenara bağlı değil → korunur
    assert.ok(Math.abs(transparentShare(alpha) - 0.75) < 0.01);
  });

  it("köşeleri farklı renkte (fotoğraf/degrade) görselde null — rozet çizilmez", () => {
    const image = flatLogo([255, 255, 255]);
    image.data.set([0, 0, 0, 255], (39 * 40 + 39) * 4);
    assert.equal(flatBackgroundAlpha(image), null);
  });

  it("tamamen düz görsel (ön plan yok) null", () => {
    const image = flatLogo([255, 255, 255]);
    for (let i = 0; i < image.data.length; i += 4) image.data.set([255, 255, 255, 255], i);
    assert.equal(flatBackgroundAlpha(image), null);
  });
});

describe("turnuva rozeti — beyaz siluet", () => {
  it("şeffaf logo kendi alfasıyla siluete döner", async () => {
    const image = flatLogo([0, 0, 0]);
    for (let i = 0; i < image.data.length; i += 4) if (image.data[i] === 0) image.data[i + 3] = 0;
    const silhouette = await logoSilhouette(await png(image));
    assert.ok(silhouette);
    const alpha = await alphaOf(silhouette);
    assert.deepEqual([alpha[0], alpha[20 * 40 + 20]], [0, 255]);
  });

  it("beyaz kutulu (opak) logo: zemin temizlenir — beyaz kutu çıkmaz", async () => {
    const silhouette = await logoSilhouette(await png(flatLogo([255, 255, 255])));
    assert.ok(silhouette);
    const alpha = await alphaOf(silhouette);
    assert.equal(alpha[0], 0);
    assert.equal(alpha[20 * 40 + 20], 255);
  });

  it("temizlenemeyen opak görsel null", async () => {
    const image = flatLogo([255, 255, 255]);
    image.data.set([0, 0, 0, 255], 0);
    assert.equal(await logoSilhouette(await png(image)), null);
  });
});
