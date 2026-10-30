import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMatchAnalysisCaption } from "@/lib/dashboard/match-analysis-caption";
import { buildHalvesCard, buildTimelineCard, timelineRows } from "@/lib/dashboard/match-analysis-card";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { hashtagCount, hasLink } from "@/lib/dashboard/vitrin-caption";
import { assembleMatchAnalysisFacts } from "@/lib/match-analysis/assemble";
import { analysisFacts } from "@/lib/match-analysis/facts";
import { chooseHalves } from "@/lib/match-analysis/halves";
import { withEventNames } from "@/lib/match-analysis/names";
import { mergeSubstitutions, planTimeline } from "@/lib/match-analysis/timeline";
import type { TeamPeople } from "@/lib/names/person-name";
import { contentLanguageGate } from "@/lib/prediction/content-language";
import { toAnalysisEvents, varLabel } from "@/lib/services/api-football/analysis-events-mappers";
import { apiFootballHalfRows } from "@/lib/services/api-football/half-stats-mappers";
import { sportmonksHalfRows } from "@/lib/services/sportmonks/period-stats-mappers";
import type { HalvesOutcome, MatchAnalysisFacts } from "@/types/match-analysis";
import { KURGU_AWAY, KURGU_HOME, RAW_DENSE_MATCH, RAW_EXTRA_TIME_MATCH, RAW_RED_CARD_MATCH, syntheticHalves } from "../fixtures/api-football/match-analysis";
import { HALF_KONYASPOR_GALATASARAY, RAW_KONYASPOR_GALATASARAY, SM_KONYASPOR_GALATASARAY_IDS, SM_PERIODS_KONYASPOR_GALATASARAY } from "../fixtures/api-football/match-analysis-real";

/**
 * Maç Analizi (kural tabanlı): olay sıralaması (aynı dakika, uzatma dakikası), KK tarafı, penaltı işareti, kırılma
 * anı kuralları, kırmızı kart sonrası olgu, devre verisi yok → 02 düşer (sebepli), TEK KAYNAK (API-Football'da
 * eksik satır Sportmonks'tan DOLDURULMAZ), olgular deterministik, yoğunluk kuralı, gönderi metni.
 */

const KG_IDS = { home: 607, away: 645 };
const NO_HALVES: HalvesOutcome = { available: false, reason: "test" };
const afRows = apiFootballHalfRows(HALF_KONYASPOR_GALATASARAY, KG_IDS);
const facts = (raw = RAW_KONYASPOR_GALATASARAY, halves: HalvesOutcome = chooseHalves(afRows, null, false)): MatchAnalysisFacts => {
  const assembled = assembleMatchAnalysisFacts(raw, halves);
  assert.ok(assembled, "bitmiş maç olmalı");
  return assembled;
};
const people = (overrides: [number, string][] = []): TeamPeople => ({ people: [], overrides: new Map(overrides), teamHint: "tr" });

describe("olaylar — sıralama, uzatma dakikası, KK, penaltı", () => {
  it("uzatma dakikası: 45+6' 46'dan önce, 90+3' 90'dan sonra; aynı dakikada sağlayıcı sırası", () => {
    const events = toAnalysisEvents(RAW_KONYASPOR_GALATASARAY);
    const labels = events.map((event) => event.minuteLabel);
    assert.deepEqual(labels.slice(4, 7), ["45+6'", "46'", "46'"]);
    // 61'de beş Galatasaray değişikliği — sağlayıcının sırası korunur.
    assert.deepEqual(events.filter((event) => event.minuteLabel === "61'").map((event) => event.player?.name), ["Y. Akgun", "A. Batrakov", "V. Osimhen", "L. Torreira", "Gabriel Sara"]);
    const extra = toAnalysisEvents(RAW_EXTRA_TIME_MATCH).map((event) => event.minuteLabel);
    assert.deepEqual(extra, ["45+3'", "46'", "90+5'", "105+1'", "106'", "118'"], "penaltı atışları çizelgeye girmez");
  });

  it("değişiklikte player ÇIKAN, assist GİREN; gol sayısı ve skor resmi skorla aynı", () => {
    const sub = toAnalysisEvents(RAW_KONYASPOR_GALATASARAY).find((event) => event.kind === "SUBSTITUTION");
    assert.deepEqual([sub?.player?.name, sub?.related?.name], ["B. Gungordu", "D. Ertas"]);
    const kg = facts();
    assert.equal(kg.scoreConsistent, true);
    assert.deepEqual(kg.halftime, { home: 0, away: 2 });
    assert.equal(kg.axisEnd, 90);
  });

  it("KK olayın takımına yazılır (taraf çevrilmez), ad önce rakip kadrosunda aranır; P işareti, kaçan penaltı skoru değiştirmez", () => {
    const red = facts(RAW_RED_CARD_MATCH, NO_HALVES);
    const own = red.events.find((event) => event.kind === "OWN_GOAL");
    assert.equal(own?.side, "HOME");
    assert.deepEqual(own?.score, { home: 2, away: 1 });
    const missed = red.events.find((event) => event.kind === "MISSED_PENALTY");
    assert.equal(missed?.score, null);
    assert.equal(red.events.filter((event) => event.kind === "GOAL").length, 2, "VAR'ın iptal ettiği gol sayılmaz");
    assert.equal(red.events.find((event) => event.kind === "VAR")?.varLabel, "Gol iptal");
    // Arşiv düzeltmesi yalnızca rakipte (Güneyspor) — KK golcüsü orada bulunur.
    const ownId = own?.player?.playerId ?? -1;
    const named = withEventNames(red, { home: people(), away: people([[ownId, "Bekir Şahinoğlu"]]) });
    assert.equal(named.events.find((event) => event.kind === "OWN_GOAL")?.player?.name, "B. Şahinoğlu");
    const rows = timelineRows(mergeSubstitutions(named.events), named);
    assert.deepEqual(rows.find((row) => row.kind === "OWN_GOAL")?.mark, "(KK)");
    assert.deepEqual(rows.find((row) => row.kind === "PENALTY_GOAL")?.mark, "(P)");
    assert.deepEqual(rows.find((row) => row.kind === "MISSED_PENALTY")?.mark, "(P KAÇTI)");
  });

  it("VAR kararı kısa Türkçe etiket; bilinmeyen karar 'VAR'", () => {
    assert.equal(varLabel("Goal Disallowed - offside"), "Gol iptal");
    assert.equal(varLabel("Penalty confirmed"), "Penaltı verildi");
    assert.equal(varLabel("Card upgrade"), "Kırmızı kart");
    assert.equal(varLabel("Something new"), "VAR");
    assert.equal(varLabel(null), "VAR");
  });
});

describe("kırılma anı", () => {
  it("Konyaspor 0-4 Galatasaray: yalnızca ilk gol (fark açan goller kırılma anı değil)", () => {
    const moments = facts().events.filter((event) => event.breakMoment).map((event) => [event.minuteLabel, event.breakMoment?.label]);
    assert.deepEqual(moments, [["12'", "İLK GOL"]]);
  });

  it("ilk gol, eşitlik, 10 kişi, kırmızı sonrası gol; 90+4' fark açan gol etiketsiz", () => {
    const moments = facts(RAW_RED_CARD_MATCH, NO_HALVES).events.filter((event) => event.breakMoment).map((event) => [event.minuteLabel, event.breakMoment?.kind, event.breakMoment?.label]);
    assert.deepEqual(moments, [
      ["10'", "FIRST_GOAL", "İLK GOL"],
      ["22'", "EQUALISER", "EŞİTLİK"],
      ["30'", "SENT_OFF", "10 KİŞİ"],
      ["38'", "AFTER_RED", "KIRMIZI SONRASI"],
    ]);
  });

  it("eşitlik bozuldu ve uzatmalar: 106' öne geçiş, 118' eşitlik; eksen 120", () => {
    const et = facts(RAW_EXTRA_TIME_MATCH, NO_HALVES);
    assert.equal(et.axisEnd, 120);
    assert.deepEqual(et.events.filter((event) => event.breakMoment).map((event) => [event.minuteLabel, event.breakMoment?.label]), [["46'", "İLK GOL"], ["90+5'", "EŞİTLİK"], ["106'", "EŞİTLİK BOZULDU"], ["118'", "EŞİTLİK"]]);
  });

  it("olay akışı resmi skorla tutmuyorsa etiket yok, uyarı var", () => {
    const broken = { ...RAW_RED_CARD_MATCH, goals: { home: 4, away: 1 } };
    const result = facts(broken, NO_HALVES);
    assert.equal(result.scoreConsistent, false);
    assert.equal(result.events.some((event) => event.breakMoment), false);
    assert.match(result.warnings[0] ?? "", /resmi skorla/u);
  });
});

describe("02 · devre verisi — tek kaynak", () => {
  it("API-Football devre satırları: değer metinleri sayıya, beş satır", () => {
    assert.deepEqual(afRows.map((row) => row.key), ["possession", "shotsTotal", "shotsOnTarget", "xg", "corners"]);
    assert.deepEqual(afRows.find((row) => row.key === "xg"), { key: "xg", first: { home: 1.01, away: 0.86 }, second: { home: 0.18, away: 1.67 } });
  });

  it("Sportmonks dönemleri: xG yok → dört satır", () => {
    const rows = sportmonksHalfRows(SM_PERIODS_KONYASPOR_GALATASARAY, SM_KONYASPOR_GALATASARAY_IDS);
    assert.deepEqual(rows.map((row) => row.key), ["possession", "shotsTotal", "shotsOnTarget", "corners"]);
    assert.deepEqual(rows[0], { key: "possession", first: { home: 47, away: 53 }, second: { home: 46, away: 54 } });
  });

  it("API-Football seçildiyse eksik satır Sportmonks'tan DOLDURULMAZ (satır düşer)", () => {
    const withoutXg = apiFootballHalfRows(syntheticHalves(KG_IDS, { possession: [50, 50, 40, 60], shots: [3, 4, 5, 6], onTarget: [1, 2, 3, 4], corners: [1, 2, 3, 4] }), KG_IDS);
    const smWithXg = [{ key: "xg" as const, first: { home: 0.5, away: 0.4 }, second: { home: 1.1, away: 0.2 } }];
    const chosen = chooseHalves(withoutXg, smWithXg);
    assert.ok(chosen.available);
    assert.equal(chosen.stats.source, "API_FOOTBALL");
    assert.equal(chosen.stats.rows.some((row) => row.key === "xg"), false);
  });

  it("API-Football yetersizse BÜTÜN satırlar Sportmonks'tan; tek satır API-Football kullanılmaz", () => {
    const smRows = sportmonksHalfRows(SM_PERIODS_KONYASPOR_GALATASARAY, SM_KONYASPOR_GALATASARAY_IDS);
    const chosen = chooseHalves(afRows.slice(0, 1), smRows);
    assert.ok(chosen.available);
    assert.equal(chosen.stats.source, "SPORTMONKS");
    assert.deepEqual(chosen.stats.rows, smRows);
  });

  it("iki kaynakta da yoksa 02 düşer, sebep Türkçe; 01 yine üretilir", () => {
    const none = chooseHalves([], null);
    assert.equal(none.available, false);
    assert.match(none.available ? "" : none.reason, /Devre verisi yok — 02 · Devre Devre üretilmedi \(API-Football bu maç için devre verisi vermiyor; Sportmonks okunamadı ya da maç eşleşmedi\)/u);
    const result = facts(RAW_KONYASPOR_GALATASARAY, none);
    const card = buildTimelineCard(result, MATCH_DAY_FRAMES.IG_PORTRAIT, { homeLogo: null, awayLogo: null, brandLogo: "" });
    assert.ok(card.rows.length > 0);
    assert.ok(result.facts.every((fact) => !["SHOTS_BOTH_HALVES", "NO_SHOT_ON_TARGET_HALF"].includes(fact.kind)), "devre satırına bağlı olgu yok");
  });
});

describe("olgular — kural tabanlı, deterministik", () => {
  it("Konyaspor 0-4 Galatasaray: üç olgu, öncelik sırasıyla", () => {
    assert.deepEqual(facts().facts.map((fact) => fact.text), [
      "Konyaspor ikinci yarıda isabetli şut çekemedi.",
      "Galatasaray iki yarıda da rakibinden çok şut çekti: ilk yarı 8, ikinci yarı 6.",
      "Yarı skorları: ilk yarı 0-2, ikinci yarı 0-2.",
    ]);
  });

  it("kırmızı kart sonrası gol yeme olgusu en önde", () => {
    const red = facts(RAW_RED_CARD_MATCH, NO_HALVES);
    assert.equal(red.facts[0]?.text, `${KURGU_AWAY.name} 10 kişi kaldıktan sonra 2 gol yedi.`);
  });

  it("şut sayısı katlandı (ondalık yok), xG ondalık virgül, aynı girdi aynı çıktı", () => {
    const halves = chooseHalves(apiFootballHalfRows(syntheticHalves({ home: KURGU_HOME.id, away: KURGU_AWAY.id }, { possession: [40, 60, 55, 45], shots: [2, 6, 7, 3], onTarget: [1, 3, 4, 1], xg: ["0.40", "0.90", "1.35", "0.30"], corners: [1, 2, 5, 1] }), { home: KURGU_HOME.id, away: KURGU_AWAY.id }), null, false);
    const input = { ...facts(RAW_RED_CARD_MATCH, halves), facts: [] };
    const run = () => analysisFacts({ events: input.events, halftime: input.halftime, final: { home: 3, away: 1 }, outcome: "HOME", names: { HOME: KURGU_HOME.name, AWAY: KURGU_AWAY.name }, halves, scoreConsistent: true });
    const texts = run().map((fact) => fact.text);
    assert.deepEqual(texts, [`${KURGU_AWAY.name} 10 kişi kaldıktan sonra 2 gol yedi.`, `${KURGU_HOME.name} ikinci yarıda şut sayısını 3 katından fazlasına çıkardı (2 → 7).`, `${KURGU_HOME.name} ikinci yarıda topa sahip olmada 15 puan artış yakaladı (%40 → %55).`]);
    assert.deepEqual(run(), run());
    const xg = analysisFacts({ events: [], halftime: { home: 0, away: 0 }, final: { home: 0, away: 0 }, outcome: "DRAW", names: { HOME: "A", AWAY: "B" }, halves, scoreConsistent: false });
    assert.ok(xg.some((fact) => fact.text === "A ikinci yarıda 1,35 xG üretti (ilk yarı 0,40)."), JSON.stringify(xg));
  });
});

describe("kart, yoğunluk, gönderi metni", () => {
  it("02 kartı: yüzde, xG virgül, kaynak dipnotta", () => {
    const kg = facts();
    assert.ok(kg.halves.available);
    const card = buildHalvesCard(kg, kg.halves.stats, { homeLogo: null, awayLogo: null, brandLogo: "" });
    assert.deepEqual(card.rows[0]?.first, { home: "%47", away: "%53", homeShare: 0.47 });
    assert.equal(card.rows.find((row) => row.key === "xg")?.second.away, "1,67");
    assert.equal(card.footnote, "Devre verisi: API-Football · Olaylar: API-Football");
    assert.equal(card.title, "MAÇ ANALİZİ");
  });

  it("aynı takım + aynı dakika değişiklikleri birleşir; sığmazsa önce değişiklikler, sonra sarılar düşer", () => {
    const dense = facts(RAW_DENSE_MATCH, NO_HALVES);
    const merged = mergeSubstitutions(dense.events);
    assert.equal(merged.length, dense.events.length - 3, "46' iki ev sahibi + 61' üç deplasman değişikliği birleşir");
    const plan = planTimeline(dense.events, (groups) => groups.length <= 14);
    assert.equal(plan.omitted.substitutions, 10);
    assert.equal(plan.omitted.yellows, 9);
    assert.ok(plan.groups.every((group) => !["SUBSTITUTION", "YELLOW"].includes(group[0]?.kind ?? "")));
    const square = buildTimelineCard(dense, MATCH_DAY_FRAMES.IG_SQUARE, { homeLogo: null, awayLogo: null, brandLogo: "" });
    assert.match(square.footnote, /oyuncu değişikliği sığmadığı için yazılmadı/u);
  });

  it("gönderi metni: ≤5 hashtag, link yok, bahis dili kapısından geçer", () => {
    const caption = buildMatchAnalysisCaption(facts());
    assert.ok(hashtagCount(caption) <= 5);
    assert.equal(hasLink(caption), false);
    assert.equal(/checkmatch\.net|betrix/iu.test(caption), false);
    assert.equal(contentLanguageGate({ caption }), null);
    assert.match(caption, /12' ilk gol — Galatasaray \(0-1\)/u);
  });
});
