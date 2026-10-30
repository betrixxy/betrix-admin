import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { GROUP_MIN_FACES, planCrop, type Size } from "@/lib/dashboard/match-photo/crop";
import type { FaceBox } from "@/lib/dashboard/match-photo/faces";
import { cropAndGrade, frameSpan, overflowPlacement } from "@/lib/dashboard/match-photo/grade";
import { drawPosterGeometry } from "@/skills/render-engine/templates/draw/geometry";
import { lineupGeometry } from "@/skills/render-engine/templates/lineup/lineup-geometry";
import { matchResultGeometry, type FrameBox } from "@/skills/render-engine/templates/match-result/geometry";
import { h2hPosterGeometry } from "@/skills/render-engine/templates/player-h2h/geometry";
import { spotlightGeometry } from "@/skills/render-engine/templates/player-stats/geometry";
import { posterGeometry } from "@/skills/render-engine/templates/vitrin/geometry";
import { MATCH_RESULT_TEMPLATE_IDS } from "@/types/match-result";

/**
 * Kırpma taşması (2026-10-30): dikey fotoğraf + grup kadrajında (`GROUP_FIT`) parça karttan 1 px taşıyordu →
 * sharp "Image to composite must have same dimensions or smaller" (Maç Sonucu kırpma önizlemesi sunucu
 * istisnası). Kırpma kullanan BÜTÜN kartların kadraj/yazısız bölge ölçüleriyle dikey, yatay, kare kaynak ve
 * grup fotoğrafı (≥ 5 belirgin sentetik yüz, dedektör yerine) planlanır: yerleşim (saf) her durumda kartın içinde;
 * her kart ailesi ayrıca gerçekten çizilir (sharp), çıktı tam kart boyutunda.
 * Sentetik görseller — gerçek maç fotoğrafı yok.
 */

const SOURCES: Record<string, Size> = { dikey: { width: 1200, height: 1500 }, yatay: { width: 1500, height: 1000 }, kare: { width: 1200, height: 1200 }, telefon: { width: 1080, height: 1920 } };
const images = new Map<string, Promise<Buffer>>();

/** Gürültülü sentetik görsel (yumuşak düz renk değil — gerçekçi doku). */
function synthetic(size: Size): Promise<Buffer> {
  const key = `${size.width}x${size.height}`;
  let image = images.get(key);
  if (!image) {
    const data = Buffer.alloc(size.width * size.height * 3);
    let seed = 17;
    for (let i = 0; i < data.length; i++) data[i] = (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 23;
    image = sharp(data, { raw: { width: size.width, height: size.height, channels: 3 } }).jpeg({ quality: 85 }).toBuffer();
    images.set(key, image);
  }
  return image;
}

const face = (x: number, y: number, size: number): FaceBox => ({ x, y, width: size, height: size, score: 0.9 });
/** Tek oyuncu: kaynağın sağ üçte birinde. */
const single = (s: Size) => [face(s.width * 0.6, s.height * 0.25, Math.min(s.width, s.height) * 0.12)];
/** Takım fotoğrafı: kaynağın neredeyse tamamına yayılmış 7 yüz (dar kartta kadraj taşar). */
const group = (s: Size) => Array.from({ length: GROUP_MIN_FACES + 2 }, (_, i) => face(s.width * (0.03 + i * 0.135), s.height * (i % 2 ? 0.3 : 0.38), Math.min(s.width, s.height) * 0.08));

interface CardCase {
  card: string;
  frame: Size;
  safe: FrameBox;
}

const cases: CardCase[] = [];
for (const id of ["IG_PORTRAIT", "IG_SQUARE", "STORY", "X_LANDSCAPE"] as const) {
  const frame = MATCH_DAY_FRAMES[id];
  for (const template of MATCH_RESULT_TEMPLATE_IDS) cases.push({ card: `Maç Sonucu ${template} ${id}`, frame, safe: matchResultGeometry(frame, "right", template).photoSafe });
  cases.push({ card: `Oyuncu İstatistikleri A ${id}`, frame, safe: spotlightGeometry(frame, { hero: [], rows: [], fact: null }).photo.photoSafe });
}
for (const id of ["IG_PORTRAIT", "X_LANDSCAPE"] as const) {
  const frame = MATCH_DAY_FRAMES[id];
  const size = (box: FrameBox) => ({ width: box.right - box.left, height: box.bottom - box.top });
  const vitrin = posterGeometry(frame).photo;
  cases.push({ card: `Vitrin ev ${id}`, frame: size(vitrin.panels.home), safe: vitrin.safe.home });
  cases.push({ card: `Vitrin deplasman ${id}`, frame: size(vitrin.panels.away), safe: vitrin.safe.away });
  const h2h = h2hPosterGeometry(frame).photo;
  cases.push({ card: `Oyuncu Karşılaştırması ${id}`, frame: size(h2h.panels.home), safe: h2h.safe.home });
  const draw = drawPosterGeometry(frame, false).photo;
  const region = draw.region;
  cases.push({ card: `Kura ${id}`, frame: size(region), safe: { left: draw.safe.left - region.left, right: draw.safe.right - region.left, top: draw.safe.top - region.top, bottom: draw.safe.bottom - region.top } });
}
for (const format of ["post", "story", "landscape", "square"] as const) {
  const { box, safe } = lineupGeometry(format).photo;
  cases.push({ card: `Kahraman Liste ${format}`, frame: { width: box.right - box.left, height: box.bottom - box.top }, safe });
}

async function render(source: Size, frame: Size, safe: FrameBox, faces: FaceBox[]) {
  const plan = planCrop({ source, frame, safe, faces, saliency: null });
  const art = await cropAndGrade(await synthetic(source), plan.box, { ...MATCH_DAY_FRAMES.IG_PORTRAIT, width: frame.width, height: frame.height }, "#ffcc00", undefined);
  const meta = await sharp(art).metadata();
  return { plan, meta };
}

describe("frameSpan — taşan kadrajın kart eksenindeki parçası", () => {
  it("uçlar ayrı yuvarlanır: parça hiçbir zaman kartı aşmaz (eski hata: 671/0,99 → 1 px fazla)", () => {
    // 1080×1920 kaynak, 16:9 kart, GROUP_FIT kutusu {left −59, top 243, 1192×671} — eski kodda 676 px yükseklik.
    const frame = MATCH_DAY_FRAMES.X_LANDSCAPE;
    const y = frameSpan(243, 671, 243, 671 / frame.height, frame.height);
    assert.deepEqual(y, { offset: 0, size: frame.height });
    const x = frameSpan(0, 1080, -59, 1192 / frame.width, frame.width);
    assert.ok(x.offset >= 0 && x.offset + x.size <= frame.width, JSON.stringify(x));
  });

  it("kaynak dışına taşan (negatif) başlangıç ve karttan büyük aralık karta sıkıştırılır", () => {
    assert.deepEqual(frameSpan(0, 5000, 100, 1, 1080), { offset: 0, size: 1080 });
    const tail = frameSpan(2000, 50, 0, 2, 1080);
    assert.ok(tail.offset + tail.size <= 1080 && tail.size >= 1);
  });

  it("rastgele kutularda (10 000) parça her zaman kartın içinde ve en az 1 px", () => {
    let seed = 3;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 10_000; i++) {
      const frameSize = 300 + Math.floor(rnd() * 1700);
      const boxSize = 200 + rnd() * 6000;
      const boxStart = -rnd() * 800;
      const start = Math.max(0, boxStart);
      const size = Math.max(1, Math.min(boxSize + boxStart, 100 + rnd() * 5000) - start);
      const span = frameSpan(start, size, boxStart, boxSize / frameSize, frameSize);
      assert.ok(span.offset >= 0 && span.size >= 1 && span.offset + span.size <= frameSize, JSON.stringify({ frameSize, boxSize, boxStart, size, span }));
    }
  });
});

describe("kırpma kullanan bütün kartlar — dikey / yatay / kare / telefon kaynak, tek yüz ve grup", () => {
  it("gözlenen hata: 2400×3000 dikey grup fotoğrafı, Maç Sonucu 4:5 ve 16:9 — istisna yok, kart boyutunda", async () => {
    const source = { width: 2400, height: 3000 };
    for (const id of ["IG_PORTRAIT", "X_LANDSCAPE"] as const) {
      const frame = MATCH_DAY_FRAMES[id];
      const { meta } = await render(source, frame, matchResultGeometry(frame).photoSafe, group(source));
      assert.equal(meta.width, frame.width);
      assert.equal(meta.height, frame.height);
    }
  });

  it("1080×1920 telefon fotoğrafı, grup, 16:9 (taşmanın birebir yeniden üretimi)", async () => {
    const frame = MATCH_DAY_FRAMES.X_LANDSCAPE;
    const source = SOURCES.telefon ?? { width: 1080, height: 1920 };
    const { plan, meta } = await render(source, frame, matchResultGeometry(frame).photoSafe, group(source));
    assert.equal(plan.anchor, "GROUP_FIT");
    assert.deepEqual([meta.width, meta.height], [frame.width, frame.height]);
  });

  for (const testCase of cases) {
    it(testCase.card, () => {
      for (const [label, source] of Object.entries(SOURCES)) {
        for (const [kind, faces] of [["tek yüz", single(source)], ["grup", group(source)]] as const) {
          const plan = planCrop({ source, frame: testCase.frame, safe: testCase.safe, faces, saliency: null });
          const placement = overflowPlacement(plan.box, source, testCase.frame);
          const inside = plan.box.left >= 0 && plan.box.top >= 0 && plan.box.left + plan.box.width <= source.width && plan.box.top + plan.box.height <= source.height;
          // Kutu kaynağın içindeyse düz kırpma (taşma yok); taşıyorsa parça kartın içinde kalmalı.
          if (inside) continue;
          assert.ok(placement, `${label} ${kind}: kesişim yok`);
          for (const [axis, size] of [[placement.x, testCase.frame.width], [placement.y, testCase.frame.height]] as const) {
            assert.ok(axis.offset >= 0 && axis.size >= 1 && axis.offset + axis.size <= size, `${label} ${kind}: ${JSON.stringify({ box: plan.box, axis, size })}`);
          }
        }
      }
    });
  }

  it("her kart ailesi gerçekten çizilir: dikey grup fotoğrafı → tam kart boyutu", async () => {
    const families = new Map(cases.map((testCase) => [testCase.card.split(" ").slice(0, 2).join(" "), testCase]));
    const source = SOURCES.dikey ?? { width: 1200, height: 1500 };
    for (const [family, testCase] of families) {
      const { meta } = await render(source, testCase.frame, testCase.safe, group(source));
      assert.deepEqual([meta.width, meta.height], [testCase.frame.width, testCase.frame.height], family);
    }
  });
});
