import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReelScene } from "../src/schema";
import { sceneReadabilityProblems, VOICE_TAIL_FRAMES, voicedCardFrames } from "../src/story/readability";

const text = "Galatasaray bu sezon iç sahada çok güçlü oynuyor ve rakiplerine az pozisyon veriyor, Amed ise deplasmanda gol bulmakta zorlanıyor.";
const card = (frames: number): ReelScene =>
  ({ type: "C02_FORM", durationInFrames: frames, voiceover: { text, lines: [{ id: "x", template: "x", text, sources: ["form"] }] }, headline: null, caption: null, assets: { photoIds: [] }, data: {} }) as unknown as ReelScene;
const timing = (problems: string[]) => problems.filter((problem) => /sn|aşıyor|uzun/u.test(problem) && !problem.startsWith("seslendirme ekrandaki"));

describe("sesli kart süresi (ölçülen ses)", () => {
  it("kart sesi taşıyacak kadar uzar: 7 sn ses → kart 7 sn + pay, 8 sn'ye kadar geçerli", () => {
    const frames = voicedCardFrames(180, 210);
    assert.equal(frames, 210 + VOICE_TAIL_FRAMES);
    assert.deepEqual(timing(sceneReadabilityProblems(card(frames), [], 210)), []);
  });

  it("ses kartı aşarsa ya da kart 8 sn'yi geçerse durur", () => {
    assert.ok(timing(sceneReadabilityProblems(card(180), [], 200)).some((problem) => problem.includes("aşıyor")));
    assert.ok(timing(sceneReadabilityProblems(card(260), [], 246)).some((problem) => problem.includes("en çok 8 sn")));
  });

  it("kart sesin gerektirdiğinden uzun tutulamaz; sessiz kartta eski 4–6 sn kuralı sürer", () => {
    assert.ok(timing(sceneReadabilityProblems(card(230), [], 150)).some((problem) => problem.includes("gerektirdiğinden uzun")));
    assert.ok(timing(sceneReadabilityProblems(card(210), [])).some((problem) => problem.includes("4–6 sn")));
  });
});
