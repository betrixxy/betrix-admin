import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { planCrop } from "@/lib/dashboard/match-photo/crop";
import { decodeYunet, nms, scanRegions, type FaceBox } from "@/lib/dashboard/match-photo/faces";
import { splitTone } from "@/lib/dashboard/match-photo/grade";
import { shadeStrengthFor } from "@/lib/dashboard/match-photo/legibility";
import { checkPhotoQuality, laplacianVariance, measureSharpness, MIN_SHARPNESS, photoUpscaleFactor } from "@/lib/dashboard/match-photo/quality";
import { inspectImageBytes, type UploadedImage } from "@/lib/dashboard/studio-images";
import { shadeStops } from "@/skills/render-engine/templates/match-result/shared";
import { matchResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";

/** Sentetik "fotoğraf": keskin kenarlı dama + çizgiler (gerçek fotoğraf repoya girmez). */
async function syntheticPhoto(width: number, height: number, blurSigma = 0): Promise<Buffer> {
  const cells = Array.from({ length: 24 }, (_, i) =>
    `<rect x="${(i % 6) * (width / 6)}" y="${Math.floor(i / 6) * (height / 4)}" width="${width / 12}" height="${height / 8}" fill="${i % 2 ? "#e8e8e8" : "#1a1a1a"}"/>`,
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#6a7a5a"/>${cells}<path d="M0 ${height / 2} L${width} ${height / 3}" stroke="#fff" stroke-width="3"/></svg>`;
  const base = sharp(Buffer.from(svg));
  return (blurSigma > 0 ? base.blur(blurSigma) : base).jpeg({ quality: 92 }).toBuffer();
}

async function uploaded(bytes: Buffer): Promise<UploadedImage> {
  const result = await inspectImageBytes(bytes, "test");
  assert.ok(result.ok);
  return result.data;
}

describe("kalite kapısı", () => {
  it("Laplacian varyansı: düz görselde 0, kenarlıda pozitif", () => {
    assert.equal(laplacianVariance(new Uint8Array(25).fill(90), 5, 5), 0);
    const edge = new Uint8Array(25);
    for (let i = 0; i < 25; i++) edge[i] = i % 5 >= 2 ? 255 : 0;
    assert.ok(laplacianVariance(edge, 5, 5) > 1000);
  });

  it("net sentetik fotoğraf eşiği geçer, aynı kare bulanıkken (σ=6) geçemez", async () => {
    const sharpScore = await measureSharpness(await syntheticPhoto(1800, 1200));
    const softScore = await measureSharpness(await syntheticPhoto(1800, 1200, 6));
    assert.ok(sharpScore >= MIN_SHARPNESS, `net: ${sharpScore}`);
    assert.ok(softScore < MIN_SHARPNESS, `bulanık: ${softScore}`);
  });

  it("kısa kenar < 1080 → büyütme katsayısı; yeterliyse 1", () => {
    assert.equal(photoUpscaleFactor({ width: 1920, height: 1080 }), 1);
    assert.equal(photoUpscaleFactor({ width: 800, height: 600 }), 2);
    assert.equal(photoUpscaleFactor({ width: 300, height: 200 }), 4);
  });

  it("bulanık fotoğraf büyütmeden sonra da yumuşaksa kart üretilmez (sebep mesajda)", async () => {
    const small = await uploaded(await syntheticPhoto(900, 600, 6));
    let calls = 0;
    const result = await checkPhotoQuality(small, async (image, scale) => {
      calls++;
      return uploaded(await sharp(image.bytes).resize(image.width * scale).jpeg().toBuffer()).then((data) => ({ ok: true as const, data }));
    });
    assert.equal(calls, 1);
    assert.ok(!result.ok);
    assert.equal(result.error.code, "PHOTO_TOO_SOFT");
    assert.match(result.error.message, /AI büyütmeden sonra da/);
  });

  it("yeterli ve net fotoğraf Fal'a gitmez, uyarı almaz", async () => {
    const result = await checkPhotoQuality(await uploaded(await syntheticPhoto(2400, 1600)), () => assert.fail("büyütme çağrılmamalı"));
    assert.ok(result.ok);
    assert.deepEqual([result.data.upscaled, result.data.paidCalls], [false, 0]);
    assert.deepEqual(result.data.warnings, []);
  });

  it("kısa kenar < 1500: kart üretilir ama bilgi uyarısı verilir (upscale sonrası da kaynağa bakılır)", async () => {
    const midsize = await checkPhotoQuality(await uploaded(await syntheticPhoto(1800, 1200)), () => assert.fail("büyütme çağrılmamalı"));
    assert.ok(midsize.ok);
    assert.equal(midsize.data.warnings.length, 1);
    assert.match(midsize.data.warnings[0] ?? "", /Fotoğraf küçük, sonuç yumuşak olabilir — daha büyük kaynak önerilir \(kısa kenar 1200px\)/);

    const small = await uploaded(await syntheticPhoto(1000, 700));
    const upscaled = await checkPhotoQuality(small, async (image, scale) => ({ ok: true, data: await uploaded(await sharp(image.bytes).resize(image.width * scale).jpeg().toBuffer()) }));
    assert.ok(upscaled.ok);
    assert.match(upscaled.data.warnings[0] ?? "", /kısa kenar 700px/);
  });
});

describe("yüz tespiti — çözüm ve birleştirme", () => {
  it("YuNet çıktısı: skor √(cls·obj), merkez (hücre+Δ)·adım, boyut e^Δ·adım", () => {
    const cls8 = new Float32Array(6400);
    const obj8 = new Float32Array(6400);
    const bbox8 = new Float32Array(6400 * 4);
    const index = 10 * 80 + 20; // satır 10, sütun 20
    cls8[index] = 0.9;
    obj8[index] = 0.9;
    bbox8.set([0.5, 0.5, Math.log(4), Math.log(5)], index * 4);
    const [face] = decodeYunet({ cls_8: cls8, obj_8: obj8, bbox_8: bbox8 });
    assert.ok(face);
    assert.ok(Math.abs(face.score - 0.9) < 1e-6);
    assert.deepEqual([face.x, face.y, face.width, face.height].map((v) => Math.round(v)), [148, 64, 32, 40]);
  });

  it("NMS çakışan kutuların en yüksek skorlusunu tutar", () => {
    const a: FaceBox = { x: 0, y: 0, width: 10, height: 10, score: 0.9 };
    const b: FaceBox = { x: 1, y: 1, width: 10, height: 10, score: 0.7 };
    const c: FaceBox = { x: 50, y: 50, width: 10, height: 10, score: 0.8 };
    assert.deepEqual(nms([b, c, a]), [a, c]);
  });

  it("NMS büyük yüzün içindeki ikinci kutuyu (düşük IoU, yüksek kapsama) eler", () => {
    const outer: FaceBox = { x: 0, y: 0, width: 156, height: 212, score: 0.91 };
    const inner: FaceBox = { x: 3, y: 53, width: 81, height: 111, score: 0.69 };
    assert.deepEqual(nms([inner, outer]), [outer]);
  });

  it("büyük görsel örtüşen karolarla taranır, karolar görselin içinde kalır", () => {
    assert.equal(scanRegions(800, 600).length, 1);
    const regions = scanRegions(4000, 2667);
    assert.ok(regions.length > 4 && regions.length <= 13);
    for (const region of regions) assert.ok(region.left >= 0 && region.top >= 0 && region.left + region.width <= 4000 && region.top + region.height <= 2667);
  });
});

describe("akıllı kırpma", () => {
  const source = { width: 4000, height: 2667 };
  const face = (x: number, y: number, size = 120): FaceBox => ({ x, y, width: size, height: size * 1.2, score: 0.9 });

  // Dikeyde yüzler kadrajın ortasında (gerçek maç fotoğrafı tipik) → otomatik zoom yukarı taşır;
  // 16:9'da yazı sütunu sağda, yüzler fotoğrafın sol yarısında.
  const SCENES = { IG_PORTRAIT: [2900, 1300], STORY: [2900, 1300], IG_SQUARE: [2900, 1300], X_LANDSCAPE: [700, 900] } as const;
  for (const [id, [fx, fy]] of Object.entries(SCENES) as [keyof typeof SCENES, readonly [number, number]][]) {
    it(`${id}: yüzler yazısız bölgede, kadraj fotoğrafın içinde`, () => {
      const frame = MATCH_DAY_FRAMES[id];
      const g = matchResultGeometry(frame);
      const plan = planCrop({ source, frame, safe: g.photoSafe, faces: [face(fx, fy), face(fx + 250, fy - 50)], saliency: null });
      assert.equal(plan.anchor, "FACES");
      assert.ok(plan.facesInSafe, JSON.stringify(plan));
      assert.ok(plan.zoom >= 1 && plan.zoom <= 1.6);
      assert.ok(plan.box.left >= 0 && plan.box.top >= 0 && plan.box.left + plan.box.width <= source.width && plan.box.top + plan.box.height <= source.height);
      assert.ok(Math.abs(plan.box.width / plan.box.height - frame.width / frame.height) < 0.01);
    });
  }

  it("yüzler birlikte sığmıyorsa en büyük yüz esas alınır", () => {
    const frame = MATCH_DAY_FRAMES.IG_PORTRAIT;
    const g = matchResultGeometry(frame);
    const plan = planCrop({ source, frame, safe: g.photoSafe, faces: [face(200, 1200, 180), face(3600, 1300, 220)], saliency: null });
    assert.equal(plan.anchor, "LARGEST_FACE");
    assert.ok(plan.box.left > 2000);
  });

  it("küçük arka plan yüzleri (arkası dönük oyuncu) kadrajı yönlendirmez, güvenli ölçütüne girmez", () => {
    const frame = MATCH_DAY_FRAMES.IG_PORTRAIT;
    const g = matchResultGeometry(frame);
    // Ana yüz 220px; alt köşedeki 100px yüz (alanın %21'i) yazı bölgesine düşse de sorun sayılmaz.
    const plan = planCrop({ source, frame, safe: g.photoSafe, faces: [face(2600, 900, 220), face(2300, 2300, 100)], saliency: null });
    assert.equal(plan.anchor, "FACES");
    assert.ok(plan.facesInSafe, JSON.stringify(plan));
  });

  it("yüz yoksa saliency, o da yoksa merkez; elle kaydırma sınırda kalır", () => {
    const frame = MATCH_DAY_FRAMES.IG_PORTRAIT;
    const g = matchResultGeometry(frame);
    const salient = planCrop({ source, frame, safe: g.photoSafe, faces: [], saliency: { x: 3500, y: 1000 } });
    assert.equal(salient.anchor, "SALIENCY");
    const centered = planCrop({ source, frame, safe: g.photoSafe, faces: [], saliency: null });
    assert.equal(centered.anchor, "CENTER");
    assert.ok(Math.abs(centered.box.left - (source.width - centered.box.width) / 2) <= 1);
    const pushed = planCrop({ source, frame, safe: g.photoSafe, faces: [], saliency: null, offset: { x: 1, y: -1 } });
    assert.equal(pushed.box.left + pushed.box.width, source.width);
    const zoomed = planCrop({ source, frame, safe: g.photoSafe, faces: [], saliency: null, zoom: 1.5, offset: { x: 0, y: -1 } });
    assert.equal(zoomed.box.top, 0);
    assert.ok(zoomed.box.width < centered.box.width);
  });
});

describe("tonlama ve okunurluk", () => {
  it("split-tone: açık piksel vurguya, koyu piksel derin tona kayar; nötr gri bozulmaz", () => {
    const pixels = new Uint8Array([230, 230, 230, 30, 30, 30]);
    splitTone(pixels, [255, 107, 0], [11, 31, 79]);
    assert.ok((pixels[0] ?? 0) > (pixels[2] ?? 0), "açık ton turuncuya kaymalı (R > B)");
    assert.ok((pixels[5] ?? 0) >= (pixels[3] ?? 0), "koyu ton laciverte kaymalı (B ≥ R)");
    assert.ok(Math.abs((pixels[0] ?? 0) - 230) < 25);
  });

  it("gradyan gücü yazı bölgesinin parlaklığıyla artar, sınırlı kalır", () => {
    assert.equal(shadeStrengthFor(0.05), 0.2);
    assert.equal(shadeStrengthFor(0.9), 1);
    assert.ok(shadeStrengthFor(0.3) > shadeStrengthFor(0.2));
  });

  it("gradyan gücü arttıkça erken başlar ve koyulaşır; 0..1 dışı değer sınırlanır", () => {
    const soft = shadeStops(0.2);
    const strong = shadeStops(1);
    assert.ok(strong.lead > soft.lead && strong.mid > soft.mid && strong.solid > soft.solid);
    assert.deepEqual(shadeStops(5), strong);
  });
});
