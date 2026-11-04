import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findBannedWords } from "../../src/lib/prediction/banned-words";
import { convergedAt, percentVisible, PERCENT_THRESHOLD, roundedAt, winLeader } from "../src/lib/convergence";
import { DERBY, FAVOURITE, flowScript, SAMPLE_OPTIONS } from "../src/samples";
import { DERBY_HOME_XI } from "../src/samples/context";
import type { ReelScene } from "../src/schema";
import type { MatchData } from "../src/story/match-data";
import { BRAND, brandFor, evaluatePool, HANDLES, pickStory } from "../src/story/pool";
import { sceneReadabilityProblems } from "../src/story/readability";
import { puckName, SOURCE_LABELS } from "../src/story/team-card";

const clone = <T,>(value: T): T => structuredClone(value);
const sceneOf = <T extends ReelScene["type"]>(data: MatchData, type: T): Extract<ReelScene, { type: T }> => {
  const entry = evaluatePool(data, BRAND, SAMPLE_OPTIONS).find((item) => item.type === type);
  assert.ok(entry?.scene, `${type}: ${entry?.reason}`);
  return entry.scene as Extract<ReelScene, { type: T }>;
};
const names = ["Boğaziçi SK", "Boğaziçi", "Anadolu Gücü", "Anadolu"];

describe("Monte Carlo yakınsaması", () => {
  const final = { home: 38, draw: 30, away: 32 };
  it("eşik altında yüzde yok; 0 maçta asla", () => {
    assert.equal(percentVisible(0, 500000), false);
    assert.equal(percentVisible(PERCENT_THRESHOLD - 1, 500000), false);
    assert.equal(percentVisible(PERCENT_THRESHOLD, 500000), true);
    assert.equal(percentVisible(1500, 1500), true);
  });
  it("toplam her an 100, sonda birebir nihai, başta dalgalı", () => {
    for (let step = 0; step <= 100; step += 1) {
      const value = roundedAt(final, step / 100);
      assert.equal(value.home + value.draw + value.away, 100, String(step));
      assert.ok(value.home > 0 && value.draw > 0 && value.away > 0, String(step));
    }
    assert.deepEqual(roundedAt(final, 1), final);
    const early = [0.05, 0.1, 0.15, 0.2, 0.25].map((t) => convergedAt(final, t).home);
    assert.ok(Math.max(...early) - Math.min(...early) > 1);
    assert.ok(Math.abs(convergedAt(final, 0.98).home - final.home) < 1);
  });
  it("vurgu kazanma ihtimali yüksek tarafta; beraberlik yüksek olsa da", () => {
    assert.equal(winLeader(final), "home");
    assert.equal(winLeader({ home: 20, draw: 50, away: 30 }), "away");
    assert.equal(winLeader({ home: 30, draw: 40, away: 30 }), null);
  });
});

describe("Muhtemel 11", () => {
  it("son maçın 11'i: sakat ve cezalının yeri \"?\", şüpheli kalır, kaynak etiketi", () => {
    const home = sceneOf(DERBY, "C04_TEAM_HOME").data.lineup;
    assert.ok(home);
    assert.equal(home.slots.length, 11);
    assert.equal(home.formation, "4-2-3-1");
    assert.equal(home.sourceLabel, SOURCE_LABELS.full);
    assert.equal(home.slots.filter((slot) => slot.name === null).length, 1);
    const away = sceneOf(DERBY, "C05_TEAM_AWAY").data.lineup;
    assert.ok(away?.slots.some((slot) => slot.name === "Ö. Golcü"), "şüpheli oyuncu kalır");
    assert.ok(!away?.slots.some((slot) => slot.name === "Y. Orta"), "cezalı çıkar");
  });
  it("seslendirme dizilişi ve kilit değişikliği anlatır, rakamsız, kaynaklı", () => {
    const voice = sceneOf(DERBY, "C04_TEAM_HOME").voiceover;
    assert.match(voice?.text ?? "", /dört iki üç bir/);
    assert.match(voice?.text ?? "", /Yedek Kanat yok, orta saha yeri belirsiz/);
    assert.doesNotMatch(voice?.text ?? "", /\d/);
    assert.deepEqual(sceneReadabilityProblems(sceneOf(DERBY, "C04_TEAM_HOME"), names), []);
  });
  it("kadroda olmayan oyuncu videoya girmez", () => {
    const data = clone(DERBY);
    data.players.squads.home = data.players.squads.home.filter((player) => player.id !== 90011);
    const lineup = sceneOf(data, "C04_TEAM_HOME").data.lineup;
    assert.ok(!lineup?.slots.some((slot) => slot.name === "K. Forvet"));
  });
  it("editör: kaynak değişir, yerine geçen okunur, dizilişi kazanır", () => {
    const players = DERBY_HOME_XI.players.map((player) => (player.id === 90012 ? { id: 90107, name: "Kurgu On", short_name: "K. On", number: 10 } : player.id === 90107 ? null : player));
    const data = { ...clone(DERBY), lineup_edits: { home: { formation: "4-2-3-1", players }, away: null } };
    const scene = sceneOf(data, "C04_TEAM_HOME");
    assert.equal(scene.data.lineup?.source, "editor");
    assert.equal(scene.data.lineup?.sourceLabel, SOURCE_LABELS.editor);
    assert.match(scene.voiceover?.text ?? "", /Yedek Kanat yok, orta saha için Kurgu On bekleniyor/);
    const other = { ...clone(DERBY), lineup_edits: { home: { formation: "4-4-2", players }, away: null } };
    const reshaped = sceneOf(other, "C04_TEAM_HOME");
    assert.equal(reshaped.data.lineup?.formation, "4-4-2");
    assert.doesNotMatch(reshaped.voiceover?.text ?? "", /bekleniyor/);
  });
  it("son maç verisi yoksa yedek: en sık diziliş; kesinlik sözü yok", () => {
    const data = clone(DERBY);
    data.context!.teams.home.lineup = null;
    const scene = sceneOf(data, "C04_TEAM_HOME");
    assert.equal(scene.data.lineup, null);
    assert.equal(scene.data.formation?.name, "4-2-3-1");
    const all = JSON.stringify(sceneOf(DERBY, "C04_TEAM_HOME"));
    assert.doesNotMatch(all, /kesin|ilan edildi|resmi 11/iu);
  });
  it("uzun adda baş harf düşer; tahta yönü lig ortalamasından", () => {
    assert.equal(puckName({ id: 1, name: "x", short_name: "T. Yıldırımoğlu", number: 5 }), "Yıldırımoğlu");
    assert.equal(puckName({ id: 1, name: "x", short_name: "Ö. Bek", number: 2 }), "Ö. Bek");
    assert.deepEqual(sceneOf(DERBY, "C04_TEAM_HOME").data.board, { attack: "strong", defence: "strong" });
    const data = clone(DERBY);
    data.context!.teams.home.goals_against_avg = 2.2;
    assert.equal(sceneOf(data, "C04_TEAM_HOME").data.board.defence, "weak");
  });
});

describe("etkileşim kartı ve akış", () => {
  it("son kart, 3–4 sn, dört çağrı, bahis dili yok", () => {
    const script = flowScript();
    const last = script.scenes.at(-1);
    assert.equal(last?.type, "S18_ENGAGE");
    assert.equal(script.scenes.at(-2)?.type, "S17_CLOSE");
    assert.ok(last && last.durationInFrames >= 90 && last.durationInFrames <= 120);
    assert.ok(last?.type === "S18_ENGAGE");
    assert.deepEqual(last.data.calls, ["like", "comment", "share", "save"]);
    assert.deepEqual(findBannedWords(JSON.stringify(last.data)), []);
    assert.equal(last.data.handle, "@checkmatch_tr");
  });
  it("hesap adı platforma göre", () => {
    assert.equal(brandFor("tiktok").handle, HANDLES.tiktok);
  });
  it("uzun not süreyi aşırırsa \"Rakibine karşı\" düşer, kapanış kalır", () => {
    const long = Array.from({ length: 22 }, () => "sözcük").join(" ");
    const data = { ...clone(DERBY), analyst_voice_note: `${long}. ${long}.` };
    const story = pickStory(evaluatePool(data, BRAND, SAMPLE_OPTIONS), "derby");
    assert.ok(!story.some((scene) => scene.type === "P02_VS_OPPONENT"));
    assert.equal(story.at(-1)?.type, "S18_ENGAGE");
  });
  it("tahta odağı: hücum farkı ve savunma farkı", () => {
    assert.equal(sceneOf(DERBY, "C07_KEY").data.focus, "attack");
    assert.ok(["attack", "defence"].includes(sceneOf(FAVOURITE, "C07_KEY").data.focus));
  });
});
