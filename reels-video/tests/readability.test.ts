import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findBannedWords } from "../../src/lib/prediction/banned-words";
import { THEMES } from "../src/design/tokens";
import { coverage } from "../src/lib/layout-check";
import { DERBY, FAVOURITE, flowScript, SAMPLE_KEYS, SAMPLE_OPTIONS, sampleScripts } from "../src/samples";
import { ACTIVE_DESIGN, type ReelScene } from "../src/schema";
import { NOTE_CARD_MAX_WORDS, SCREEN_NOTE_MAX_WORDS, screenNoteProblem, splitVoiceNote, voiceNoteProblem } from "../../src/lib/reels/analyst-note";
import { hasDigit, say, TEAM, valueAt } from "../src/story/claims";
import { unknownNames } from "../src/story/name-guard";
import { BRAND, evaluatePool, pickStory } from "../src/story/pool";
import { MAX_BULLET_WORDS, MAX_NOTE_CARD_FRAMES, readabilityProblems, sceneReadabilityProblems, screenBullets } from "../src/story/readability";
import { decimalWords, formationWords, numberWords, ordinalWords, percentInWords, slotWords, wordCount } from "../src/story/speech";

const names = ["Boğaziçi SK", "Boğaziçi", "Anadolu Gücü", "Anadolu"];
const flow = (): ReelScene[] => flowScript().scenes;
const pool = (data: typeof DERBY): ReelScene[] => evaluatePool(data, BRAND, SAMPLE_OPTIONS).flatMap((entry) => (entry.scene && entry.scene.voiceover ? [entry.scene] : []));

describe("sayıların okunuşu", () => {
  it("sayı, yüzde, sıra, ondalık, diziliş, dilim", () => {
    assert.equal(numberWords(500000), "beş yüz bin");
    assert.equal(numberWords(1000), "bin");
    assert.equal(numberWords(0), "sıfır");
    assert.equal(numberWords(-8), "eksi sekiz");
    assert.equal(numberWords(115), "yüz on beş");
    assert.equal(percentInWords(18), "yüzde on sekizinde");
    assert.equal(percentInWords(27), "yüzde yirmi yedisinde");
    assert.equal(percentInWords(40), "yüzde kırkında");
    assert.equal(ordinalWords(3), "üçüncü");
    assert.equal(ordinalWords(14), "on dördüncü");
    assert.equal(decimalWords(1.8), "bir virgül sekiz");
    assert.equal(decimalWords(2), "iki");
    assert.equal(formationWords("4-2-3-1"), "dört iki üç bir");
    assert.equal(slotWords("76–90+"), "yetmiş altı ile doksan");
  });
});

describe("okunurluk kuralları", () => {
  it("aktif tema D; el yazısı üçüncü aile", () => {
    assert.equal(ACTIVE_DESIGN, "D");
    assert.equal(flowScript().design, "D");
    assert.equal(THEMES.D.hand, "Caveat Brush");
    assert.equal(THEMES.D.display, "Archivo Black");
    assert.notEqual(THEMES.D.number, THEMES.D.hand);
    assert.notEqual(THEMES.D.label, THEMES.D.hand);
  });
  it("örnek akışlar bütün metin kurallarını geçer", () => {
    assert.deepEqual(readabilityProblems(flowScript()), []);
    for (const key of SAMPLE_KEYS) assert.deepEqual(readabilityProblems(sampleScripts(key).story), [], key);
  });
  it("her kart 4–6 sn; yalnız notu okuyan iki kart en çok 8 sn; ihlal yakalanır", () => {
    for (const scene of flow()) {
      const reads = scene.voiceover?.lines.some((line) => line.sources.includes("analyst_note"));
      const limit = reads && (scene.type === "C07_KEY" || scene.type === "C09_SCENARIO") ? MAX_NOTE_CARD_FRAMES : scene.type === "S18_ENGAGE" ? 120 : 180;
      assert.ok(scene.durationInFrames >= (scene.type === "S18_ENGAGE" ? 90 : 120) && scene.durationInFrames <= limit, scene.type);
    }
    assert.equal(flow().find((scene) => scene.type === "C07_KEY")?.durationInFrames, 210);
    for (const scene of pool(DERBY)) assert.ok(scene.durationInFrames <= 180, scene.type);
    const first = flow()[0] as ReelScene;
    assert.match(sceneReadabilityProblems({ ...first, durationInFrames: 60 } as ReelScene, names)[0] ?? "", /4–6 sn/);
  });
  it("madde: rakam + en fazla 8 sözcük, kart başına en fazla 3", () => {
    for (const data of [DERBY, FAVOURITE]) {
      for (const scene of pool(data)) {
        const bullets = screenBullets(scene);
        assert.ok(bullets.length <= 3, scene.type);
        for (const bullet of bullets) {
          assert.ok(wordCount(bullet.text) <= MAX_BULLET_WORDS, bullet.text);
          assert.match(bullet.text, /\d/u);
        }
      }
    }
  });
  it("uzun ya da rakamsız madde render'ı durdurur", () => {
    const scene = flow().find((item) => item.type === "C09_SCENARIO");
    assert.ok(scene?.type === "C09_SCENARIO");
    const long = { ...scene.data.items[0], text: "bu madde sekiz sözcükten çok daha uzun bir cümle olarak yazıldı 5" };
    const bare = { ...scene.data.items[1], text: "rakamsız madde" };
    const broken = { ...scene, data: { ...scene.data, items: [long, bare, scene.data.items[2]] } } as ReelScene;
    const problems = sceneReadabilityProblems(broken, names).join("\n");
    assert.match(problems, /sözcük/);
    assert.match(problems, /rakam yok/);
  });
  it("seslendirme her sahnede: rakamsız, maddeden uzun, kaynaklı, süreye sığar", () => {
    for (const data of [DERBY, FAVOURITE]) {
      for (const entry of evaluatePool(data, BRAND, SAMPLE_OPTIONS)) {
        // Akış dışı eski sahneler (S02–S16) seslendirme taşımaz, akışa girmez.
        if (!entry.scene || (entry.type.startsWith("S") && entry.type !== "S01_COVER" && entry.type !== "S17_CLOSE" && entry.type !== "S18_ENGAGE")) continue;
        const scene = entry.scene;
        assert.ok(scene.voiceover, scene.type);
        for (const line of scene.voiceover.lines) {
          assert.ok(line.sources.length > 0, line.id);
          for (const source of line.sources) if (source !== "analyst_note" && source !== "brand") assert.notEqual(valueAt(data, source), undefined, `${line.id}: ${source}`);
          assert.ok(!hasDigit(line.template), line.id);
        }
        assert.deepEqual(sceneReadabilityProblems(scene, [data.teams.home.name, data.teams.home.short_name, data.teams.away.name, data.teams.away.short_name]), [], scene.type);
      }
    }
  });
  it("seslendirme ekrandaki maddelerle aynı veriye dayanır", () => {
    for (const scene of flow()) {
      const bullets = screenBullets(scene) as { sources?: string[] }[];
      const screenKeys = new Set(bullets.flatMap((bullet) => bullet.sources ?? []).filter((key) => !key.startsWith("teams.")));
      // Not okunan kartta ve kilit değişikliği anlatan takım kartında süre önce onlara gider; ekranda aynı veri tahtada.
      if (!screenKeys.size || scene.voiceover?.lines.some((line) => line.sources.includes("analyst_note") || line.sources.some((source) => source.includes(".lineup")))) continue;
      const voiceKeys = (scene.voiceover?.lines ?? []).flatMap((line) => line.sources);
      assert.ok(voiceKeys.some((key) => screenKeys.has(key)), `${scene.type}: ${[...screenKeys].join(", ")} / ${voiceKeys.join(", ")}`);
    }
  });
  it("seslendirme de dil kapısından ve ad bekçisinden geçer", () => {
    for (const data of [DERBY, FAVOURITE]) {
      for (const scene of pool(data)) assert.deepEqual(findBannedWords(scene.voiceover?.text ?? ""), [], scene.voiceover?.text);
      assert.deepEqual(unknownNames(pool(data), data), []);
    }
  });
  it("veride olmayan ad seslendirmede de yakalanır", () => {
    const scene = flow()[0] as ReelScene;
    const dirty = { ...scene, voiceover: { text: "x", lines: [{ id: "x", template: "x", text: "Liverpool'dan geldi.", sources: ["teams.home.name"] }] } } as ReelScene;
    assert.deepEqual(unknownNames([dirty], DERBY).includes("Liverpool"), true);
  });
  it("analist notu: özet kartta, seslendirme notu seste ve açıklamada, bir kez okunur", () => {
    const voice = "Ev sahibi ilk yarım saatte öne geçerse maç kapanır.";
    const data = { ...structuredClone(DERBY), analyst_screen_note: "İlk yarım saat belirleyici", analyst_voice_note: voice };
    const scenes = pool(data);
    const key = scenes.find((scene) => scene.type === "C07_KEY");
    const scenario = scenes.find((scene) => scene.type === "C09_SCENARIO");
    assert.ok(key?.type === "C07_KEY" && scenario?.type === "C09_SCENARIO");
    assert.equal(key.data.analystNote, "İlk yarım saat belirleyici");
    assert.equal(scenario.data.analystNote, "İlk yarım saat belirleyici");
    assert.deepEqual(key.data.reasons, []);
    assert.ok(key.voiceover?.text.includes(voice));
    assert.ok(!scenario.voiceover?.text.includes(voice));
    assert.deepEqual(sceneReadabilityProblems(key, names), []);
  });
  it("uzun seslendirme notu iki karta cümle sınırından bölünür, kartlar en çok 8 sn", () => {
    const first = "Ev sahibi ilk yarım saatte öne geçerse maç büyük ölçüde kapanır ve tempo düşer, çünkü deplasman takımı geride oynamayı sevmiyor.";
    const second = "Deplasman takımı kanatlardan koşuyor, bu yüzden son bölümde yeni bir maç başlar ve iki takım da daha açık oynar.";
    const data = { ...structuredClone(DERBY), analyst_voice_note: `${first} ${second}` };
    const scenes = pool(data);
    const key = scenes.find((scene) => scene.type === "C07_KEY");
    const scenario = scenes.find((scene) => scene.type === "C09_SCENARIO");
    assert.ok(key?.voiceover?.text.includes(first) && !key.voiceover.text.includes(second));
    assert.ok(scenario?.voiceover?.text.includes(second));
    for (const scene of [key, scenario]) {
      assert.ok(scene && scene.durationInFrames > 180 && scene.durationInFrames <= MAX_NOTE_CARD_FRAMES);
      assert.deepEqual(sceneReadabilityProblems(scene as ReelScene, names), []);
    }
  });
  it("anahtar kartı kapalıysa not senaryoda okunur; sığmıyorsa render durur", () => {
    const same = structuredClone(DERBY);
    same.context!.teams.away = same.context!.teams.home;
    const short = pool({ ...same, analyst_voice_note: "İlk yarım saat belirleyici." }).find((scene) => scene.type === "C09_SCENARIO");
    assert.ok(short?.voiceover?.text.includes("İlk yarım saat belirleyici."));
    const longNote = Array.from({ length: 30 }, () => "sözcük").join(" ");
    const long = pool({ ...same, analyst_voice_note: longNote }).find((scene) => scene.type === "C09_SCENARIO");
    assert.match(sceneReadabilityProblems(long as ReelScene, names).join(), /sözcük/);
  });
  it("yalnız notu okuyan iki kart uzayabilir, sesten uzun olamaz", () => {
    const upset = flow().find((scene) => scene.type === "C08_UPSET") as ReelScene;
    assert.match(sceneReadabilityProblems({ ...upset, durationInFrames: 210 } as ReelScene, names).join(), /4–6 sn/);
    const key = flow().find((scene) => scene.type === "C07_KEY") as ReelScene;
    assert.match(sceneReadabilityProblems({ ...key, durationInFrames: 240 } as ReelScene, names).join(), /gerektirdiğinden uzun/);
    assert.match(sceneReadabilityProblems({ ...key, durationInFrames: 270 } as ReelScene, names).join(), /en çok 8 sn/);
  });
  it("not kuralları: özet ≤ 15 sözcük, seslendirme 1–3 cümle, cümle bölünmez", () => {
    assert.equal(screenNoteProblem(Array.from({ length: SCREEN_NOTE_MAX_WORDS }, () => "a").join(" ")), null);
    assert.match(screenNoteProblem(Array.from({ length: SCREEN_NOTE_MAX_WORDS + 1 }, () => "a").join(" ")) ?? "", /15 sözcük/);
    assert.equal(voiceNoteProblem("Bir. İki. Üç."), null);
    assert.match(voiceNoteProblem("Bir. İki. Üç. Dört.") ?? "", /3 cümle/);
    assert.match(voiceNoteProblem(`${Array.from({ length: NOTE_CARD_MAX_WORDS + 1 }, () => "a").join(" ")}.`) ?? "", /sığmıyor/);
    assert.deepEqual(splitVoiceNote("Bir. İki."), ["Bir. İki.", null]);
  });
  it("açıklama metni analist notunun tam halini taşır ve dil kapısından geçer", () => {
    const script = flowScript();
    assert.match(script.description, /Kurgusal not.*belirleyici/su);
    assert.deepEqual(findBannedWords(script.description), []);
  });
  it("doluluk ölçümü birleşimi sayar: üst üste binen iki kez sayılmaz", () => {
    const area = { x: 0, y: 0, width: 100, height: 100 };
    assert.equal(coverage([{ x: 0, y: 0, width: 100, height: 50 }, { x: 0, y: 0, width: 100, height: 50 }], area), 0.5);
    assert.equal(coverage([], area), 0);
    assert.equal(coverage([{ x: -50, y: -50, width: 300, height: 300 }], area), 1);
  });
  it("seslendirme kuralı veri yoksa cümle kurmaz; yuva ve rakam yine hata", () => {
    assert.equal(say(DERBY, "x", "{a}", { a: { key: "context.yok", format: "int" } }), null);
    assert.throws(() => say(DERBY, "x", "İlk 30 dakika"), /rakam/);
    assert.throws(() => say(DERBY, "x", "Kaynaksız cümle."), /kaynaksız/);
    assert.equal(say(DERBY, "x", "{home}", { home: TEAM.home })?.sources[0], "teams.home.short_name");
  });
});
