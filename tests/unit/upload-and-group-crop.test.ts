import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { GROUP_MIN_FACES, planCrop } from "@/lib/dashboard/match-photo/crop";
import type { FaceBox } from "@/lib/dashboard/match-photo/faces";
import { cropAndGrade } from "@/lib/dashboard/match-photo/grade";
import { MAX_UPLOAD_BYTES } from "@/lib/dashboard/image-limits";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { CLIENT_MAX_LONG_SIDE, SAFE_REQUEST_BYTES, actionFailureMessage, formFileBytes, isNavigationError, planUpload, requestTooLargeMessage } from "@/lib/dashboard/upload-prep";

/**
 * Maç Sonucu çökmesi (2026-10-29, AC Milan takım fotoğrafı) regresyonu: büyük dosya, çok yüzlü takım
 * fotoğrafı, bozuk dosya. Sayfa çökmesinin kendisi istemci kancasında (`use-action-form.ts`) — burada onun
 * kullandığı saf kurallar ve sunucu tarafı kırpma/doğrulama sabitlenir.
 */

const frame = MATCH_DAY_FRAMES.IG_PORTRAIT;
const safe = { left: 80, top: 160, right: 1000, bottom: 900 };
const face = (x: number, y: number, size = 120): FaceBox => ({ x, y, width: size, height: size, score: 0.9 });

/** Takım fotoğrafı: 6000×4000, iki sıra halinde 11 yüz (300..5600 px boyunca). */
const TEAM = Array.from({ length: 11 }, (_, i) => face(300 + i * 500, i % 2 === 0 ? 1500 : 1800));

const allInside = (faces: FaceBox[], box: { left: number; top: number; width: number; height: number }) =>
  faces.every((f) => f.x >= box.left && f.y >= box.top && f.x + f.width <= box.left + box.width && f.y + f.height <= box.top + box.height);

describe("takım fotoğrafı kırpması — bütün yüzler kadrajda", () => {
  it(`≥ ${GROUP_MIN_FACES} belirgin yüz: dar (4:5) kadraja sığmıyor → kadraj taşar, hiçbir oyuncu kesilmez`, () => {
    const plan = planCrop({ source: { width: 6000, height: 4000 }, frame, safe, faces: TEAM, saliency: null });
    assert.equal(plan.anchor, "GROUP_FIT");
    assert.ok(allInside(TEAM, plan.box), JSON.stringify(plan.box));
    assert.ok(plan.box.width > 3200, "tam kadraj genişliğinden (4000 × 0,8) geniş");
    assert.ok(Math.abs(plan.box.width / plan.box.height - frame.width / frame.height) < 0.01, "kart oranı korunur");
  });

  it("grup tam kadraja sığıyorsa kadraj taşmaz (GROUP), yine bütün yüzler içeride", () => {
    const tight = Array.from({ length: 6 }, (_, i) => face(2200 + i * 260, 1600));
    const plan = planCrop({ source: { width: 6000, height: 4000 }, frame, safe, faces: tight, saliency: null });
    assert.equal(plan.anchor, "GROUP");
    assert.ok(plan.box.left >= 0 && plan.box.left + plan.box.width <= 6000);
    assert.ok(allInside(tight, plan.box));
  });

  it("eskiden olduğu gibi: 4 ve daha az yüzde en büyük yüz kuralı değişmez", () => {
    const few = [face(500, 1500, 300), face(2500, 1500, 200), face(4500, 1500, 200), face(5500, 1500, 200)];
    const plan = planCrop({ source: { width: 6000, height: 4000 }, frame, safe, faces: few, saliency: null });
    assert.notEqual(plan.anchor, "GROUP");
    assert.notEqual(plan.anchor, "GROUP_FIT");
  });

  it("elle zoom > 1 verilirse olağan kırpma (admin bilerek yakınlaştırır)", () => {
    const plan = planCrop({ source: { width: 6000, height: 4000 }, frame, safe, faces: TEAM, saliency: null, zoom: 1.3 });
    assert.ok(plan.box.left >= 0 && plan.box.left + plan.box.width <= 6000);
  });

  it("taşan kadraj kart boyutunda çizilir; taşan alan doldurulur (siyah/şeffaf boşluk yok)", async () => {
    const photo = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#c03030" } }).jpeg().toBuffer();
    const box = { left: -300, top: -500, width: 1800, height: 2250 };
    const art = await cropAndGrade(photo, box, frame, "#ffcc00", undefined);
    const meta = await sharp(art).metadata();
    assert.equal(meta.width, frame.width);
    assert.equal(meta.height, frame.height);
    const corner = await sharp(art).extract({ left: 0, top: 0, width: 4, height: 4 }).raw().toBuffer();
    assert.ok(corner[0]! > 30, "köşe dolgu rengi taşır (fotoğrafın bulanık hâli)");
  });
});

describe("yükleme öncesi hazırlık (tarayıcı kuralları)", () => {
  it("sınıra sığan dosya olduğu gibi gider (orijinal baytlar)", () => {
    assert.deepEqual(planUpload(5 * 1024 * 1024, 4000, 3000), { resize: false, width: 4000, height: 3000 });
  });

  it("8 MB üstü ya da 6000 px üstü küçültülür, oran korunur", () => {
    const big = planUpload(33 * 1024 * 1024, 6400, 4800);
    assert.equal(big.resize, true);
    assert.equal(Math.max(big.width, big.height), CLIENT_MAX_LONG_SIDE);
    assert.equal(big.height, 4500);
    const heavy = planUpload(MAX_UPLOAD_BYTES + 1, 5000, 3000);
    assert.deepEqual(heavy, { resize: true, width: 5000, height: 3000 }, "piksel sığıyorsa yalnızca yeniden kodlanır");
  });

  it("tek isteğe sığmayan form gönderilmez; mesaj boyutu söyler", () => {
    assert.equal(requestTooLargeMessage(SAFE_REQUEST_BYTES), null);
    assert.match(requestTooLargeMessage(33.5 * 1024 * 1024) ?? "", /33,5 MB/);
    const body = new FormData();
    body.set("photo", new File([new Uint8Array(1024)], "a.jpg", { type: "image/jpeg" }));
    body.set("note", "x");
    assert.equal(formFileBytes(body), 1024);
  });

  it("eylem istisnası tek satır; Next yönlendirmesi yakalanmaz", () => {
    assert.match(actionFailureMessage(0), /form ve seçtiğiniz fotoğraf korunuyor/);
    assert.equal(isNavigationError({ digest: "NEXT_REDIRECT;replace;/dashboard/drafts/x;307;" }), true);
    assert.equal(isNavigationError(new Error("Unexpected end of form")), false);
  });
});

describe("bozuk dosya — sunucu doğrulaması çökmez", () => {
  it("rastgele baytlar 'geçerli görsel değil' hatası döner (istisna yok)", async () => {
    const result = await inspectImageBytes(Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 7919) % 256)), "Fotoğraf");
    assert.equal(result.ok, false);
  });

  it("yarıda kesilmiş JPEG reddedilir", async () => {
    const full = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: "#336699" } }).jpeg().toBuffer();
    const result = await inspectImageBytes(full.subarray(0, Math.floor(full.length / 3)), "Fotoğraf");
    assert.equal(result.ok, false);
  });
});
