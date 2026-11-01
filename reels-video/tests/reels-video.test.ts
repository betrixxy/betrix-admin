import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cropFor, focusOrigin, placeCrop } from "../src/lib/crop";
import { buildTimeline, countUp, dotOrder, ofTen, SAFE, splitDots, TRANSITION_FRAMES, WIDTH, HEIGHT } from "../src/lib/motion";
import { SAMPLES } from "../src/samples";
import { reelScriptSchema, type ReelScript } from "../src/schema";

const scripts = Object.values(SAMPLES);

/** betrix `banned-words.ts` listesi: kart metinleri bu kapıdan geçer. */
const BANNED = /(^|[^\p{L}\p{N}])(ms1|msx|ms2|kg|alt|üst|oran|bahis\p{L}*|iddaa\p{L}*|kupon\p{L}*|banko\p{L}*|market\p{L}*|karşılıklı gol\p{L}*|odds|btts|handikap|handicap)(?![\p{L}\p{N}])/iu;
const texts = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(texts);
  if (value && typeof value === "object") return Object.values(value).flatMap(texts);
  return [];
};

describe("ReelScript şeması", () => {
  it("örnekler geçerli", () => {
    for (const script of scripts) assert.ok(reelScriptSchema.safeParse(script).success);
  });
  it("bilinmeyen alan ve bozuk renk hata", () => {
    const script = scripts[0] as ReelScript;
    assert.equal(reelScriptSchema.safeParse({ ...script, extra: 1 }).success, false);
    assert.equal(reelScriptSchema.safeParse({ ...script, brand: { ...script.brand, accent: "yeşil" } }).success, false);
    assert.equal(reelScriptSchema.safeParse({ ...script, scenes: [{ ...script.scenes[0], type: "YOK" }] }).success, false);
  });
  it("metinlerde bahis dili yok", () => {
    for (const script of scripts) {
      const found = texts(script).filter((text) => !/^(placeholders|brand|fonts)\//.test(text)).filter((text) => BANNED.test(text));
      assert.deepEqual(found, []);
    }
  });
  it("sahne sırası istenen sıra, süre 35–40 sn", () => {
    for (const script of scripts) {
      assert.deepEqual(script.scenes.map((scene) => scene.type), ["K0_COVER", "K1_LOGO", "M1_HOOK", "M3_WINNER", "M4_GOALS", "M6_FIRST_GOAL", "K9_CHANCE_NOTE", "K11_PROMPT", "K12_CLOSE"]);
      const seconds = buildTimeline(script.scenes.map((scene) => scene.durationInFrames)).total / 30;
      assert.ok(seconds >= 35 && seconds <= 40, String(seconds));
      assert.equal(script.scenes[0]?.durationInFrames, 15);
      assert.equal(script.scenes[1]?.durationInFrames, 30);
      assert.equal(script.scenes.at(-1)?.durationInFrames, 60);
    }
  });
  it("noktalar toplam 1000 ve yüzdelerle tutarlı", () => {
    for (const script of scripts) {
      const scene = script.scenes.find((item) => item.type === "M3_WINNER");
      assert.ok(scene?.type === "M3_WINNER");
      const { home, draw, away, dots } = scene.data;
      assert.equal(dots.home + dots.draw + dots.away, 1000);
      assert.ok(Math.abs(dots.home / 10 - home) <= 1 && Math.abs(dots.draw / 10 - draw) <= 1 && Math.abs(dots.away / 10 - away) <= 1);
    }
  });
});

describe("sayaç", () => {
  it("hep artar, hedefi aşmaz, son karede tam oturur", () => {
    for (const to of [500000, 74, 9, 1, 0]) {
      let previous = 0;
      for (let frame = 0; frame <= 160; frame += 1) {
        const value = countUp(frame, { to, start: 20, duration: 110 });
        assert.ok(value >= previous, `${to}@${frame}`);
        assert.ok(value <= to);
        previous = value;
      }
      assert.equal(countUp(130, { to, start: 20, duration: 110 }), to);
      assert.equal(countUp(20, { to, start: 20, duration: 110 }), 0);
    }
  });
});

describe("nokta ve zaman yardımcıları", () => {
  it("nokta dağılımı toplamı tam", () => {
    assert.deepEqual(splitDots([0.38, 0.3, 0.32], 1000), [380, 300, 320]);
    assert.equal(splitDots([0.333, 0.333, 0.334], 1000).reduce((a, b) => a + b, 0), 1000);
  });
  it("karıştırma tekrarlanabilir ve eksiksiz", () => {
    const order = dotOrder(1000, 7);
    assert.deepEqual(order, dotOrder(1000, 7));
    assert.equal(new Set(order).size, 1000);
    assert.notDeepEqual(order, dotOrder(1000, 8));
  });
  it("sahneler üst üste biner, boşluk olmaz", () => {
    const { entries, total } = buildTimeline([15, 30, 180]);
    assert.deepEqual(entries.map((entry) => entry.from), [0, 15 - TRANSITION_FRAMES, 15 + 30 - 2 * TRANSITION_FRAMES]);
    assert.equal(total, 225 - 2 * TRANSITION_FRAMES);
    for (let index = 1; index < entries.length; index += 1) {
      const previous = entries[index - 1];
      assert.ok(previous && (entries[index]?.from ?? 0) < previous.from + previous.duration);
    }
  });
  it("iyelik eki", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(ofTen), ["1'i", "2'si", "3'ü", "4'ü", "5'i", "6'sı", "7'si", "8'i", "9'u", "10'u"]);
  });
  it("güvenli alan istenen değerler", () => {
    assert.deepEqual([SAFE.top, SAFE.bottom, SAFE.right], [220, 420, 140]);
    assert.deepEqual([WIDTH, HEIGHT], [1080, 1920]);
  });
});

describe("kırpma yardımcısı", () => {
  const photo = { aspect: 0.75, focus: { x: 0.5, y: 0.2 }, crops: { vertical: { x: 0.2, y: 0.1, width: 0.6, height: 0.8 }, square: { x: 0, y: 0, width: 1, height: 0.75 } } };

  it("çerçeveye göre kırpma seçer", () => {
    assert.equal(cropFor(photo, { width: 500, height: 900 }), photo.crops.vertical);
    assert.equal(cropFor(photo, { width: 800, height: 800 }), photo.crops.square);
  });
  it("kırpma kutusu çerçeveyi kaplar", () => {
    const frame = { width: 480, height: 640 };
    const place = placeCrop(photo.crops.vertical, photo.aspect, frame);
    assert.ok(place.left <= 0 && place.top <= 0);
    const boxWidth = photo.crops.vertical.width * place.width;
    const boxHeight = photo.crops.vertical.height * place.height;
    assert.ok(boxWidth >= frame.width - 0.01 && boxHeight >= frame.height - 0.01, `${boxWidth}x${boxHeight}`);
    assert.ok(Math.abs(place.width / place.height - photo.aspect) < 1e-9, "oran korunur");
  });
  it("tam kare kırpma çerçeveyi tam doldurur", () => {
    const place = placeCrop({ x: 0, y: 0, width: 1, height: 1 }, 0.75, { width: 300, height: 400 });
    assert.deepEqual(place, { width: 300, height: 400, left: 0, top: 0 });
  });
  it("odak noktası çerçevede", () => {
    const origin = focusOrigin(photo, { width: 480, height: 640 });
    assert.ok(origin.x > 40 && origin.x < 60, String(origin.x));
    assert.ok(origin.y > -0.01 && origin.y < 50, String(origin.y));
  });
});
