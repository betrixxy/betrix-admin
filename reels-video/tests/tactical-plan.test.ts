import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ablative, chooseTwist, distributiveWords, genitive, MAX_WORDS, screenWordCount, tacticalCaption, tacticalPlan, type PlanSource } from "../scripts/tactical/plan";
import { bannedHits } from "../scripts/tactical/build";
import * as timelineModule from "../scripts/tactical/timeline";
import { buildTimeline, CLOSE_TIMING, estimated, FPS } from "../scripts/tactical/timeline";

/** Galatasaray – Amed SFK (1584461) dondurmasının plan alanları (11-06 15:34Z). */
const GS_AMED: PlanSource = {
  simulations: 100000,
  outcome: { home_win: 0.749, draw: 0.0903, away_win: 0.1607 },
  threePlus: 0.7972,
  bothScore: 0.6184,
  firstGoal: { home: 0.5761, away: 0.3958, none: 0.0281 },
  home: { name: "Galatasaray", rank: 1, points: 25, venue: { played: 5, win: 4, draw: 1, lose: 0 }, duel: { id: 2780, name: "Osimhen", goals: 9, assists: 3, minutes: 555, shots_on_target: 25 } },
  away: { name: "Amed SFK", rank: 2, points: 23, venue: { played: 4, win: 1, draw: 2, lose: 1 }, duel: { id: 1, name: "Orban", goals: 9, assists: 4, minutes: 749, shots_on_target: 15 } },
  duelScope: "Trendyol Süper Lig · bu sezon",
};

/** senaryo-tactical.txt SES satırları, kullanıcı onayı 2026-11-07 17:19; kanca kullanıcı metni (son düzeltme, 2026-11-07). */
const APPROVED = [
  "Galatasaray yüzde yetmiş beş favori… ama ilk golde sürpriz var. Analiz modelimizle bu maçı yüz bin kez simüle ettik.",
  "Yüzde dokuz beraberlik, yüzde on altı Amed SFK, çünkü Galatasaray iç sahada beş maçtır kaybetmedi.",
  "Yüzde seksen ihtimalle üç ve daha fazla gol.",
  "Yüzde altmış iki ihtimalle iki takım da gol atar. Yüzde elli sekiz ilk gol Galatasaray'dan, ama yüzde kırk Amed SFK'dan.",
  "Bir ve iki: Galatasaray yirmi beş, Amed SFK yirmi üç puan.",
  "Dokuzar gol: Osimhen ve Orban. Yirmi beş isabetli şutla Osimhen önde.",
  "Listeyi kaydet, maçtan sonra birlikte bakalım. Tüm analiz checkmatch nokta net'te. Sence skor ne olur? Yorumlara yaz.",
];

describe("taktik tahtası senaryosu", () => {
  const { items, problems } = tacticalPlan(GS_AMED);

  it("snapshot'tan kurulan ses metni onaylı senaryoyla birebir", () => {
    assert.deepEqual(problems, []);
    assert.deepEqual(items.map((item) => item.sentence), APPROVED);
    assert.deepEqual(items.map((item) => item.kind), ["hook", "outcome", "goals", "both", "why", "duel", "close"]);
    assert.ok(items.reduce((sum, item) => sum + screenWordCount(item.sentence), 0) <= MAX_WORDS);
    assert.equal(items[0]?.voiceText, `[excited] ${APPROVED[0]}`);
    assert.deepEqual([items[0]?.values.hookLine1, items[0]?.values.hookLine2, items[0]?.values.hookAccent, items[0]?.values.twist], ["Galatasaray %75 favori", "ama ilk golde sürpriz var", "sürpriz", "first"]);
    assert.equal(items[0]?.values.countLabel, "Analiz modeli · maç simülasyonu");
    // Açık döngü "both" beat'inde (ilk gol paneli) kapanır.
    assert.equal(items.find((item) => item.kind === "both")?.values.surprise, "first");
    assert.equal(items.find((item) => item.kind === "goals")?.values.surprise, "none");
  });

  it("ekran değerleri aynı kaynaktan; gol çubukları tamamlayıcı", () => {
    const values = Object.fromEntries(items.map((item) => [item.kind, item.values]));
    assert.deepEqual([values.outcome?.home, values.outcome?.draw, values.outcome?.away], [75, 9, 16]);
    assert.equal(values.outcome?.because, "İç sahada 5 maç: 4 galibiyet, 1 beraberlik, 0 yenilgi");
    assert.equal(Number(values.goals?.over) + Number(values.goals?.under), 100);
    assert.deepEqual([values.both?.both, values.both?.firstHome, values.both?.firstAway, values.both?.firstNone], [62, 58, 40, 3]);
    assert.equal(values.why?.homeRecord, "Galatasaray iç saha 4G 1B 0M");
    assert.equal(values.why?.awayRecord, "Amed SFK deplasman 1G 2B 1M");
    assert.deepEqual([values.duel?.per90Home, values.duel?.per90Away, values.duel?.scope], ["1,95", "1,56", "Süper Lig · bu sezon"]);
    assert.deepEqual([values.close?.c1, values.close?.c2, values.close?.c3, values.close?.c4], ["Kazanan: Galatasaray %75", "3 ve daha fazla gol %80", "İki takım da gol %62", "İlk gol: Galatasaray %58"]);
  });

  it("skor hiçbir yerde yok (servis kapalı: skor dağılımı plana girmez)", () => {
    const all = JSON.stringify(items) + tacticalCaption(GS_AMED, items);
    // "Sence skor ne olur?" kapanış sorusu skor değildir; rakamlı skor kalıbı (2-1, 2–1) hiçbir metinde yok.
    assert.doesNotMatch(all, /\d\s*[-–]\s*\d|en sık skor|score/iu);
  });

  it("çünkü yan cümlesi yalnız olgu tutarsa; tutmazsa cümle çünküsüz kurulur (engel değil)", () => {
    const beaten = tacticalPlan({ ...GS_AMED, home: { ...GS_AMED.home, venue: { played: 5, win: 3, draw: 1, lose: 1 } } });
    assert.deepEqual(beaten.problems, []);
    assert.equal(beaten.items[1]?.sentence, "Yüzde dokuz beraberlik, yüzde on altı Amed SFK.");
  });

  it("düello: goller farklıysa önde olan söylenir", () => {
    const uneven = tacticalPlan({ ...GS_AMED, away: { ...GS_AMED.away, duel: { ...GS_AMED.away.duel!, goals: 8 } } });
    assert.deepEqual(uneven.problems, []);
    assert.equal(uneven.items.find((item) => item.kind === "duel")?.sentence, "Dokuz golle Osimhen önde, Orban sekiz golde.");
  });

  it("kanca çelişkisi sırayla: ilk gol ≥ %35, iki takım gol ≥ %55, 3+ gol ≥ %65, yoksa soru", () => {
    assert.equal(chooseTwist({ underdogFirst: 35, both: 70, three: 90 }).kind, "first");
    assert.equal(chooseTwist({ underdogFirst: 34, both: 55, three: 90 }).kind, "both");
    assert.equal(chooseTwist({ underdogFirst: 34, both: 54, three: 65 }).kind, "goals");
    assert.equal(chooseTwist({ underdogFirst: 34, both: 54, three: 64 }).kind, "question");
    const question = tacticalPlan({ ...GS_AMED, firstGoal: { home: 0.7, away: 0.25, none: 0.05 }, bothScore: 0.4, threePlus: 0.5 });
    assert.equal(question.items[0]?.sentence, "Galatasaray yüzde yetmiş beş favori… peki kaç gol çıkar? Analiz modelimizle bu maçı yüz bin kez simüle ettik.");
    assert.equal(question.items.find((item) => item.kind === "both")?.values.surprise, "none");
    const goals = tacticalPlan({ ...GS_AMED, firstGoal: { home: 0.7, away: 0.25, none: 0.05 }, bothScore: 0.4 });
    assert.match(goals.items[0]?.sentence ?? "", /ama gol yağmuru ihtimali yüksek\./u);
    assert.equal(goals.items.find((item) => item.kind === "goals")?.values.surprise, "goals");
  });

  it("favori yoksa (< %45) kanca başa baş ile başlar", () => {
    const even = tacticalPlan({ ...GS_AMED, outcome: { home_win: 0.41, draw: 0.21, away_win: 0.38 } });
    assert.equal(even.items[0]?.sentence, "Bu maç başa baş: Galatasaray yüzde kırk bir, Amed SFK yüzde otuz sekiz. Analiz modelimizle bu maçı yüz bin kez simüle ettik.");
    assert.deepEqual([even.items[0]?.values.hookLine1, even.items[0]?.values.hookLine2, even.items[0]?.values.twist], ["Bu maç başa baş", "%41 – %38", "none"]);
  });

  it("'yapay zekâ' hiçbir yerde yok (yasak listede)", () => {
    assert.equal(bannedHits(["Yapay zekâ ile hesapladık"]).length, 1);
    assert.equal(bannedHits(["yapay zeka"]).length, 1);
    const all = [...items.flatMap((item) => [item.sentence, item.voiceText ?? "", ...Object.values(item.values).map(String)]), tacticalCaption(GS_AMED, items)];
    assert.deepEqual(bannedHits(all), []);
  });

  it("ekran sözcük sayımı: rakam öbeği tek sözcük", () => {
    assert.equal(screenWordCount("Yüzde seksen ihtimalle üç ve daha fazla gol."), 7);
    assert.equal(screenWordCount("Galatasaray yirmi beş, Amed SFK yirmi üç puan."), 6);
  });


  it("Türkçe ekler", () => {
    assert.equal(ablative("Galatasaray"), "Galatasaray'dan");
    assert.equal(ablative("Amed SFK"), "Amed SFK'dan");
    assert.equal(ablative("Beşiktaş"), "Beşiktaş'tan");
    assert.equal(ablative("Fenerbahçe"), "Fenerbahçe'den");
    assert.equal(genitive("Amed SFK"), "Amed SFK'nın");
    assert.equal(genitive("Galatasaray"), "Galatasaray'ın");
    assert.equal(genitive("Göztepe"), "Göztepe'nin");
    assert.equal(distributiveWords(9), "dokuzar");
    assert.equal(distributiveWords(4), "dörder");
    assert.equal(distributiveWords(12), "on ikişer");
  });

  it("açıklama: 5 hashtag, skor yok, yasal uyarı", () => {
    const caption = tacticalCaption(GS_AMED, items);
    assert.match(caption, /^100 bin simülasyonda Galatasaray %75 — Amed SFK'nın ilk golü atma ihtimali ise %40\./u);
    assert.equal(caption.match(/#\S+/gu)?.length, 5);
    assert.match(caption, /Yasal uyarı:/u);
    assert.ok(caption.split("\n").includes("Maçın tüm analizi ve 20+ ihtimal: www.checkmatch.net (link profilde)"));
    assert.doesNotMatch(caption, /@checkmatch/u);
  });
});

describe("taktik tahtası zaman çizelgesi", () => {
  const { items } = tacticalPlan(GS_AMED);
  // 2,64 sözcük/sn: 11-07 kancasında ölçülen gerçek hız (cümle içi sessizlik kırpıldıktan sonra).
  const timeline = buildTimeline(items.map((item) => estimated(item, 2.64)));

  it("beat'ler ardışık, toplam 35–45 sn (kalıcı üst sınır 45)", () => {
    timeline.beats.forEach((beat, index) => { if (index) assert.equal(beat.from, (timeline.beats[index - 1]?.from ?? 0) + (timeline.beats[index - 1]?.duration ?? 0)); });
    const seconds = timeline.durationInFrames / FPS;
    assert.ok(seconds >= 35 && seconds <= 45, `${seconds}`);
  });

  it("iki cümleli beat'te ikinci katman ikinci cümlenin ilk sözcüğünde", () => {
    const both = timeline.beats.find((beat) => beat.kind === "both");
    assert.ok(typeof both?.values.sentence2At === "number" && both.values.sentence2At > 0);
  });

  it("kapanış: 4 tık sesten önce, logo ses bitince, bekleme ≤ 1 sn; tık anları ses izine gider", () => {
    const close = timeline.beats.find((beat) => beat.kind === "close");
    assert.ok(close);
    const ticks = [1, 2, 3, 4].map((k) => Number(close.values[`t${k}`]));
    const logoAt = Number(close.values.logoAt);
    assert.ok(ticks.every((frame, k) => k === 0 || frame > (ticks[k - 1] ?? 0)));
    assert.ok((ticks[3] ?? 0) < logoAt);
    assert.equal(close.duration - logoAt - CLOSE_TIMING.logoDraw, CLOSE_TIMING.logoHold);
    assert.ok(CLOSE_TIMING.logoHold / FPS <= 1);
    assert.equal(timeline.ticks.length, 5);
  });
});

describe("taktik tahtası altyazısı", () => {
  it("okunan site adı ekranda alan adı olarak yazılır", () => {
    const { screenWords } = timelineModule;
    const words = ["Tüm", "analiz", "checkmatch", "nokta", "net'te."].map((text, index) => ({ text, start: index, end: index + 0.5 }));
    assert.deepEqual(screenWords(words).map((word) => word.text), ["Tüm", "analiz", "www.checkmatch.net'te."]);
    assert.deepEqual(screenWords(words).at(-1), { text: "www.checkmatch.net'te.", start: 2, end: 4.5 });
  });
});
