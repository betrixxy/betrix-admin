import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findBannedWords } from "../../src/lib/prediction/banned-words";
import { THEMES } from "../src/design/tokens";
import { coverage } from "../src/lib/layout-check";
import { DERBY, FAVOURITE, flowScript, SAMPLE_KEYS, SAMPLE_OPTIONS, sampleScripts } from "../src/samples";
import { ACTIVE_DESIGN, type ReelScene } from "../src/schema";
import { hasDigit, NOTE_SCREEN_CHARS, noteForScreen, say, TEAM, valueAt } from "../src/story/claims";
import { unknownNames } from "../src/story/name-guard";
import { BRAND, evaluatePool, pickStory } from "../src/story/pool";
import { MAX_BULLET_WORDS, noteOverrun, readabilityProblems, sceneReadabilityProblems, screenBullets } from "../src/story/readability";
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
  it("her kart 4–6 sn; ihlal yakalanır", () => {
    for (const scene of flow()) assert.ok(scene.durationInFrames >= 120 && scene.durationInFrames <= 180, scene.type);
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
        if (!entry.scene || (entry.type.startsWith("S") && entry.type !== "S01_COVER" && entry.type !== "S17_CLOSE")) continue;
        const scene = entry.scene;
        assert.ok(scene.voiceover, scene.type);
        for (const line of scene.voiceover.lines) {
          assert.ok(line.sources.length > 0, line.id);
          for (const source of line.sources) if (source !== "analyst_note") assert.notEqual(valueAt(data, source), undefined, `${line.id}: ${source}`);
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
      if (!screenKeys.size) continue;
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
  it("analist notu: ekranda kısa, tam hali seste ve açıklamada, bir kez okunur", () => {
    const long = "Ev sahibi ilk yarım saatte öne geçerse maç kapanır. Deplasman takımı kanatlardan koşuyor, bu yüzden tempo ikinci yarıda düşer ve son bölümde yeni bir maç başlar.";
    const data = { ...structuredClone(DERBY), analyst_note: long };
    const scenes = pool(data);
    const key = scenes.find((scene) => scene.type === "C07_KEY");
    const scenario = scenes.find((scene) => scene.type === "C09_SCENARIO");
    assert.ok(key?.type === "C07_KEY" && scenario?.type === "C09_SCENARIO");
    assert.equal(key.data.analystNote, "Ev sahibi ilk yarım saatte öne geçerse maç kapanır.");
    assert.ok((key.data.analystNote ?? "").length <= NOTE_SCREEN_CHARS);
    assert.ok(key.voiceover?.text.includes(long));
    assert.ok(!scenario.voiceover?.text.includes(long));
    assert.ok(noteOverrun(key) > 0);
    const story = pickStory(evaluatePool(data, BRAND, SAMPLE_OPTIONS), "derby");
    assert.ok(story.length > 0);
  });
  it("uzun ilk cümle sözcük sınırında kesilir", () => {
    const cut = noteForScreen("Bu cümle ekrandaki iki satıra sığmayacak kadar uzun yazıldı çünkü analist burada çok fazla şey anlatmak istedi");
    assert.ok(cut.length <= NOTE_SCREEN_CHARS);
    assert.ok(cut.endsWith("…"));
    assert.ok(!cut.endsWith(" …"));
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
