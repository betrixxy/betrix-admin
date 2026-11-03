import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { findBannedWords } from "../../src/lib/prediction/banned-words";
import { FONT_FILES, LICENSE_FILES } from "../src/components/typography";
import { simulationBadge } from "../src/design/kit";
import { THEMES, STRICT_SAFE, W } from "../src/design/tokens";
import { contrastRatio, insideSafeArea, parseRgb, relativeLuminance, worstContrast } from "../src/lib/layout-check";
import { buildTimeline } from "../src/lib/motion";
import { boardScript, BOARD_SCENES, DERBY, FAVOURITE, SAMPLE_KEYS, SAMPLE_OPTIONS, sampleScripts } from "../src/samples";
import { DESIGN_DIRECTIONS, QUESTION_SCENE_TYPES, reelScriptSchema, type ReelScene, type ReelSceneType } from "../src/schema";
import { barsFromLadder, checkCards, checkCleanWin, checkGoals, hasDip } from "../src/story/market-checks";
import type { MatchData, OpponentMatch, PlayerSeason } from "../src/story/match-data";
import { sceneTexts, unknownNames } from "../src/story/name-guard";
import { duelRows, longestContributionStreak, MIN_DUEL_MINUTES, pickStar, VS_SCOPE, vsOpponentStory } from "../src/story/players";
import { BRAND, evaluatePool, MAX_STORY_SCENES, MAX_STORY_SECONDS, MIN_STORY_SCENES, MIN_STORY_SECONDS, pickStory, storyProblems } from "../src/story/pool";
import { inSquad, SQUAD_MAX_AGE_DAYS, squadFreshness, squadWarnings } from "../src/story/squad";

const clone = (data: MatchData): MatchData => structuredClone(data);
const entryOf = (data: MatchData, type: ReelSceneType, options: Parameters<typeof evaluatePool>[2] = SAMPLE_OPTIONS) => {
  const entry = evaluatePool(data, BRAND, options).find((item) => item.type === type);
  assert.ok(entry, type);
  return entry;
};
const reasonOf = (data: MatchData, type: ReelSceneType, options?: Parameters<typeof evaluatePool>[2]) => entryOf(data, type, options).reason;
const seconds = (scenes: readonly ReelScene[]) => buildTimeline(scenes.map((scene) => scene.durationInFrames)).total / 30;

describe("ReelScript", () => {
  it("örnekler geçerli; bilinmeyen alan, bilinmeyen yön ve eski sahne hata", () => {
    for (const key of SAMPLE_KEYS) {
      const { story, pool } = sampleScripts(key);
      assert.ok(reelScriptSchema.safeParse(story).success);
      assert.ok(reelScriptSchema.safeParse(pool).success);
      assert.equal(reelScriptSchema.safeParse({ ...story, extra: 1 }).success, false);
      assert.equal(reelScriptSchema.safeParse({ ...story, design: "D" }).success, false);
      assert.equal(reelScriptSchema.safeParse({ ...story, scenes: [{ ...story.scenes[0], type: "S06_WINNER" }] }).success, false);
    }
  });
  it("bütün havuz metinleri gerçek bahis dili listesinden geçer", () => {
    for (const key of SAMPLE_KEYS) {
      const found = sceneTexts(sampleScripts(key).pool.scenes.map((scene) => [scene.headline, scene.caption, scene.data])).flatMap((text) => findBannedWords(text).map((word) => `${word}: ${text}`));
      assert.deepEqual(found, []);
    }
  });
  it("sözleşme alan adlarında market adı yok", () => {
    const source = readFileSync("src/story/match-data.ts", "utf8").replace(/\/\*\*[\s\S]*?\*\//g, "");
    assert.ok(!/\bou\d|prob_|\bah_|win_to_nil/u.test(source));
  });
});

describe("market → soru", () => {
  const CLOSERS: [ReelSceneType, (data: MatchData) => void][] = [
    ["Q02_POINTS", (data) => { data.outcome_double = null; }],
    ["Q03_COMFORT", (data) => { data.comfortable_win.home = null; }],
    ["Q04_GOALS", (data) => { data.goals.five_plus = null; }],
    ["Q05_BOTH_SCORE", (data) => { data.both_score = null; }],
    ["Q06_TEAM_GOALS", (data) => { data.team_two_plus.home = null; }],
    ["Q07_CLEAN_WIN", (data) => { data.clean_win.home = null; }],
    ["Q08_HT_LEAD", (data) => { data.first_half.draw = null; }],
    ["Q09_HT_GOAL", (data) => { data.first_half.any_goal = null; }],
    ["Q10_HOT_HALF", (data) => { data.half_most_goals = null; }],
    ["Q11_COMEBACK", (data) => { data.comeback.away = null; }],
    ["Q12_FIRST_GOAL", (data) => { data.first_goal.none = null; }],
    ["Q13_PRESSURE", (data) => { data.corners.more = null; }],
    ["Q14_CARDS", (data) => { data.cards.six_plus = null; }],
    ["Q15_PENALTY", (data) => { data.penalty = null; }],
    ["Q16_SCORE", (data) => { data.score_scene_allowed = false; }],
  ];
  it("verisi tam örnekte bütün soru sahneleri açık", () => {
    for (const type of QUESTION_SCENE_TYPES) assert.equal(reasonOf(DERBY, type), null, type);
  });
  it("veri yoksa sahne kendini kapatır ve nedenini döner", () => {
    for (const [type, close] of CLOSERS) {
      const data = clone(DERBY);
      close(data);
      assert.ok((reasonOf(data, type) ?? "").length > 0, type);
    }
  });
  it("simülasyon sayısı yoksa hiçbir soru sahnesi açılmaz", () => {
    const data = clone(DERBY);
    data.model.simulations = null;
    for (const type of QUESTION_SCENE_TYPES) assert.match(reasonOf(data, type) ?? "", /Simülasyon/, type);
  });
  it("şablon: 2 satır başlık + ana rakam + 2–4 destek", () => {
    const scenes = sampleScripts("derbi").pool.scenes.filter((scene): scene is Extract<ReelScene, { type: (typeof QUESTION_SCENE_TYPES)[number] }> => (QUESTION_SCENE_TYPES as readonly string[]).includes(scene.type));
    assert.equal(scenes.length, QUESTION_SCENE_TYPES.length);
    for (const scene of scenes) {
      assert.ok(scene.headline?.line1 && scene.headline.line2, scene.type);
      assert.ok(scene.data.supports.length >= 2 && scene.data.supports.length <= 4, scene.type);
      assert.ok(scene.data.hero.value.length > 0);
    }
  });
  it("sorular istenen metinle", () => {
    const lines = (type: ReelSceneType) => {
      const scene = entryOf(DERBY, type).scene;
      return `${scene?.headline?.line1} ${scene?.headline?.line2}`;
    };
    assert.equal(lines("Q01_WINNER"), "Bu maçta kim kazanır?");
    assert.equal(lines("Q02_POINTS"), "Anadolu bu maçtan puanla çıkar mı?");
    assert.equal(lines("Q03_COMFORT"), "Rahat bir galibiyet mi?");
    assert.equal(lines("Q04_GOALS"), "Gollü maç mı?");
    assert.equal(lines("Q05_BOTH_SCORE"), "İki takım da gol bulur mu?");
    assert.equal(lines("Q06_TEAM_GOALS"), "Boğaziçi 2 ve üzeri gol atar mı?");
    assert.equal(lines("Q07_CLEAN_WIN"), "Boğaziçi kalesini gole kapatıp kazanır mı?");
    assert.equal(lines("Q08_HT_LEAD"), "İlk yarıda kim önde?");
    assert.equal(lines("Q09_HT_GOAL"), "İlk yarıda gol çıkar mı?");
    assert.equal(lines("Q10_HOT_HALF"), "Goller hangi yarıda gelir?");
    assert.equal(lines("Q11_COMEBACK"), "Geriden gelip kazanma senaryosu");
    assert.equal(lines("Q12_FIRST_GOAL"), "İlk gol kimden?");
    assert.equal(lines("Q13_PRESSURE"), "Baskı kimde?");
    assert.equal(lines("Q14_CARDS"), "Sert bir maç mı?");
    assert.equal(lines("Q15_PENALTY"), "Penaltı çıkma ihtimali");
    assert.equal(lines("Q16_SCORE"), "En olası skor");
    assert.equal(lines("Q17_SCORER"), "Golü kim atar?");
  });
  it("golcü şablonu var, gerçek akışta kapalı", () => {
    assert.match(reasonOf(DERBY, "Q17_SCORER", {}) ?? "", /Golcü modeli/);
    assert.equal(reasonOf(DERBY, "Q17_SCORER", { allowScorerScene: true }), null);
  });
  it("tek/çift gol hiçbir yerde yok", () => {
    for (const file of readdirSync("src/story")) assert.ok(!/goals_(odd|even)|\bodd\b|tek gol|çift gol|tek\s*\/\s*çift/iu.test(readFileSync(`src/story/${file}`, "utf8").replace(/\/\*\*[\s\S]*?\*\//g, "")), file);
  });
});

describe("şüpheli alan ve çelişki", () => {
  /** `KESIF_RAPORU.md`'deki gerçek maç. */
  const REAL = { two_plus: 0.6885, three_plus: 0.6621, four_plus: 0.4342, five_plus: 0.1882, distribution: null };
  it("gerçek örnekte gol merdiveni şüpheli: 2 gol %3 çıkıyor, sahne ve özet kapanır", () => {
    assert.match(checkGoals(REAL) ?? "", /şekli bozuk/);
    const data = clone(DERBY);
    data.goals = REAL;
    assert.notEqual(reasonOf(data, "Q04_GOALS"), null);
    assert.match(reasonOf(data, "S16_SUMMARY") ?? "", /şüpheli/);
  });
  it("sağlıklı dağılımlar kapanmaz: az gollü, orta, çok gollü", () => {
    for (const goals of [
      { two_plus: 0.44, three_plus: 0.19, four_plus: 0.07, five_plus: 0.02, distribution: null },
      { two_plus: 0.73, three_plus: 0.48, four_plus: 0.26, five_plus: 0.12, distribution: null },
      { two_plus: 0.86, three_plus: 0.68, four_plus: 0.46, five_plus: 0.27, distribution: null },
    ]) {
      assert.equal(hasDip(barsFromLadder(goals)), false, JSON.stringify(goals));
      assert.equal(checkGoals(goals), null);
    }
  });
  it("aynı olay: merdiven ile simülasyon dağılımı çelişirse sahne kapanır (4+ gol %43 ↔ %19)", () => {
    const goals = { two_plus: 0.69, three_plus: 0.5, four_plus: 0.43, five_plus: 0.1, distribution: [0.12, 0.2, 0.3, 0.19, 0.12, 0.07] };
    assert.match(checkGoals(goals) ?? "", /çelişiyor/);
    assert.equal(checkGoals({ two_plus: 0.68, three_plus: 0.48, four_plus: 0.19, five_plus: 0.07, distribution: [0.12, 0.2, 0.2, 0.29, 0.12, 0.07] }), null);
  });
  it("merdiven azalmıyorsa kapanır", () => {
    assert.match(checkGoals({ two_plus: 0.5, three_plus: 0.6, four_plus: 0.3, five_plus: 0.1, distribution: null }) ?? "", /azalmıyor/);
  });
  it("kart 4+ = 5+ (bilinen şüphe) kapanır, kırmızı kart tek başına kurtarmaz", () => {
    assert.match(checkCards({ four_plus: 0.6107, five_plus: 0.6107, six_plus: 0.5937, red_card: 0.2 }) ?? "", /şüpheli/);
    assert.match(checkCards({ four_plus: 0.7, five_plus: 0.6, six_plus: 0.59, red_card: 0.2 }) ?? "", /şüpheli/);
    assert.equal(checkCards({ four_plus: 0.7, five_plus: 0.5, six_plus: 0.3, red_card: 0.2 }), null);
    const data = clone(DERBY);
    data.cards.five_plus = data.cards.four_plus;
    assert.notEqual(reasonOf(data, "Q14_CARDS"), null);
  });
  it("gerçek örnekte gol yemeden kazanma, iki takım da gol değeriyle çelişiyor", () => {
    const data = { outcome: { home_win: 0.3018, draw: 0.2943, away_win: 0.4039 }, clean_win: { home: 0.1831, away: 0.2631 }, both_score: 0.6549 };
    assert.match(checkCleanWin(data, "home") ?? "", /çelişiyor/);
  });
  it("2+ fark galibiyeti aşarsa, çifte şans sonuçla çelişirse kapanır", () => {
    const comfort = clone(DERBY);
    comfort.comfortable_win.home = 0.5;
    assert.match(reasonOf(comfort, "Q03_COMFORT") ?? "", /aşıyor/);
    const double = clone(DERBY);
    if (double.outcome_double) double.outcome_double.home_or_draw = 0.8;
    assert.match(reasonOf(double, "Q02_POINTS") ?? "", /çelişiyor/);
  });
  it("takım 2+ gol, maçın toplam 2+ golünü aşamaz", () => {
    const data = clone(DERBY);
    data.team_two_plus.home = 0.9;
    assert.match(reasonOf(data, "Q06_TEAM_GOALS") ?? "", /çelişiyor/);
  });
  it("geriden gelme: galibiyet ve ilk yarı değerini aşamaz", () => {
    const data = clone(DERBY);
    data.comeback.home = 0.45;
    assert.match(reasonOf(data, "Q11_COMEBACK") ?? "", /aşıyor/);
  });
});

describe("simülasyon rozeti", () => {
  it("biçim tam, N veriden; sürüm ve saat yok", () => {
    assert.equal(simulationBadge(500000), "MONTE CARLO · 500.000 SİMÜLASYON");
    assert.equal(simulationBadge(100000), "MONTE CARLO · 100.000 SİMÜLASYON");
    const kit = readFileSync("src/design/kit.tsx", "utf8");
    const hud = kit.slice(kit.indexOf("export function StageHud"), kit.indexOf("/** Soru başlığı"));
    assert.ok(!/modelVersion|computedLabel|computedAt|kickoffLabel/u.test(hud));
  });
  it('"simülasyonların %X\'inde" cümlesi hiçbir sahnede kurulmaz', () => {
    for (const key of SAMPLE_KEYS) {
      for (const text of sceneTexts(sampleScripts(key).pool.scenes.map((scene) => [scene.headline, scene.data]))) assert.ok(!/simülasyonların/iu.test(text), text);
    }
  });
});

describe("Nasıl hesapladık?", () => {
  it("örnek liste gerçek akışta kapalı, örnekte açık", () => {
    assert.match(reasonOf(DERBY, "M01_METHOD", {}) ?? "", /örnek liste/);
    assert.equal(reasonOf(DERBY, "M01_METHOD"), null);
    const service = clone(DERBY);
    if (service.model_inputs) service.model_inputs.source = "service";
    assert.equal(reasonOf(service, "M01_METHOD", {}), null);
  });
  it("4–5 sn, üç yığın", () => {
    const scene = entryOf(DERBY, "M01_METHOD").scene;
    assert.ok(scene?.type === "M01_METHOD");
    assert.ok(scene.durationInFrames >= 120 && scene.durationInFrames <= 150);
    assert.equal(scene.data.piles.length, 3);
  });
});

describe("hikâye", () => {
  const stories = [[DERBY, "derby"], [FAVOURITE, "favourite"]] as const;
  it("12–16 sahne, 60–90 sn; kanca → Nasıl hesapladık?; Düello var; özet sonda", () => {
    for (const [data, angle] of stories) {
      const story = pickStory(evaluatePool(data, BRAND, SAMPLE_OPTIONS), angle);
      const types = story.map((scene) => scene.type);
      assert.ok(story.length >= MIN_STORY_SCENES && story.length <= MAX_STORY_SCENES, String(story.length));
      assert.ok(seconds(story) >= MIN_STORY_SECONDS && seconds(story) <= MAX_STORY_SECONDS, String(seconds(story)));
      assert.equal(types.indexOf("M01_METHOD"), types.indexOf("S03_HOOK") + 1);
      assert.ok(types.includes("P01_DUEL"));
      assert.equal(types[0], "S01_COVER");
      assert.equal(types.at(-1), "S16_SUMMARY");
      assert.deepEqual(storyProblems(story, data, seconds(story)), []);
    }
  });
  it("sahneler kapanıp 12'nin altına inince video engellenir", () => {
    const data = clone(DERBY);
    Object.assign(data, { outcome_double: null, half_most_goals: null, penalty: null, both_score: null, score_scene_allowed: false });
    data.comfortable_win = { home: null, away: null };
    data.team_two_plus = { home: null, away: null };
    data.clean_win = { home: null, away: null };
    data.cards.four_plus = null;
    data.corners.more = null;
    data.first_half = { home: null, draw: null, away: null, any_goal: null, two_plus: null };
    data.comeback = { home: null, away: null };
    data.h2h.matches = [];
    data.form.home.last5 = null;
    data.form.home.euro_fatigue_days = 99;
    const story = pickStory(evaluatePool(data, BRAND, SAMPLE_OPTIONS), "derby");
    assert.ok(storyProblems(story, data, seconds(story)).some((problem) => /Sahne sayısı|Süre/u.test(problem)));
  });
  it("Düello ya da yöntem sahnesi yoksa engel", () => {
    const data = clone(DERBY);
    data.players.squad_checked_at = null;
    const story = pickStory(evaluatePool(data, BRAND, SAMPLE_OPTIONS), "derby");
    assert.ok(storyProblems(story, data, seconds(story)).some((problem) => /Düello/.test(problem)));
    const noMethod = pickStory(evaluatePool(DERBY, BRAND, {}), "derby");
    assert.ok(storyProblems(noMethod, DERBY, seconds(noMethod)).some((problem) => /Nasıl hesapladık/.test(problem)));
  });
  it("aynı hafta aynı dizilim tekrarlanmaz; açılış ve kapanış yerinde kalır", () => {
    const pool = evaluatePool(DERBY, BRAND, SAMPLE_OPTIONS);
    const first = pickStory(pool, "derby").map((scene) => scene.type);
    const second = pickStory(pool, "derby", { avoid: [first] }).map((scene) => scene.type);
    const third = pickStory(pool, "derby", { avoid: [first, second] }).map((scene) => scene.type);
    assert.notDeepEqual(second, first);
    assert.notDeepEqual(third, first);
    assert.notDeepEqual(third, second);
    for (const sequence of [second, third]) {
      assert.deepEqual(sequence.slice(0, 4), first.slice(0, 4));
      assert.equal(sequence.at(-1), "S16_SUMMARY");
      assert.deepEqual([...sequence].sort(), [...first].sort());
    }
  });
});

const season = (over: Partial<PlayerSeason> = {}): PlayerSeason => ({ id: 1, name: "A", team_id: 1, appearances: 10, minutes: 900, goals: 5, assists: 2, shots: 30, shots_on_target: 12, key_passes: 9, ...over });
const match = (date: string, goals: number, assists = 0, minutes = 90): OpponentMatch => ({ date, club_id: 1, club_name: "K", club_logo: null, opponent_name: "R", score: "1–0", minutes, goals, assists });

describe("Düello", () => {
  it("istatistikler yan yana, eksik satır düşer, 0 yazılmaz", () => {
    const rows = duelRows(season(), season({ goals: 3, key_passes: null }));
    assert.deepEqual(rows.map((row) => row.key), ["appearances", "minutes", "goals", "assists", "shots", "shots_on_target", "per90"]);
    assert.equal(rows.find((row) => row.key === "goals")?.better, "home");
  });
  it("üstünlük ekrandaki değere göre; eşitte vurgu yok", () => {
    assert.equal(duelRows(season(), season()).find((row) => row.key === "per90")?.better, null);
    assert.equal(duelRows(season({ goals: 5, minutes: 900 }), season({ goals: 5, minutes: 450 })).find((row) => row.key === "per90")?.better, "away");
  });
  it("yıldız: yeterli dakika, en çok gol + asist", () => {
    const low = season({ id: 2, minutes: MIN_DUEL_MINUTES - 1, goals: 20 });
    const star = season({ id: 3, goals: 8 });
    assert.equal(pickStar([low, star, season({ id: 4 })])?.id, 3);
    assert.equal(pickStar([low]), null);
  });
  it("her videoda; kapsam etiketi veride", () => {
    const scene = entryOf(DERBY, "P01_DUEL").scene;
    assert.ok(scene?.type === "P01_DUEL");
    assert.match(scene.data.scope, /Tüm kulvarlar/);
  });
});

describe("Rakibine karşı", () => {
  it("3 maçtan azsa hikâye yok", () => {
    assert.equal(vsOpponentStory({ player_id: 1, matches: [match("2025-01-01", 3), match("2025-06-01", 3)] }, season()), null);
  });
  it("3 maçlık gol/asist serisi yeterli", () => {
    const story = vsOpponentStory({ player_id: 1, matches: [match("2025-01-01", 0, 1), match("2025-03-01", 1), match("2025-06-01", 0, 1)] }, season({ goals: 50 }));
    assert.equal(story?.reason, "streak");
  });
  it("seri tarih sırasına göre, kırılan seri sayılmaz", () => {
    assert.equal(longestContributionStreak([match("2025-06-01", 1), match("2025-01-01", 1), match("2025-03-01", 0)]), 1);
    assert.equal(longestContributionStreak([match("2025-06-01", 1), match("2025-01-01", 1), match("2025-03-01", 1)]), 3);
  });
  it("rakibe karşı gol/90 ≥ 1,5 × sezon gol/90", () => {
    const three = [match("2025-01-01", 1), match("2025-03-01", 0), match("2025-06-01", 1)];
    assert.equal(vsOpponentStory({ player_id: 1, matches: three }, season({ goals: 4, minutes: 900 }))?.reason, "ratio");
    assert.equal(vsOpponentStory({ player_id: 1, matches: three }, season({ goals: 8, minutes: 900 })), null);
  });
  it("hiç gol yoksa sezon golü 0 diye orandan geçmez", () => {
    const three = [match("2025-01-01", 0), match("2025-03-01", 0), match("2025-06-01", 0)];
    assert.equal(vsOpponentStory({ player_id: 1, matches: three }, season({ goals: 0 })), null);
  });
  it("başka kulüpteki maç işaretli, kapsam ekranda, tahmin cümlesi yok", () => {
    const scene = entryOf(DERBY, "P02_VS_OPPONENT").scene;
    assert.ok(scene?.type === "P02_VS_OPPONENT");
    const other = scene.data.timeline.find((item) => item.otherClub);
    assert.equal(other?.club, "Liman Spor");
    assert.ok(other?.clubLogo);
    assert.equal(scene.data.scope, VS_SCOPE);
    assert.ok(!sceneTexts([scene.headline, scene.data]).some((text) => /\b(atar|atacak|atacaktır|kazanacak)\b/iu.test(text)));
  });
  it("hikâyesi olmayan örnekte kapalı", () => {
    assert.match(reasonOf(FAVOURITE, "P02_VS_OPPONENT") ?? "", /gerçek bir hikâye/);
  });
});

describe("kadro doğruluğu", () => {
  /** Kullanıcının test vakası: Salah Ağustos 2026'da Trabzonspor'a geçti; Liverpool kadrosunda değil. Kimlikler API-Football. */
  const SALAH = 306;
  const squads = { home: [{ id: SALAH, name: "Mohamed Salah" }, { id: 7001, name: "Trabzon Oyuncu" }], away: [{ id: 8001, name: "Liverpool Oyuncu" }] };
  const withSalah = (side: "home" | "away"): MatchData => {
    const data = clone(DERBY);
    data.teams.home = { ...data.teams.home, id: 998, name: "Trabzonspor", short_name: "Trabzonspor" };
    data.teams.away = { ...data.teams.away, id: 40, name: "Liverpool", short_name: "Liverpool" };
    data.players.squads = squads;
    const salah = season({ id: SALAH, name: "Mohamed Salah", team_id: side === "home" ? 998 : 40, goals: 9 });
    data.players.candidates = {
      home: side === "home" ? [salah, season({ id: 7001, name: "Trabzon Oyuncu" })] : [season({ id: 7001, name: "Trabzon Oyuncu" })],
      away: side === "away" ? [salah, season({ id: 8001, name: "Liverpool Oyuncu" })] : [season({ id: 8001, name: "Liverpool Oyuncu" })],
    };
    data.players.vs_opponent = [];
    return data;
  };
  it("Salah Trabzonspor'da doğrulanır", () => {
    const data = withSalah("home");
    assert.ok(inSquad(data.players, "home", SALAH));
    const scene = entryOf(data, "P01_DUEL").scene;
    assert.ok(scene?.type === "P01_DUEL");
    assert.equal(scene.data.home.name, "Mohamed Salah");
    assert.equal(scene.data.home.team, "Trabzonspor");
  });
  it("Salah Liverpool adayı olarak gelirse videoya girmez, panelde uyarı çıkar", () => {
    const data = withSalah("away");
    assert.equal(inSquad(data.players, "away", SALAH), false);
    const scene = entryOf(data, "P01_DUEL").scene;
    assert.ok(scene?.type === "P01_DUEL");
    assert.notEqual(scene.data.away.name, "Mohamed Salah");
    const warnings = squadWarnings(data.players, { home: "Trabzonspor", away: "Liverpool" });
    assert.deepEqual(warnings.map((item) => item.playerId), [SALAH]);
    assert.match(warnings[0]?.message ?? "", /Mohamed Salah, Liverpool kadrosunda doğrulanamadı/);
  });
  it("takımda doğrulanan oyuncu kalmazsa Düello kapanır", () => {
    const data = withSalah("away");
    data.players.candidates.away = [season({ id: SALAH, name: "Mohamed Salah" })];
    assert.match(reasonOf(data, "P01_DUEL") ?? "", /Doğrulanmış oyuncu yok: Liverpool/);
  });
  it("eşleşme ad üzerinden değil kimlik üzerinden", () => {
    const data = withSalah("away");
    data.players.squads.away = [{ id: 9999, name: "Mohamed Salah" }];
    assert.equal(inSquad(data.players, "away", SALAH), false);
  });
  it("önbellek en fazla 7 gün; doğrulanmamış kadroda oyuncu sahnesi kapalı", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    assert.equal(SQUAD_MAX_AGE_DAYS, 7);
    assert.equal(squadFreshness("2026-11-01T12:00:00Z", now), null);
    assert.match(squadFreshness("2026-11-01T11:59:00Z", now) ?? "", /7 günden eski/);
    assert.match(squadFreshness(null, now) ?? "", /doğrulanamadı/);
    const data = clone(DERBY);
    data.players.squad_checked_at = "2026-10-30T07:00:00Z";
    assert.match(reasonOf(data, "P01_DUEL") ?? "", /eski/);
    assert.match(reasonOf(data, "P02_VS_OPPONENT") ?? "", /eski/);
    assert.match(reasonOf(data, "Q17_SCORER") ?? "", /eski/);
  });
  it("snapshot alanı senaryoya taşınır", () => {
    assert.equal(sampleScripts("derbi").story.meta.snapshot.squadCheckedAt, DERBY.players.squad_checked_at);
  });
  it("checkmatch oyuncu/kadro verisi kaynakta yok", () => {
    for (const file of ["match-data.ts", "pool.ts", "questions.ts", "players.ts"]) assert.ok(!/season_xg_leaders|player_goalscorers|in_recent_squad/u.test(readFileSync(`src/story/${file}`, "utf8")), file);
  });
});

describe("ad bekçisi", () => {
  const base = { caption: null, data: {} };
  it("örneklerin bütün havuzu temiz: her özel ad veride ya da sözlükte", () => {
    assert.deepEqual(unknownNames(sampleScripts("derbi").pool.scenes, DERBY), []);
    assert.deepEqual(unknownNames(sampleScripts("favori").pool.scenes, FAVOURITE), []);
  });
  it("veride olmayan oyuncu, eski takım ve transfer iddiası yakalanır", () => {
    assert.deepEqual(unknownNames([{ ...base, headline: { line1: "Salah", line2: "Liverpool'dan geldi" } }], DERBY), ["Salah", "Liverpool"]);
  });
  it("ek almış özel ad köke indirgenir", () => {
    assert.deepEqual(unknownNames([{ ...base, headline: { line1: "Boğaziçi'nin", line2: "maçı" } }], DERBY), []);
  });
  it("kadro verisindeki ad geçer", () => {
    const data = clone(DERBY);
    data.players.squads.home.push({ id: 306, name: "Mohamed Salah" });
    assert.deepEqual(unknownNames([{ ...base, headline: { line1: "Mohamed Salah", line2: "sahada" } }], data), []);
  });
  it("story engelleri ad sorununu gösterir", () => {
    const story = pickStory(evaluatePool(DERBY, BRAND, SAMPLE_OPTIONS), "derby");
    const first = story[0];
    assert.ok(first);
    const dirty = [{ ...first, caption: "Liverpool'dan transfer" } as ReelScene, ...story.slice(1)];
    assert.ok(storyProblems(dirty, DERBY, seconds(dirty)).some((problem) => /Liverpool/.test(problem)));
  });
});

describe("tasarım yönleri", () => {
  it("üç yön, aynı 5 sahne", () => {
    assert.deepEqual([...DESIGN_DIRECTIONS], ["A", "B", "C"]);
    for (const direction of DESIGN_DIRECTIONS) assert.deepEqual(boardScript(direction).scenes.map((scene) => scene.type), [...BOARD_SCENES]);
  });
  it("her yön farklı başlık fontu; yön başına en fazla 3 aile; hepsi dosyada ve lisanslı", () => {
    assert.equal(new Set(Object.values(THEMES).map((theme) => theme.display)).size, 3);
    const families = new Set(FONT_FILES.map((font) => font.family));
    for (const theme of Object.values(THEMES)) {
      const own = new Set([theme.display, theme.number, theme.label]);
      assert.ok(own.size <= 3, theme.name);
      for (const family of own) assert.ok(families.has(family as never), family);
      assert.ok(theme.heroSize >= 160 && theme.supportSize >= 48, theme.name);
    }
    for (const font of FONT_FILES) assert.ok(existsSync(`public/fonts/${font.file}`), font.file);
    for (const license of LICENSE_FILES) assert.match(readFileSync(`public/fonts/${license}`, "utf8"), /SIL OPEN FONT LICENSE/, license);
  });
  it("sıkı güvenli alan: Instagram, TikTok, Shorts kesişimi", () => {
    assert.deepEqual([STRICT_SAFE.top, STRICT_SAFE.bottom, STRICT_SAFE.left, STRICT_SAFE.right], [252, 420, 90, 200]);
    assert.equal(W, 790);
    assert.ok(insideSafeArea({ x: 90, y: 252, width: 790, height: 1248 }, 0, STRICT_SAFE));
    assert.ok(!insideSafeArea({ x: 90, y: 252, width: 800, height: 100 }, 0, STRICT_SAFE));
    assert.ok(!insideSafeArea({ x: 90, y: 1400, width: 100, height: 120 }, 0, STRICT_SAFE));
  });
});

describe("kontrast denetimi", () => {
  it("WCAG değerleri", () => {
    assert.ok(Math.abs(contrastRatio(relativeLuminance(255, 255, 255), relativeLuminance(0, 0, 0)) - 21) < 0.01);
    assert.ok(Math.abs(contrastRatio(relativeLuminance(119, 119, 119), relativeLuminance(255, 255, 255)) - 4.48) < 0.02);
  });
  it("en kötü dilim sayılır; tek parlak piksel sonucu bozmaz, geniş parlak bölge yakalanır", () => {
    const white = relativeLuminance(255, 255, 255);
    const dark = relativeLuminance(10, 10, 10);
    assert.ok(worstContrast(white, [...Array<number>(999).fill(dark), white]) > 15);
    assert.ok(worstContrast(white, [...Array<number>(900).fill(dark), ...Array<number>(100).fill(white)]) < 1.1);
  });
  it("renk ayrıştırma", () => {
    assert.deepEqual(parseRgb("rgb(10, 20, 30)"), [10, 20, 30]);
    assert.deepEqual(parseRgb("rgba(10, 20, 30, 0.5)"), [10, 20, 30]);
    assert.equal(parseRgb("transparent"), null);
  });
});
