import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALLOWED_TAGS, bigMatchReason, defaultProfile, LIVE_SETTINGS, MAX_TAGS, planTags, pronounce, spokenTexts, stripTags, VOICE_PROFILES } from "../scripts/reel/voice";
import type { ReelScene } from "../src/schema";

const scene = (type: string, text: string | null): ReelScene =>
  ({ type, durationInFrames: 180, voiceover: text ? { text, lines: [{ id: "x", template: "x", text, sources: ["x"] }] } : null, headline: null, caption: null, assets: { photoIds: [] }, data: {} }) as unknown as ReelScene;

const video = [
  scene("S01_COVER", "Galatasaray ile Amed SFK karşılaşıyor. Bu maçı birlikte okuyalım."),
  scene("M02_MONTE_CARLO", "Maçı yüz bin kez oynattık. Galatasaray yüzde yetmiş beş."),
  scene("Q05_BOTH_SCORE", "İki takım da gol bulur mu? Olasılık yüzde altmış iki, xG iki virgül dört."),
  scene("Q12_FIRST_GOAL", "İlk gol kimden? Galatasaray önde."),
  scene("C08_UPSET", "Amed SFK için sürpriz yüzde on altı."),
  scene("C09_SCENARIO", "Galatasaray önde."),
  scene("S17_CLOSE", "Sence kim kazanır? Yorumlara yaz."),
  scene("S18_ENGAGE", "Beğen, yorum yap, paylaş."),
];
const TAG = /\[([a-z ]+)\]/gu;
const tagsIn = (texts: (string | null)[]) => texts.flatMap((text) => [...(text ?? "").matchAll(TAG)].map((match) => match[1]));

describe("ses profilleri", () => {
  it("kimlik ve ayarlar örnek üretimiyle birebir (önbellek tutarlılığı)", () => {
    assert.deepEqual(LIVE_SETTINGS, { stability: 0.4, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true, speed: 1.05 });
    assert.equal(VOICE_PROFILES["buyuk-mac"].voiceId, "c9eIhSvMHBxtYhLX4oBt");
    assert.equal(VOICE_PROFILES.standart.voiceId, "01p4omegjS2n3rSDCM5u");
    assert.equal(VOICE_PROFILES.alternatif.voiceId, "fg8pljYEn5ahwjyOQaro");
    for (const profile of Object.values(VOICE_PROFILES)) assert.equal(profile.modelId, "eleven_v4");
    assert.deepEqual(Object.values(VOICE_PROFILES).filter((profile) => profile.tags).map((profile) => profile.id), ["buyuk-mac"]);
  });

  it("büyük maç önerisi: derbi, Şampiyonlar Ligi, Türk takımının Avrupa maçı; değilse standart", () => {
    const isTurkish = (id: number) => id === 645 || id === 3579;
    assert.equal(bigMatchReason({ leagueId: 203, homeId: 645, awayId: 611, isTurkish }), "derbi");
    assert.equal(bigMatchReason({ leagueId: 2, homeId: 1, awayId: 2, isTurkish }), "Şampiyonlar Ligi");
    assert.equal(bigMatchReason({ leagueId: 3, homeId: 1, awayId: 3579, isTurkish }), "Türk takımının Avrupa maçı");
    assert.equal(bigMatchReason({ leagueId: 203, homeId: 645, awayId: 3579, isTurkish }), null);
    assert.equal(defaultProfile(true), "buyuk-mac");
    assert.equal(defaultProfile(false), "standart");
  });
});

describe("ses etiketleri", () => {
  const tagged = spokenTexts(video, VOICE_PROFILES["buyuk-mac"]);

  it("en çok 5, yalnız doğrulanan etiketler, art arda aynı etiket yok", () => {
    const tags = tagsIn(tagged);
    assert.ok(tags.length > 0 && tags.length <= MAX_TAGS);
    for (const tag of tags) assert.ok((ALLOWED_TAGS as readonly string[]).includes(tag ?? ""), tag);
    tags.forEach((tag, at) => assert.notEqual(tag, tags[at - 1]));
  });

  it("kancada excited, sürprizde whispers, soruda curious", () => {
    assert.match(tagged[0] ?? "", /^\[excited\] /u);
    assert.match(tagged[4] ?? "", /^\[whispers\] /u);
    assert.ok(tagsIn(tagged).includes("curious"));
    const plan = planTags(video);
    assert.ok(plan.every((item, at) => at === 0 || (plan[at - 1]?.scene ?? -1) < item.scene));
  });

  it("diğer profillerde etiket yok, metindeki etiket de silinir", () => {
    const withTag = [scene("S01_COVER", "[excited] Maç başlıyor."), ...video.slice(1)];
    for (const id of ["standart", "alternatif"] as const) assert.deepEqual(tagsIn(spokenTexts(withTag, VOICE_PROFILES[id])), []);
    assert.equal(stripTags("[whispers] Sürpriz [short pause] burada."), "Sürpriz burada.");
  });

  it("ekran metni değişmez: etiket ve okunuş yalnız ses metninde", () => {
    const before = JSON.stringify(video);
    spokenTexts(video, VOICE_PROFILES["buyuk-mac"]);
    assert.equal(JSON.stringify(video), before);
    assert.ok(!video.some((item) => /\[[a-z ]+\]/u.test(JSON.stringify(item.data))));
  });

  it("xG seste gol beklentisi", () => {
    assert.equal(pronounce("Galatasaray xG iki virgül dört."), "Galatasaray gol beklentisi iki virgül dört.");
    assert.ok(spokenTexts(video, VOICE_PROFILES.standart)[2]?.includes("gol beklentisi"));
    assert.ok(!spokenTexts(video, VOICE_PROFILES.standart).some((text) => text?.includes("xG")));
  });
});
