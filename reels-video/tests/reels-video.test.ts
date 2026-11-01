import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { FONT_FILES, GLYPH_TEST, LICENSE_FILES } from "../src/components/typography";
import { cropFor, focusOrigin, placeCrop } from "../src/lib/crop";
import { glyphId, missingGlyphs } from "../src/lib/font-check";
import { faceOverlaps, facesOnCanvas, insideSafeArea, rectsOverlap, type Rect } from "../src/lib/layout-check";
import { buildTimeline, countUp, countUpTenths, HEIGHT, ofTen, SAFE, splitDots, TRANSITION_FRAMES, TYPE, WIDTH, withLocative, ZONES } from "../src/lib/motion";
import { LAYOUTS } from "../src/lib/photo-layouts";
import { DERBY, FAVOURITE, SAMPLE_KEYS, sampleScripts } from "../src/samples";
import { reelScriptSchema, type ReelScript } from "../src/schema";
import type { MatchData } from "../src/story/match-data";
import { betterSide, compareMetrics, formLetters, gapScore, pickKeyGap } from "../src/story/metrics";
import { BRAND, evaluatePool, MAX_STORY_SCENES, MIN_STORY_SCENES, PHOTOS, pickStory } from "../src/story/pool";
import { rollingScore } from "../src/story/rolling";
import { decideTrackRecord, MIN_COMPLETED_MATCHES } from "../src/story/track-record";

const scripts = SAMPLE_KEYS.map(sampleScripts);
const clone = (data: MatchData): MatchData => structuredClone(data);
const reasonOf = (data: MatchData, type: string) => evaluatePool(data, BRAND).find((entry) => entry.type === type)?.reason ?? null;

/** betrix `banned-words.ts` listesi (tam sözcük kuralıyla). */
const BANNED = /(^|[^\p{L}\p{N}])(ms1|msx|ms2|kg|alt|üst|oran|bahis\p{L}*|iddaa\p{L}*|kupon\p{L}*|banko\p{L}*|market\p{L}*|karşılıklı gol\p{L}*)(?![\p{L}\p{N}])/iu;
const texts = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(texts);
  if (value && typeof value === "object") return Object.values(value).flatMap(texts);
  return [];
};

describe("ReelScript", () => {
  it("örnekler geçerli; bilinmeyen alan ve bozuk renk hata", () => {
    for (const { story, pool } of scripts) {
      assert.ok(reelScriptSchema.safeParse(story).success);
      assert.ok(reelScriptSchema.safeParse(pool).success);
    }
    const script = scripts[0]?.story as ReelScript;
    assert.equal(reelScriptSchema.safeParse({ ...script, extra: 1 }).success, false);
    assert.equal(reelScriptSchema.safeParse({ ...script, brand: { ...script.brand, accent: "yeşil" } }).success, false);
    assert.equal(reelScriptSchema.safeParse({ ...script, scenes: [{ ...script.scenes[0], type: "YOK" }] }).success, false);
  });
  it("havuz 16 sahne, metinlerde bahis dili yok", () => {
    for (const { pool } of scripts) {
      assert.equal(pool.scenes.length, 16);
      assert.deepEqual(pool.disabled, []);
      const found = texts(pool.scenes).filter((text) => BANNED.test(text));
      assert.deepEqual(found, []);
    }
  });
  it("hikâye 12–14 sahne, 60–75 sn, kapak başta, özet sonda", () => {
    for (const { story } of scripts) {
      assert.ok(story.scenes.length >= MIN_STORY_SCENES && story.scenes.length <= MAX_STORY_SCENES, String(story.scenes.length));
      const seconds = buildTimeline(story.scenes.map((scene) => scene.durationInFrames)).total / 30;
      assert.ok(seconds >= 60 && seconds <= 75, String(seconds));
      assert.equal(story.scenes[0]?.type, "S01_COVER");
      assert.equal(story.scenes.at(-1)?.type, "S16_SUMMARY");
    }
  });
  it("logo açılışı geçiş sonrası net 0,8 sn", () => {
    const logo = scripts[0]?.pool.scenes.find((scene) => scene.type === "S02_LOGO");
    assert.equal((logo?.durationInFrames ?? 0) - TRANSITION_FRAMES, 24);
  });
  it("noktalar toplam 1000, yüzdelerle tutarlı", () => {
    for (const { pool } of scripts) {
      const scene = pool.scenes.find((item) => item.type === "S06_WINNER");
      assert.ok(scene?.type === "S06_WINNER");
      const { home, draw, away, dots } = scene.data;
      assert.equal(dots.home + dots.draw + dots.away, 1000);
      assert.ok(Math.abs(dots.home / 10 - home) <= 1 && Math.abs(dots.draw / 10 - draw) <= 1 && Math.abs(dots.away / 10 - away) <= 1);
    }
  });
});

describe("güvenilirlik satırı ve simülasyon sayısı", () => {
  it("simülasyon sözü yalnız kanca sahnesinde", () => {
    for (const { pool } of scripts) {
      for (const scene of pool.scenes) {
        const found = texts([scene.headline, scene.caption, scene.data]).filter((text) => /simülasyon|500 bin|500\.000/iu.test(text));
        if (scene.type !== "S03_HOOK") assert.deepEqual(found, [], scene.type);
      }
      assert.ok(texts(pool.scenes.find((scene) => scene.type === "S03_HOOK")?.headline).some((text) => /500 bin/.test(text)));
      assert.ok(!pool.scenes.some((scene) => "trust" in scene));
    }
  });
  it("kaynakta güvenilirlik satırı ve sahne içi simülasyon metni kalmadı", () => {
    for (const file of ["compare", "context", "outcome", "summary"]) {
      const source = readFileSync(`src/scenes/${file}.tsx`, "utf8");
      assert.ok(!source.includes("TrustLine"), file);
      assert.ok(!/simülasyon/iu.test(source.replace(/\/\*\*[\s\S]*?\*\//g, "")), file);
    }
  });
});

describe("tipografi", () => {
  it("her kesimde test dizesinin glifi var; denetim eksik glifi yakalar", () => {
    for (const font of FONT_FILES) {
      const buffer = readFileSync(`public/fonts/${font.file}`);
      assert.deepEqual(missingGlyphs(buffer, GLYPH_TEST), [], font.file);
      assert.deepEqual(missingGlyphs(buffer, "A\uE000"), ["\uE000"], font.file);
      assert.equal(glyphId(buffer, 0xe000), 0);
    }
  });
  it("en fazla 3 aile, hepsinin OFL lisansı dosyada", () => {
    assert.ok(new Set(FONT_FILES.map((font) => font.family)).size <= 3);
    assert.equal(LICENSE_FILES.length, new Set(FONT_FILES.map((font) => font.family)).size);
    for (const license of LICENSE_FILES) {
      assert.ok(existsSync(`public/fonts/${license}`), license);
      assert.match(readFileSync(`public/fonts/${license}`, "utf8"), /SIL OPEN FONT LICENSE/);
    }
  });
});

describe("sahne havuzu: eksik veri devre dışı + neden", () => {
  it("skor sahnesi yalnız score_scene_allowed", () => {
    const data = clone(DERBY);
    data.score_scene_allowed = false;
    assert.match(reasonOf(data, "S12_SCORE") ?? "", /çelişiyor/);
    assert.equal(reasonOf(DERBY, "S12_SCORE"), null);
  });
  it("golcü adayı yalnız season_xg_fresh", () => {
    const data = clone(DERBY);
    data.season_xg_fresh = false;
    assert.match(reasonOf(data, "S13_SCORER") ?? "", /güncel değil/);
    data.season_xg_fresh = true;
    data.season_xg_leaders.home = [];
    data.season_xg_leaders.away = [];
    assert.match(reasonOf(data, "S13_SCORER") ?? "", /xG verisi yok/);
  });
  it("kafa kafaya az maçta kapanır", () => {
    const data = clone(DERBY);
    data.h2h.matches = data.h2h.matches.slice(0, 2);
    assert.match(reasonOf(data, "S05_H2H") ?? "", /en az 3/);
  });
  it("Avrupa'da oynamayan iki takımda yorgunluk kapanır; 99 sayı olarak yazılmaz", () => {
    const data = clone(DERBY);
    data.form.home.euro_fatigue_days = 99;
    assert.match(reasonOf(data, "S11_FATIGUE") ?? "", /Avrupa/);
    const scene = evaluatePool(DERBY, BRAND).find((entry) => entry.type === "S11_FATIGUE")?.scene;
    assert.ok(scene?.type === "S11_FATIGUE");
    assert.deepEqual(scene.data.days, { home: 3, away: null });
  });
  it("karne: gerçek akışta örnek kaynak kapalı, ReelSnapshot'la 30 tamamlanmış maçtan önce kapalı", () => {
    assert.match(reasonOf(DERBY, "S14_TRACK_RECORD") ?? "", /Örnek karne/);
    const bucket = { from: 30, to: 40, matches: 40, hit_rate: 0.36 };
    assert.match(decideTrackRecord(null, 38).reason ?? "", /ReelSnapshot/);
    assert.match(decideTrackRecord({ source: "reel_snapshot", completed_matches: MIN_COMPLETED_MATCHES - 1, buckets: [bucket] }, 38).reason ?? "", /en az 30/);
    assert.equal(decideTrackRecord({ source: "reel_snapshot", completed_matches: MIN_COMPLETED_MATCHES, buckets: [bucket] }, 38).bucket, bucket);
    assert.match(decideTrackRecord({ source: "reel_snapshot", completed_matches: 500, buckets: [{ ...bucket, matches: 29 }] }, 38).reason ?? "", /aralığında/);
    // Örnek izni olsa bile eşik geçerli; izin yalnız örnek kaynağı için.
    assert.notEqual(decideTrackRecord({ source: "sample", completed_matches: 2, buckets: [bucket] }, 38, { allowSample: true }).reason, null);
  });
  it("karne kapalıyken iki hikâye de yedekten 12+ sahneyle kurulur", () => {
    for (const [data, angle] of [[DERBY, "derby"], [FAVOURITE, "favourite"]] as const) {
      const story = pickStory(evaluatePool(data, BRAND), angle);
      assert.ok(!story.some((scene) => scene.type === "S14_TRACK_RECORD"));
      assert.ok(story.length >= MIN_STORY_SCENES);
      assert.equal(story.at(-1)?.type, "S16_SUMMARY");
    }
  });
  it("eksik form, ilk gol ve simülasyon sıfır yazılmaz, sahne kapanır", () => {
    const data = clone(DERBY);
    data.form.home.last5 = null;
    assert.notEqual(reasonOf(data, "S04_COMPARE"), null);
    const first = clone(DERBY);
    first.first_goal.none = null;
    assert.notEqual(reasonOf(first, "S10_FIRST_GOAL"), null);
    const sim = clone(DERBY);
    sim.model.simulations = null;
    assert.notEqual(reasonOf(sim, "S03_HOOK"), null);
  });
  it("kapalı sahne hikâyeye girmez, yedekten tamamlanır", () => {
    const data = clone(FAVOURITE);
    data.season_xg_fresh = false;
    const story = pickStory(evaluatePool(data, BRAND), "favourite");
    assert.ok(!story.some((scene) => scene.type === "S13_SCORER"));
    assert.ok(story.length >= MIN_STORY_SCENES);
    assert.equal(story.at(-1)?.type, "S16_SUMMARY");
  });
});

describe("karşılaştırma ve kilit fark", () => {
  it("üstün taraf: düşük iyi metrikte ters", () => {
    assert.equal(betterSide({ home: 1.1, away: 1.2, lowerIsBetter: true }), "home");
    assert.equal(betterSide({ home: 1.1, away: 1.2, lowerIsBetter: false }), "away");
    assert.equal(betterSide({ home: 1, away: 1, lowerIsBetter: false }), null);
  });
  it("eksik metrik tabloya girmez", () => {
    const form = structuredClone(DERBY.form);
    form.home.clean_sheet_rate = null;
    assert.ok(!compareMetrics(form).some((metric) => metric.key === "clean_sheet"));
  });
  it("kilit fark ölçeğe göre seçilir: 10 maçta 1 maçlık fark öne geçmez", () => {
    assert.equal(pickKeyGap(compareMetrics(DERBY.form))?.key, "goals_for");
    assert.equal(pickKeyGap(compareMetrics(FAVOURITE.form))?.key, "goals_for");
    for (const metric of compareMetrics(FAVOURITE.form)) assert.ok(gapScore(metric) > 0);
  });
  it("belirgin fark yoksa sahne kapanır", () => {
    const data = clone(DERBY);
    data.form.away = { ...data.form.home };
    assert.equal(pickKeyGap(compareMetrics(data.form)), null);
    assert.match(reasonOf(data, "S07_KEY_GAP") ?? "", /belirgin/);
  });
  it("form harfleri: en yeni solda, en fazla 5", () => {
    assert.deepEqual(formLetters("WDLWWDD"), ["G", "B", "M", "G", "G"]);
    assert.deepEqual(formLetters(null), []);
  });
});

describe("yüz kuralı", () => {
  it("çakışma bulunur, değmeyen geçer", () => {
    const face = { x: 100, y: 100, width: 50, height: 50 };
    assert.ok(rectsOverlap(face, { x: 149, y: 149, width: 10, height: 10 }));
    assert.ok(!rectsOverlap(face, { x: 150, y: 100, width: 10, height: 10 }));
    assert.deepEqual(faceOverlaps([face], [{ name: "binen", x: 120, y: 90, width: 10, height: 30 }, { name: "uzak", x: 400, y: 400, width: 10, height: 10 }]), ["binen"]);
  });
  it("aynalı fotoğrafta yüz karşı tarafa düşer", () => {
    const photo = { aspect: 0.75, faces: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.2 }], crops: { vertical: { x: 0, y: 0, width: 1, height: 1 }, square: { x: 0, y: 0, width: 1, height: 0.75 } } };
    const frame = { width: 300, height: 400 };
    const plain = facesOnCanvas(photo, frame, { left: 0, top: 0 })[0];
    const flipped = facesOnCanvas(photo, frame, { left: 0, top: 0, flip: true })[0];
    assert.ok(plain && flipped);
    assert.ok(Math.abs(flipped.x - (300 - plain.x - plain.width)) < 1e-9);
  });
  it("her yerleşimde yüz içerik alanına girmez (zoom + parallax payıyla)", () => {
    const photo = PHOTOS["home-1"];
    assert.ok(photo);
    for (const [name, layout] of Object.entries(LAYOUTS)) {
      for (const slot of layout.slots) {
        const margin = 0.06 * slot.frame.width;
        const faces: Rect[] = facesOnCanvas(photo, slot.frame, slot).map((face) => ({ x: face.x - margin, y: face.y - margin, width: face.width + margin * 2, height: face.height + margin * 2 }));
        assert.ok(faces.length > 0);
        assert.deepEqual(faceOverlaps(faces, layout.reserved), [], name);
        for (const face of faces) assert.ok(face.y > ZONES.titleTop + 190, `${name}: başlık`);
      }
    }
  });
  it("yerleşimi bozulan fotoğraf yakalanır", () => {
    const photo = PHOTOS["home-1"];
    assert.ok(photo);
    const slot = { ...LAYOUTS.duel.slots[0], top: ZONES.mainTop };
    assert.ok(faceOverlaps(facesOnCanvas(photo, slot.frame, slot), LAYOUTS.duel.reserved).length > 0);
  });
});

describe("sayaç, zaman, biçim", () => {
  it("sayaç hep artar, hedefi aşmaz, tam oturur", () => {
    for (const to of [500000, 74, 9, 1, 0]) {
      let previous = 0;
      for (let frame = 0; frame <= 160; frame += 1) {
        const value = countUp(frame, { to, start: 20, duration: 110 });
        assert.ok(value >= previous && value <= to, `${to}@${frame}`);
        previous = value;
      }
      assert.equal(countUp(130, { to, start: 20, duration: 110 }), to);
    }
    assert.equal(countUpTenths(100, { to: 2.9, start: 0, duration: 50 }), 2.9);
  });
  it("nokta dağılımı toplamı tam", () => {
    assert.deepEqual(splitDots([0.38, 0.3, 0.32], 1000), [380, 300, 320]);
    assert.equal(splitDots([0.333, 0.333, 0.334], 1000).reduce((a, b) => a + b, 0), 1000);
  });
  it("dönen skor, kazanan ile tutarlı ve tekrarlanabilir", () => {
    const shares = { home: 74, draw: 17, away: 9 };
    let homeWins = 0;
    for (let seed = 0; seed < 2000; seed += 1) {
      const score = rollingScore(seed, shares);
      assert.deepEqual(score, rollingScore(seed, shares));
      if (score.winner === "home") { homeWins += 1; assert.ok(score.home > score.away); }
      if (score.winner === "away") assert.ok(score.away > score.home);
      if (score.winner === "draw") assert.equal(score.home, score.away);
    }
    assert.ok(Math.abs(homeWins / 2000 - 0.74) < 0.05, String(homeWins));
  });
  it("sahneler üst üste biner, boşluk olmaz", () => {
    const { entries, total } = buildTimeline([45, 32, 150]);
    assert.deepEqual(entries.map((entry) => entry.from), [0, 45 - TRANSITION_FRAMES, 77 - 2 * TRANSITION_FRAMES]);
    assert.equal(total, 227 - 2 * TRANSITION_FRAMES);
  });
  it("Türkçe ekler", () => {
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(ofTen), ["1'i", "2'si", "3'ü", "4'ü", "5'i", "6'sı", "7'si", "8'i", "9'u", "10'u"]);
    assert.deepEqual([36, 64, 73, 70, 60, 40, 100, 51].map(withLocative), ["36'sında", "64'ünde", "73'ünde", "70'inde", "60'ında", "40'ında", "100'ünde", "51'inde"]);
  });
  it("bölgeler güvenli alanda; tipografi ölçeği", () => {
    assert.deepEqual([SAFE.top, SAFE.bottom, SAFE.right], [220, 420, 140]);
    assert.deepEqual([WIDTH, HEIGHT], [1080, 1920]);
    assert.ok(ZONES.hudTop >= 250, "CLAUDE.md 3.3");
    assert.ok(insideSafeArea({ x: SAFE.left, y: ZONES.mainTop, width: 876, height: ZONES.mainHeight }));
    assert.ok(ZONES.progressTop + 6 <= HEIGHT - SAFE.bottom);
    assert.ok(TYPE.title >= 88 && TYPE.title <= 96 && TYPE.hero >= 160 && TYPE.label >= 34 && TYPE.note >= 26);
    assert.ok(ZONES.stripTop + ZONES.stripHeight <= ZONES.progressTop);
    assert.ok(ZONES.titleTop - (ZONES.hudTop + 44) >= 16, "İ noktası logoya değmez");
  });
});

describe("kırpma", () => {
  const photo = { aspect: 0.75, focus: { x: 0.5, y: 0.2 }, crops: { vertical: { x: 0.2, y: 0.1, width: 0.6, height: 0.8 }, square: { x: 0, y: 0, width: 1, height: 0.75 } } };
  it("çerçeveye göre kırpma seçer ve çerçeveyi kaplar", () => {
    assert.equal(cropFor(photo, { width: 500, height: 900 }), photo.crops.vertical);
    assert.equal(cropFor(photo, { width: 800, height: 800 }), photo.crops.square);
    const frame = { width: 480, height: 640 };
    const place = placeCrop(photo.crops.vertical, photo.aspect, frame);
    assert.ok(photo.crops.vertical.width * place.width >= frame.width - 0.01 && photo.crops.vertical.height * place.height >= frame.height - 0.01);
    assert.ok(Math.abs(place.width / place.height - photo.aspect) < 1e-9);
  });
  it("odak noktası çerçevede", () => {
    const origin = focusOrigin(photo, { width: 480, height: 640 });
    assert.ok(origin.x > 40 && origin.x < 60 && origin.y > -0.01 && origin.y < 50);
  });
});

