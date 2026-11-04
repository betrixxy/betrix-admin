import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { findBannedWords } from "../../src/lib/prediction/banned-words";
import { usesSimulation } from "../src/design/kit";
import { DERBY, FAVOURITE, SAMPLE_OPTIONS } from "../src/samples";
import { keyDifference, sampleScores } from "../src/story/analysis";
import { claim, hasDigit, polishUsable, slotsOf, type Reason, valueAt } from "../src/story/claims";
import type { MatchData } from "../src/story/match-data";
import { unknownNames } from "../src/story/name-guard";
import { BRAND, evaluatePool } from "../src/story/pool";
import type { ReelScene, ReelSceneType } from "../src/schema";

const clone = (data: MatchData): MatchData => structuredClone(data);
const scenesOf = (data: MatchData): ReelScene[] => evaluatePool(data, BRAND, SAMPLE_OPTIONS).flatMap((entry) => (entry.scene ? [entry.scene] : []));
const entry = (data: MatchData, type: ReelSceneType) => {
  const found = evaluatePool(data, BRAND, SAMPLE_OPTIONS).find((item) => item.type === type);
  assert.ok(found, type);
  return found;
};
const dataOf = <T extends ReelSceneType>(data: MatchData, type: T) => {
  const scene = entry(data, type).scene;
  assert.ok(scene, type);
  return scene as Extract<ReelScene, { type: T }>;
};

/** Sahne ağacındaki bütün yorum cümleleri. */
function reasonsIn(value: unknown): Reason[] {
  if (Array.isArray(value)) return value.flatMap(reasonsIn);
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    if (typeof item.template === "string" && Array.isArray(item.sources)) return [item as unknown as Reason];
    return Object.values(item).flatMap(reasonsIn);
  }
  return [];
}
const allReasons = (data: MatchData) => scenesOf(data).flatMap((scene) => reasonsIn(scene.data));

describe("her iddia bir veri anahtarına bağlı", () => {
  for (const [name, data] of [["derbi", DERBY], ["favori", FAVOURITE]] as const) {
    it(`${name}: anahtar veride var, metindeki her rakam anahtardan`, () => {
      const reasons = allReasons(data);
      assert.ok(reasons.length >= 14, String(reasons.length));
      for (const reason of reasons) {
        assert.ok(reason.sources.length > 0, reason.id);
        for (const source of reason.sources) assert.notEqual(valueAt(data, source), undefined, `${reason.id}: ${source}`);
        assert.ok(!hasDigit(reason.template), reason.id);
        const allowed = reason.figures.join(" ");
        for (const number of reason.text.match(/\d+(?:[.,]\d+)?/gu) ?? []) assert.ok(allowed.includes(number), `${reason.id}: ${number} / ${reason.text}`);
      }
    });
  }
  it("veri değişince cümle değişir: rakam elle yazılmamış", () => {
    const changed = clone(DERBY);
    assert.ok(changed.context);
    changed.context.teams.home.goals_for_avg = 3.3;
    const reason = allReasons(changed).find((item) => item.id === "goals.home");
    assert.match(reason?.text ?? "", /3,3 gol/);
  });
  it("şablonda rakam ya da tanımsız yuva hata; veri yoksa cümle kurulmaz", () => {
    assert.throws(() => claim(DERBY, "x", "İlk 30 dakika", {}), /rakam/);
    assert.throws(() => claim(DERBY, "x", "{a} gol", {}), /yuva/);
    assert.equal(claim(DERBY, "x", "{a} gol", { a: { key: "context.yok", format: "int" } }), null);
    assert.equal(claim({ ...DERBY, context: null }, "x", "{a} gol", { a: { key: "context.teams.home.played", format: "int" } }), null);
  });
  it("taktik, transfer ve kişi iddiası kaynak şablonlarda yok", () => {
    const source = ["src/story/analysis.ts", "src/story/reasons.ts"].map((file) => readFileSync(file, "utf8")).join("\n").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, "");
    assert.ok(!/\b(pres|kontra|kanat|transfer|teknik direktör|hoca|moral|yorgun|motivasyon|sakatlandı)\b/iu.test(source));
  });
  it("yorumlar bahis dili ve ad bekçisinden geçer", () => {
    for (const data of [DERBY, FAVOURITE]) {
      for (const reason of allReasons(data)) assert.deepEqual(findBannedWords(reason.text), [], reason.text);
      assert.deepEqual(unknownNames(scenesOf(data), data), []);
    }
  });
});

describe("LLM doğallaştırması", () => {
  const data = clone(DERBY);
  assert.ok(data.context);
  const template = "{home}: maç başına {forAvg} gol atıyor";
  it("yuvalar aynıysa ve rakam yoksa kullanılır", () => {
    data.context!.polished = { "goals.home": "Maç başına {forAvg} gol atan {home}" };
    assert.match(allReasons(data).find((item) => item.id === "goals.home")?.text ?? "", /Maç başına 1,8 gol atan Boğaziçi/);
  });
  it("rakam ekleyen ya da yuva düşüren metin yok sayılır", () => {
    assert.equal(polishUsable("{home} son 3 maçta {forAvg}", template), false);
    assert.equal(polishUsable("{home} gol atıyor.", template), false);
    assert.deepEqual(slotsOf(template), ["forAvg", "home"]);
    data.context!.polished = { "goals.home": "{home} 9 gol atıyor." };
    assert.match(allReasons(data).find((item) => item.id === "goals.home")?.text ?? "", /1,8 gol/);
  });
});

describe("Monte Carlo", () => {
  it("son değerler veriden; sayaçlar N × pay", () => {
    const { data } = dataOf(DERBY, "M02_MONTE_CARLO");
    assert.deepEqual(data.final, { home: 38, draw: 30, away: 32 });
    assert.equal(Math.round(data.simulations * data.shares.home), 190000);
    assert.equal(data.simulations, DERBY.model.simulations);
  });
  it("simülasyon sayısı yoksa kapanır", () => {
    const changed = clone(DERBY);
    changed.model.simulations = null;
    assert.ok(entry(changed, "M02_MONTE_CARLO").reason);
  });
  it("örnek skorlar sonuç paylarıyla uyumlu ve tekrarlanabilir", () => {
    assert.deepEqual(sampleScores(DERBY.outcome), sampleScores(DERBY.outcome));
    const many = sampleScores({ home_win: 1, draw: 0, away_win: 0 }, 50);
    assert.ok(many.every((score) => score.home > score.away));
  });
});

describe("eksikler", () => {
  it("takımdaki pay görünür, durum etiketli", () => {
    const { data } = dataOf(DERBY, "C03_ABSENCES");
    assert.equal(data.away[1]?.share, "%37");
    assert.equal(data.away[0]?.status, "suspended");
    assert.match(data.reasons[0]?.text ?? "", /Örnek Golcü.*%37/);
  });
  it("kadroda olmayan oyuncu eksik listesine girmez", () => {
    const changed = clone(DERBY);
    changed.context!.absences!.away.push({ player_id: 306, name: "Mohamed Salah", status: "injured", minutes: 900, goals: 9, assists: 3, involvement_pct: 50 });
    const { data } = dataOf(changed, "C03_ABSENCES");
    assert.ok(!data.away.some((row) => row.name === "Mohamed Salah"));
    assert.ok(!data.reasons[0]?.text.includes("Salah"));
  });
  it("eksik yoksa ya da okunamadıysa ya da kadro doğrulanmadıysa kapanır", () => {
    const none = clone(DERBY);
    none.context!.absences = { home: [], away: [] };
    assert.match(entry(none, "C03_ABSENCES").reason ?? "", /eksik yok/);
    const unread = clone(DERBY);
    unread.context!.absences = null;
    assert.match(entry(unread, "C03_ABSENCES").reason ?? "", /okunamadı/);
    const squad = clone(DERBY);
    squad.players.squad_checked_at = null;
    assert.match(entry(squad, "C03_ABSENCES").reason ?? "", /Kadro/);
  });
});

describe("takım analizi", () => {
  it("attığı, yediği, xG, gol yememe, gol atamama, diziliş, 2 madde", () => {
    const { data } = dataOf(DERBY, "C04_TEAM_HOME");
    assert.deepEqual(data.stats.map((stat) => stat.key), ["for", "against", "xg", "clean", "fail"]);
    assert.equal(data.formation!.name, "4-2-3-1");
    assert.equal(data.points.length, 2);
    assert.ok(dataOf(DERBY, "C05_TEAM_AWAY").data.side === "away");
  });
  it("güçlü ve zayıf lig ortalamasına göre; ikisi de iyiyse zayıf denmez", () => {
    const { data } = dataOf(FAVOURITE, "C04_TEAM_HOME");
    assert.ok(!data.points.some((point) => point.label === "Zayıf"));
    assert.ok(dataOf(FAVOURITE, "C05_TEAM_AWAY").data.points.some((point) => point.label === "Zayıf"));
  });
  it("xG yoksa satır düşer, 0 yazılmaz", () => {
    const changed = clone(DERBY);
    changed.context!.teams.home.xg_for_avg = null;
    assert.ok(!dataOf(changed, "C04_TEAM_HOME").data.stats.some((stat) => stat.key === "xg"));
  });
});

describe("dakika, anahtar, sürpriz, senaryo", () => {
  it("dakika dilimi eksikse kapanır", () => {
    const changed = clone(DERBY);
    changed.context!.teams.home.minutes.for[2] = null;
    assert.match(entry(changed, "C06_MINUTES").reason ?? "", /Dakika/);
  });
  it("en belirgin fark seçilir; fark yoksa kapanır", () => {
    assert.equal(keyDifference(FAVOURITE.context!)?.leader, "home");
    const same = clone(DERBY);
    same.context!.teams.away = same.context!.teams.home;
    assert.match(entry(same, "C07_KEY").reason ?? "", /belirgin/);
  });
  it("analist notu kartlara girer; yoksa veri yorumu", () => {
    const changed = { ...clone(DERBY), analyst_screen_note: "Kendi yorumum." };
    assert.equal(dataOf(changed, "C07_KEY").data.analystNote, "Kendi yorumum.");
    assert.equal(dataOf(changed, "C09_SCENARIO").data.analystNote, "Kendi yorumum.");
    assert.equal(dataOf(DERBY, "C07_KEY").data.analystNote, null);
    assert.ok(dataOf(DERBY, "C07_KEY").data.reasons.length > 0);
  });
  it("sürpriz zayıf tarafın yolunu anlatır", () => {
    const { data } = dataOf(FAVOURITE, "C08_UPSET");
    assert.equal(data.side, "away");
    assert.match(data.reasons[0]?.text ?? "", /Liman.*%23/);
  });
  it("senaryo 3 madde; şüpheli alan senaryoya girmez", () => {
    assert.equal(dataOf(DERBY, "C09_SCENARIO").data.items.length, 3);
    const changed = clone(DERBY);
    changed.goals = { two_plus: 0.69, three_plus: 0.66, four_plus: 0.43, five_plus: 0.2, distribution: null };
    const texts = dataOf(changed, "C09_SCENARIO").data.items.map((item) => item.text).join(" ");
    assert.ok(!/en az üç gol/.test(texts), texts);
  });
});

describe("rozet", () => {
  it("yalnız simülasyon rakamı olan sahnede", () => {
    for (const type of ["Q05_BOTH_SCORE", "M02_MONTE_CARLO", "C08_UPSET", "C09_SCENARIO"] as const) assert.equal(usesSimulation(type), true, type);
    for (const type of ["S01_COVER", "C01_STORY", "C02_FORM", "C03_ABSENCES", "C04_TEAM_HOME", "C06_MINUTES", "C07_KEY", "P01_DUEL", "S17_CLOSE"] as const) assert.equal(usesSimulation(type), false, type);
  });
});
