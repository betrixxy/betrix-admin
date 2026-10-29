import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BANNED_WORDS, bannedWordsGate, findBannedWords } from "@/lib/prediction/banned-words";
import { openBoxLines, outcomeLabel, scenarioTitle } from "@/lib/prediction/catalog";
import { predictInternal, scenarioSummary, scenariosFrom } from "@/lib/prediction/internal-source";
import { expectedGoals, matchProbabilities, scoreMatrix, sumWhere } from "@/lib/prediction/poisson";
import { auditReason, matchSides, ruleReason, vitrinFacts, XG_MIN_SAMPLE, XG_SCOPE_PHRASE } from "@/lib/prediction/reasons";
import { computeTeamDeepStats } from "@/lib/services/api-football/deep-analysis-mappers";
import type { DeepAnalysisStats, SeasonLeagueXg, TeamDeepStats } from "@/types/deep-analysis";
import { DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM } from "../fixtures/api-football/deep-analysis";
import { PICK } from "../fixtures/prediction/outcomes";
import { SCENARIO_IDS } from "@/types/prediction";
import type { TeamRecentForm } from "@/types/sports";

const form = (overrides: Partial<TeamRecentForm> = {}): TeamRecentForm => ({
  teamId: "1",
  teamName: "Takım",
  logoUrl: "",
  last5: ["W", "W", "D", "L", "W"],
  matchesSampled: 5,
  goalsForAvg: 1.8,
  goalsAgainstAvg: 0.8,
  xgForAvg: null,
  xgAgainstAvg: null,
  xgMatchesSampled: 0,
  ...overrides,
});

const close = (actual: number, expected: number, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≠ ${expected}`);

describe("dil kapısı — bahis dili yok", () => {
  it("yasaklı liste sabit", () => {
    assert.deepEqual([...BANNED_WORDS], ["MS1", "MSX", "MS2", "KG", "karşılıklı gol", "alt", "üst", "oran", "kupon", "bahis", "iddaa", "market", "banko"]);
  });

  it("yasaklı sözcükleri yakalar (büyük/küçük harf, ekli halleri)", () => {
    assert.deepEqual(findBannedWords("MS1 ve KG var"), ["MS1", "KG"]);
    assert.deepEqual(findBannedWords("2.5 ÜST biter, alt zor"), ["alt", "üst"]);
    assert.deepEqual(findBannedWords("Karşılıklı goller gelir"), ["karşılıklı gol"]);
    assert.deepEqual(findBannedWords("Bahisçiler bu kuponu sever, iddaada banko"), ["kupon", "bahis", "iddaa", "banko"]);
    assert.deepEqual(findBannedWords("Market önerisi: oran 1.80"), ["oran", "market"]);
  });

  it("analiz dili geçer: altyapı, üstün, pas isabet oranı, alternatif", () => {
    assert.deepEqual(findBannedWords("Altyapıdan gelen üstün oyuncu, pas isabet oranı %88, alternatif plan"), []);
    assert.deepEqual(findBannedWords("İki takım da gol bulur mu? Evet %64"), []);
  });

  it("'üst üste' istisnası: serbest; 'üst' tek başına yasaklı kalır", () => {
    assert.deepEqual(findBannedWords("Galatasaray üst üste 3 maç kazandı"), []);
    assert.deepEqual(findBannedWords("Üst üste iki deplasmanda gol atamadı"), []);
    assert.deepEqual(findBannedWords("Üst üste 3 galibiyet, maç üst biter"), ["üst"]);
    assert.deepEqual(findBannedWords("üst"), ["üst"]);
  });

  it("kapı okunur sebep döner", () => {
    assert.equal(bannedWordsGate({ gerekçe: "temiz metin" }), null);
    assert.equal(bannedWordsGate({ gerekçe: "KG var" }), "Bahis dili yasak — gerekçe: KG");
  });
});

describe("Poisson modeli", () => {
  it("skor matrisi toplamı 1; bilinen değer", () => {
    const matrix = scoreMatrix(1.5, 1.0);
    close(sumWhere(matrix, () => true), 1);
    // P(0-0) = e^-1.5 · e^-1 (kesilen kuyruk ihmal edilebilir)
    close(matrix[0]![0]!, Math.exp(-2.5), 1e-6);
  });

  it("beklenen goller: gol/rakip yediği ortalaması × iç saha katsayısı; yetersiz veri null", () => {
    const goals = expectedGoals(form({ goalsForAvg: 2, goalsAgainstAvg: 1 }), form({ goalsForAvg: 1, goalsAgainstAvg: 2 }));
    assert.ok(goals);
    close(goals.home, ((2 + 2) / 2) * 1.1);
    close(goals.away, ((1 + 1) / 2) * 0.92);
    assert.equal(expectedGoals(form({ matchesSampled: 2 }), form()), null);
    assert.equal(expectedGoals(form({ goalsForAvg: null, xgForAvg: null }), form()), null);
  });

  it("xG varsa gol ile 50/50 harmanlanır", () => {
    const goals = expectedGoals(form({ goalsForAvg: 2, xgForAvg: 1, goalsAgainstAvg: 1 }), form({ goalsForAvg: 1, goalsAgainstAvg: 1 }));
    close(goals!.home, ((1.5 + 1) / 2) * 1.1);
  });

  it("1X2 ve ilk yarı olasılıkları 1'e tamamlanır; 4+ ≤ 3+; COMBO ≤ galibiyet", () => {
    const p = matchProbabilities({ home: 1.9, away: 0.9 });
    close(p.result.HOME + p.result.DRAW + p.result.AWAY, 1);
    close(p.halfTime.HOME + p.halfTime.DRAW + p.halfTime.AWAY, 1);
    assert.ok(p.goals4plus < p.goals3plus);
    assert.ok(p.combo.HOME < p.result.HOME);
    assert.ok(p.halfTime.DRAW > p.result.DRAW, "ilk yarıda beraberlik daha olası");
  });
});

describe("senaryo seti — iç kaynak", () => {
  const p = matchProbabilities({ home: 1.9, away: 0.9 });
  const scenarios = scenariosFrom(p);

  it("6 senaryo, katalog sırasıyla; seçilen = en olası", () => {
    assert.deepEqual(scenarios.map((s) => s.id), [...SCENARIO_IDS]);
    const result = scenarios[0]!;
    assert.equal(result.outcome.pick, "HOME");
    close(result.probability, p.result.HOME);
    const combo = scenarios.find((s) => s.id === "COMBO")!;
    assert.equal(combo.outcome.scenario === "COMBO" && combo.outcome.team, "HOME", "COMBO'nun takımı favori");
  });

  it("evet/hayır senaryolarında seçilen olasılık ≥ %50", () => {
    for (const scenario of scenarios.filter((s) => s.outcome.pick === "YES" || s.outcome.pick === "NO")) assert.ok(scenario.probability >= 0.5);
  });

  it("N ve en sürpriz yüzde: ≥%1 sonuçlar sayılır, en sürpriz ≥%3'lerin en düşüğü", () => {
    const summary = scenarioSummary(scenarios, p);
    const counted = [...scenarios.flatMap((s) => Object.values(s.outcomeProbabilities)), ...p.exactScores.map((e) => e.probability)].filter((v) => v >= 0.01);
    assert.equal(summary.scenarioCount, counted.length);
    assert.equal(summary.surprisePct, Math.round(Math.min(...counted.filter((v) => v >= 0.03)) * 100));
    assert.ok(summary.surprisePct >= 3);
  });

  it("yetersiz veride kart yok (sessiz tahmin yok)", () => {
    const stats = { home: { form: form({ matchesSampled: 1 }), seasonLeagueXg: null }, away: { form: form(), seasonLeagueXg: null } } as unknown as DeepAnalysisStats;
    const result = predictInternal(stats);
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "INSUFFICIENT_DATA");
  });
});

describe("katalog dili", () => {
  const sides = { home: "Galatasaray", away: "Fenerbahçe" };
  it("başlıklar ve etiketler bahis dili içermez", () => {
    const p = matchProbabilities({ home: 1.4, away: 1.6 });
    for (const scenario of scenariosFrom(p)) {
      assert.deepEqual(findBannedWords(scenarioTitle(scenario.id, sides, scenario.outcome)), [], scenario.id);
      for (const line of openBoxLines(scenario, sides)) assert.deepEqual(findBannedWords(line.label), []);
    }
    assert.equal(scenarioTitle("COMBO", sides, { scenario: "COMBO", team: "AWAY", pick: "YES" }), "Senaryo: Fenerbahçe kazanır ve maçta 3+ gol olur");
    assert.equal(outcomeLabel("DRAW", sides), "Beraberlik");
  });

  it("açık kutu: 1X2 üç taraf, evet/hayır tek satır", () => {
    const [result, btts] = scenariosFrom(matchProbabilities({ home: 1.9, away: 0.9 }));
    assert.deepEqual(openBoxLines(result!, sides).map((line) => line.label), ["Galatasaray", "Beraberlik", "Fenerbahçe"]);
    assert.equal(openBoxLines(btts!, sides).length, 1);
  });
});

describe("gerekçeler — Çelik Kasa denetimi", () => {
  const home = computeTeamDeepStats(DEEP_ANALYSIS_FIXTURES, DEEP_ANALYSIS_TEAM);
  home.form = { ...home.form, teamName: "Galatasaray" };
  // Sayıları bilerek farklı deplasman — izolasyon ancak böyle sınanır.
  const away: TeamDeepStats = { ...home, form: { ...home.form, teamName: "Kasımpaşa", goalsForAvg: 0.6, goalsAgainstAvg: 2.4, last5: ["L", "L", "D", "L", "W"] }, cleanSheets: 0 };
  const stats = {
    fixture: { homeTeam: { name: "Galatasaray" }, awayTeam: { name: "Kasımpaşa" }, competition: { name: "Süper Lig" } },
    home,
    away,
    headToHead: { matches: [], homeWins: 0, draws: 0, awayWins: 0 },
  } as unknown as DeepAnalysisStats;
  const facts = vitrinFacts(stats);
  const sides = matchSides(stats);
  const homeWins = facts.ev_sahibi.galibiyet;
  /** Bu sezonun lig xG'si verilmiş paket (son 5 maçın xG'si bilerek farklı: gerekçeye girmemeli). */
  const seasonFacts = (homeSample: number, awaySample: number) => {
    const league = (matchesSampled: number, xgForAvg: number, xgAgainstAvg: number): SeasonLeagueXg => ({ leagueId: 203, leagueName: "Süper Lig", season: 2026, matchesSampled, xgForAvg, xgAgainstAvg });
    return vitrinFacts({ ...stats, home: { ...home, seasonLeagueXg: league(homeSample, 2.9, 0.8) }, away: { ...away, seasonLeagueXg: league(awaySample, 1.1, 1.7) } });
  };

  it("vitrin paketi bahis dili taşımaz; galibiyet sayısı eklenir", () => {
    assert.deepEqual(findBannedWords(JSON.stringify(facts).replace(/_/g, " ")), []);
    assert.equal(facts.deplasman.galibiyet, 1);
    assert.equal(facts.deplasman.maglubiyet, 3);
  });

  it("doğru takımın sayısı geçer", () => {
    assert.deepEqual(auditReason("Kasımpaşa son 5 maçta maç başı 2,4 gol yiyor.", PICK.RESULT_1X2, facts, sides), []);
    // Ev sahibinin zayıf formu deplasman galibiyetini destekler.
    assert.deepEqual(auditReason(`Galatasaray 5 maçta ${homeWins} galibiyet aldı.`, { scenario: "RESULT_1X2", pick: "AWAY" }, facts, sides), []);
  });

  it("rakibin sayısı takım karışması; uydurma sayı veride yok", () => {
    const mixed = auditReason("Galatasaray maç başı 2,4 gol yiyor.", PICK.RESULT_1X2, facts, sides);
    assert.ok(mixed.some((issue) => issue.includes("takımlar karışmış")), mixed.join());
    const invented = auditReason("Kasımpaşa son 5 maçta 17 şut attı.", PICK.BTTS, facts, sides);
    assert.ok(invented.some((issue) => issue.includes("veride yok")), invented.join());
  });

  it("160 karakter, 10 sözcük, bahis dili, kısaltma ve boş gerekçe yakalanır; üst üste serbest", () => {
    assert.ok(auditReason("Galatasaray son maçlarında çok etkili ve istikrarlı bir oyun ortaya koydu.", PICK.BTTS, facts, sides).some((issue) => issue.includes("11 sözcük")));
    assert.ok(auditReason("x".repeat(161), PICK.BTTS, facts, sides).some((issue) => issue.includes("161 karakter")));
    assert.ok(auditReason("Bu maçta KG var.", PICK.BTTS, facts, sides).some((issue) => issue.includes("bahis dili")));
    assert.ok(auditReason("Gala son maçlarda formda.", PICK.BTTS, facts, sides).some((issue) => issue.includes("kısaltma")));
    assert.deepEqual(auditReason("  ", PICK.BTTS, facts, sides), ["gerekçe boş"]);
    assert.deepEqual(auditReason(`Galatasaray üst üste ${homeWins} maç kazandı.`, PICK.RESULT_1X2, facts, sides), []);
  });

  it("ondalık ayırıcı virgül: 'rakam.rakam' reddedilir; kural tabanlı gerekçe virgül kullanır", () => {
    const result = predictInternal(stats);
    assert.ok(result.ok);
    const btts = result.data.scenarios.find((s) => s.id === "BTTS");
    assert.ok(btts);
    const reason = ruleReason({ ...btts, outcome: { scenario: "BTTS", pick: "YES" } }, facts, sides);
    assert.match(reason, /\d,\d/, reason);
    assert.doesNotMatch(reason, /\d\.\d/, reason);
    assert.deepEqual(auditReason(reason, PICK.BTTS, facts, sides), [], reason);
    const dotted = reason.replace(/(\d),(\d)/u, "$1.$2");
    assert.ok(auditReason(dotted, PICK.BTTS, facts, sides).some((issue) => issue.includes("ondalık ayırıcı virgül")), dotted);
  });

  it("senaryoyla ilgi: 'İlk yarı kimin?' için yalnızca xG ilgisiz, gol/galibiyet ilgili", () => {
    const xgOnly = `${sides.home} bu sezon ligde maç başına 2,9 xG üretiyor.`;
    assert.ok(auditReason(xgOnly, PICK.HT_RESULT, seasonFacts(6, 6), sides).some((issue) => issue.startsWith("senaryoyla ilgisiz")), xgOnly);
    assert.ok(!auditReason(xgOnly, PICK.GOALS_3PLUS, seasonFacts(6, 6), sides).some((issue) => issue.startsWith("senaryoyla ilgisiz")), "gollü maç için xG ilgili");
    assert.deepEqual(auditReason(`${sides.away} son 5 maçında ${facts.deplasman.galibiyet} galibiyet aldı.`, PICK.HT_RESULT, facts, sides), []);
    assert.ok(auditReason(`${sides.home} topla oynamada üstün.`, PICK.BTTS, facts, sides).some((issue) => issue.includes("gol atma ya da gol yeme")));
  });

  describe("xG kaynağı: bu sezonun lig maçları (XG_MIN_SAMPLE)", () => {
    it("son 5 maçın xG'si pakete hiç girmez; form (son 5) aynen kalır", () => {
      // Fikstürde son maçların xG'si var ama sezon lig verisi yok → xG anahtarı yok.
      assert.ok(stats.home.form.xgForAvg !== null);
      for (const key of ["xg_ort", "xg_izin_ort", "sut_basi_xg", "xg_kapsam"]) assert.ok(!(key in facts.ev_sahibi), key);
      assert.equal(facts.ev_sahibi.xg_ornek_mac, 0);
      assert.equal(facts.ev_sahibi.form_eskiden_yeniye, "GBM");
      assert.equal(facts.ev_sahibi.ornek_mac, stats.home.form.matchesSampled);
    });

    it(`< ${XG_MIN_SAMPLE} lig maçı: xG anahtarları çıkar; ≥ ${XG_MIN_SAMPLE}: sezon lig değerleri ve kapsam girer`, () => {
      const thin = seasonFacts(XG_MIN_SAMPLE - 1, XG_MIN_SAMPLE);
      for (const key of ["xg_ort", "xg_izin_ort", "xg_kapsam"]) {
        assert.ok(!(key in thin.ev_sahibi), `ev sahibinde ${key} olmamalı`);
        assert.ok(key in thin.deplasman, `deplasmanda ${key} olmalı`);
      }
      assert.ok(!JSON.stringify(thin.ev_sahibi).includes("2.9"), "2,9 xG pakette görünmemeli");
      assert.equal(thin.ev_sahibi.xg_ornek_mac, XG_MIN_SAMPLE - 1);
      assert.equal(thin.deplasman.xg_ort, 1.1);
      assert.equal(thin.deplasman.xg_izin_ort, 1.7);
      assert.equal(thin.deplasman.xg_kapsam, XG_SCOPE_PHRASE);
      assert.ok(!("sut_basi_xg" in thin.deplasman), "şut başı xG son 5 maçtan — pakette yok");
    });

    it("az örneklemli takımın xG gerekçesi reddedilir (sayılı ya da sayısız)", () => {
      const thin = seasonFacts(2, 6);
      for (const reason of ["Galatasaray bu sezon ligde maç başına 2,9 xG üretiyor.", "Galatasaray bu sezon ligde yüksek gol beklentisi yaratıyor."]) {
        const issues = auditReason(reason, PICK.GOALS_3PLUS, thin, sides);
        assert.ok(issues.some((issue) => issue.includes("xG'si bu sezon ligde 2 maçtan")), `${reason} → ${issues.join(" | ")}`);
      }
    });

    it(`yeterli örneklem + "${XG_SCOPE_PHRASE}" geçer; ifade yoksa ya da son maçlar denirse ret`, () => {
      const ok = seasonFacts(8, 7);
      assert.deepEqual(auditReason("Galatasaray bu sezon ligde maç başına 2,9 xG üretiyor.", PICK.GOALS_3PLUS, ok, sides), []);
      assert.deepEqual(auditReason("Galatasaray bu sezon ligde 8 maçta 2,9 xG ortalaması tutturdu.", PICK.GOALS_3PLUS, ok, sides), []);
      for (const reason of ["Galatasaray maç başına 2,9 xG üretiyor.", "Galatasaray son 5 maçta 2,9 xG üretiyor."]) {
        assert.ok(auditReason(reason, PICK.GOALS_3PLUS, ok, sides).some((issue) => issue.includes(`"${XG_SCOPE_PHRASE}" diye yazılmalı`)), reason);
      }
    });

    it("takım adı yoksa iki takımın da örneklemi sınanır", () => {
      const mixed = seasonFacts(6, 3);
      assert.ok(auditReason("Kasımpaşa bu sezon ligde maç başına 1,1 xG üretiyor.", PICK.GOALS_3PLUS, mixed, sides).some((issue) => issue.includes("Kasımpaşa xG'si bu sezon ligde 3 maçtan")));
      assert.ok(auditReason("İki takım da bu sezon ligde yüksek xG üretiyor.", PICK.GOALS_3PLUS, mixed, sides).some((issue) => issue.includes("Kasımpaşa xG'si bu sezon ligde 3 maçtan")));
    });
  });

  it("senaryonun kendi sayısı (3+ gol) serbest", () => {
    assert.deepEqual(auditReason("Galatasaray maçlarında 3+ gol sık görülüyor.", PICK.GOALS_3PLUS, facts, sides), []);
  });

  it("kural tabanlı gerekçeler denetimden geçer: ≤160 karakter, ≤10 sözcük", () => {
    const result = predictInternal(stats);
    assert.ok(result.ok);
    for (const scenario of result.data.scenarios) {
      const reason = ruleReason(scenario, facts, sides);
      assert.ok(reason.length > 0 && reason.length <= 160, `${scenario.id}: ${reason}`);
      assert.deepEqual(auditReason(reason, scenario.outcome, facts, sides), [], `${scenario.id}: ${reason}`);
    }
  });
});

describe("vitrin kartı, gönderi metni ve tahmin kaydı", async () => {
  const { buildVitrinCard, hookLine, hookLines, validSelection, vitrinTextGate, wholePercents, winBar } = await import("@/lib/dashboard/vitrin-card");
  const { buildVitrinCaption, hashtagCount, hasLink, MAX_HASHTAGS, VITRIN_QUESTION } = await import("@/lib/dashboard/vitrin-caption");
  const { parseVitrinOptions, predictionRecordsFor } = await import("@/lib/prediction/record");
  const { LOCKED_ANSWER } = await import("@/skills/render-engine/templates/vitrin/ticket");

  const p = matchProbabilities({ home: 1.75, away: 0.95 });
  const scenarios = scenariosFrom(p).map((s) => ({ ...s, reason: `Gerekçe ${s.id}` }));
  const prediction = { sourceId: "internal", sourceVersion: "poisson-v1", computedAtUtc: "2026-10-20T10:00:00.000Z", scenarios, ...scenarioSummary(scenarios, p) };
  const selection = { open: ["RESULT_1X2", "BTTS"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"] } as const;
  const meta = { sides: { home: "Galatasaray", away: "Kasımpaşa" }, homeTeamId: 645, awayTeamId: 3563, kickoffUtc: "2026-10-24T17:00:00Z", competitionName: "Trendyol Süper Lig", roundLabel: "9. Hafta", homeForm: ["W", "D", "W", "L", "W"] as ("W" | "D" | "L")[], awayForm: ["L", "L", "D"] as ("W" | "D" | "L")[] };
  const card = buildVitrinCard(prediction, { open: [...selection.open], locked: [...selection.locked] } as never, meta, { homeLogo: null, awayLogo: null, brandLogo: "" });

  it("kilitli kutulara yalnızca başlık geçer — sonuç ya da yüzde yok", () => {
    assert.deepEqual(card.locked, ["İlk yarı kimin?", "Gol yağmuru var mı?", "Senaryo: Galatasaray kazanır ve maçta 3+ gol olur"]);
    for (const title of card.locked) assert.doesNotMatch(title, /%\d/);
    assert.doesNotMatch(LOCKED_ANSWER, /d/, "kilitli cevap yerine sabit nokta — rakam yok");
    assert.equal(card.hiddenCount, prediction.scenarioCount - 2);
  });

  it("açık kutular: 1X2 üç yüzde, iki takım gol tek satır; gerekçe kaynaktan", () => {
    assert.equal(card.open[0].lines.length, 3);
    assert.equal(card.open[1].lines.length, 1);
    assert.equal(card.open[0].reason, "Gerekçe RESULT_1X2");
  });

  it("kanca: N ve en sürpriz yüzde kaynaktan; link yok", () => {
    assert.deepEqual(card.hook, hookLines(prediction));
    assert.match(card.hook[0], new RegExp(`${prediction.scenarioCount} senaryo`));
    assert.match(card.hook[1], new RegExp(`%${prediction.surprisePct} ihtimalle`));
    assert.equal(hasLink(card.hook.join(" ")), false);
    assert.equal(card.hookLine, hookLine(prediction));
    assert.equal(hasLink(card.hookLine), false);
  });

  it("poster çubuğu: yüzdeler toplam 100, manşet kurala dayalı (fark < 8 puan → kararsız)", () => {
    assert.deepEqual(wholePercents([0.4312, 0.2201, 0.3487]), [43, 22, 35]);
    assert.equal(wholePercents([1 / 3, 1 / 3, 1 / 3]).reduce((a, b) => a + b, 0), 100);
    const bar = card.winBar;
    assert.equal(bar.home + bar.draw + bar.away, 100);
    assert.equal(bar.favourite, "HOME");
    assert.equal(bar.headline, "Modelimiz Galatasaray diyor");
    const close = scenarios.map((s) => (s.id === "RESULT_1X2" ? { ...s, outcomeProbabilities: { HOME: 0.38, DRAW: 0.31, AWAY: 0.31 } } : s));
    assert.deepEqual(winBar({ ...prediction, scenarios: close }, meta.sides), { home: 38, draw: 31, away: 31, favourite: null, headline: "Model kararsız: dengeli bir maç" });
    const drawLeads = scenarios.map((s) => (s.id === "RESULT_1X2" ? { ...s, outcomeProbabilities: { HOME: 0.25, DRAW: 0.5, AWAY: 0.25 } } : s));
    assert.equal(winBar({ ...prediction, scenarios: drawLeads }, meta.sides).favourite, null);
  });

  it("form: eskiden yeniye, kaynaktan aynen", () => {
    assert.deepEqual(card.homeForm, ["W", "D", "W", "L", "W"]);
    assert.deepEqual(card.awayForm, ["L", "L", "D"]);
  });

  it("kart dil kapısı: temiz kart geçer, bahis sözcüğü kartı durdurur", () => {
    assert.equal(vitrinTextGate(card), null);
    const dirty = { ...card, open: [{ ...card.open[0], reason: "Bu maçta KG var." }, card.open[1]] as typeof card.open };
    assert.match(vitrinTextGate(dirty) ?? "", /KG/);
  });

  it("seçim: tekrar eden senaryo geçersiz", () => {
    assert.equal(validSelection({ open: ["RESULT_1X2", "BTTS"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"] }), true);
    assert.equal(validSelection({ open: ["RESULT_1X2", "BTTS"], locked: ["BTTS", "GOALS_4PLUS", "COMBO"] }), false);
    assert.equal(validSelection({ open: ["BTTS", "RESULT_1X2"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"] }), false, "1. kutu kazanma olasılıkları");
  });

  it("gönderi metni: analiz dili, ≤5 hashtag, link yok, etkileşim sorusuyla", () => {
    const caption = buildVitrinCaption(card);
    assert.deepEqual(findBannedWords(caption), []);
    assert.ok(hashtagCount(caption) <= MAX_HASHTAGS, caption);
    assert.equal(hasLink(caption), false);
    assert.ok(caption.includes(VITRIN_QUESTION));
    assert.match(caption, /^Galatasaray – Kasımpaşa \| Maç önü analiz/);
  });

  it("tahmin kaydı: yalnızca açık 2 senaryo, makine okunur sonuç, 4 ondalık olasılık", () => {
    const records = predictionRecordsFor("ai-1", "api-football-9", { open: ["RESULT_1X2", "BTTS"], prediction });
    assert.deepEqual(records.map((r) => r.scenarioId), ["RESULT_1X2", "BTTS"]);
    assert.deepEqual(records[0]!.outcome, { scenario: "RESULT_1X2", pick: "HOME" });
    assert.match(records[0]!.probability, /^0\.\d{4}$/);
    assert.equal(records[0]!.sourceVersion, "poisson-v1");
    assert.equal(records[0]!.modelVersion, null, "v1 ile hesaplanan tahmin: modelVersion null (= v1)");
    assert.equal(records[0]!.computedAt.toISOString(), "2026-10-20T10:00:00.000Z");
  });

  it("renderOptions doğrulaması: vitrin kaydı okunur, eksik alan reddedilir", () => {
    const options = { kind: "VITRIN", format: "IG_PORTRAIT", prediction, open: ["RESULT_1X2", "BTTS"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"], photoId: null };
    assert.ok(parseVitrinOptions(options));
    assert.equal(parseVitrinOptions({ ...options, kind: "MARKET_ANALYSIS" }), null);
    assert.equal(parseVitrinOptions({ ...options, open: ["RESULT_1X2"] }), null);
  });
});
