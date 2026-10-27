import { allowedNumbersBySide, buildAnalysisFacts, findTeamAbbreviations, findUngroundedNumbers, union } from "@/lib/dashboard/expert-analysis-facts";
import { cardTeamName } from "@/lib/archive/names";
import type { DeepAnalysisStats } from "@/types/deep-analysis";
import { REASON_MAX_LENGTH, REASON_MAX_WORDS, wordCount, type Scenario, type ScenarioId } from "@/types/prediction";
import { findBannedWords } from "./banned-words";
import type { MatchSides } from "./catalog";

/**
 * Vitrin gerekçeleri — Çelik Kasa denetimi (bkz. CLAUDE.md 1.10 AI Analist) + kural tabanlı yedek.
 * Her sayı olgu paketinden gelir; takım izolasyonu CÜMLECİK düzeyinde: bir takımın adı geçen
 * cümleciğin sayıları yalnızca o takımın paketiyle (+ maç künyesi / aralarındaki maçlar) denetlenir.
 * Denetimden geçemeyen gerekçe kartı kilitler (üretilmez); admin düzeltir, denetim AI'sız tekrar çalışır.
 */

/** Kartta ve gerekçede kullanılan takım adları (mevcut Türkçe kart adı eşlemesi). */
export function matchSides(stats: DeepAnalysisStats): MatchSides {
  return { home: cardTeamName(stats.fixture.homeTeam.name), away: cardTeamName(stats.fixture.awayTeam.name) };
}

/** xG ortalaması en az bu kadar xG'li maçtan gelmeli; azsa paketten çıkar ve xG'li gerekçe reddedilir. */
export const XG_MIN_SAMPLE = 4;
/** Gerekçede xG'ye dayanma: "xG", "beklenen gol", "gol beklentisi". */
const XG_MENTION = /xg|beklenen gol|gol beklentisi/u;

const tally = (letters: string, letter: string) => [...letters].filter((value) => value === letter).length;

/**
 * Vitrin olgu paketi: mevcut paket, takım adları kart adıyla ve bahis dili taşıyan anahtarlar analiz
 * diliyle ("kg_var_mac" → "iki_takimin_da_gol_buldugu_mac"); sayılar aynı. Galibiyet/beraberlik/
 * mağlubiyet sayıları formdan eklenir (gerekçelerin "son 5 maçta 4 galibiyet" diyebilmesi için).
 */
export function vitrinFacts(stats: DeepAnalysisStats) {
  const base = buildAnalysisFacts(stats);
  const sides = matchSides(stats);
  const team = (facts: typeof base.ev_sahibi, name: string, xgSampled: number) => {
    const { kg_var_mac, ust_2_5_mac, xg_ort, xg_izin_ort, sut_basi_xg, ...rest } = facts;
    return {
      ...rest,
      // xG < XG_MIN_SAMPLE maçtan geliyorsa pakette hiç yok — model göremez, gerekçede yazamaz.
      ...(xgSampled >= XG_MIN_SAMPLE ? { xg_ort, xg_izin_ort, sut_basi_xg } : {}),
      takim: name,
      galibiyet: tally(facts.form_eskiden_yeniye, "G"),
      beraberlik: tally(facts.form_eskiden_yeniye, "B"),
      maglubiyet: tally(facts.form_eskiden_yeniye, "M"),
      iki_takimin_da_gol_buldugu_mac: kg_var_mac,
      uc_veya_daha_fazla_gollu_mac: ust_2_5_mac,
      // xG ortalaması yalnızca xG verisi olan maçlardan (hazırlık/kupa maçlarında yok) — örneklem bağlamı.
      xg_ornek_mac: xgSampled,
    };
  };
  return {
    mac: { ...base.mac, ev_sahibi: sides.home, deplasman: sides.away },
    ev_sahibi: team(base.ev_sahibi, sides.home, stats.home.form.xgMatchesSampled),
    deplasman: team(base.deplasman, sides.away, stats.away.form.xgMatchesSampled),
    aralarindaki_son_maclar: base.aralarindaki_son_maclar,
  };
}

export type VitrinFacts = ReturnType<typeof vitrinFacts>;

/** Senaryonun kendi sayıları ("3+ gol", "4+ gol") gerekçede serbesttir. */
const SCENARIO_NUMBERS: Partial<Record<ScenarioId, string[]>> = { GOALS_3PLUS: ["3"], GOALS_4PLUS: ["4"], COMBO: ["3"] };

/**
 * Senaryoyla ilgi: gerekçe senaryonun konusuna ait bir veriye dayanmalı (konu sözcüğü geçmeli).
 * Olgu paketinde ilk yarı verisi YOK — "İlk yarı kimin?" gol atma/yeme, galibiyet ya da form verisiyle
 * gerekçelendirilir; yalnızca xG, topla oynama ya da pas isabeti bu senaryoyla ilgisiz sayılır.
 */
export const SCENARIO_TOPICS: Record<ScenarioId, { pattern: RegExp; label: string }> = {
  RESULT_1X2: { pattern: /galibiyet|beraberlik|mağlubiyet|yenil|kazan|kaybet|puan|form|gol|xg|seri/u, label: "galibiyet, form ya da gol" },
  BTTS: { pattern: /gol/u, label: "gol atma ya da gol yeme" },
  GOALS_3PLUS: { pattern: /gol|xg/u, label: "gol sayısı ya da gol beklentisi" },
  GOALS_4PLUS: { pattern: /gol|xg/u, label: "gol sayısı ya da gol beklentisi" },
  HT_RESULT: { pattern: /ilk yarı|gol|galibiyet|öne geç|form/u, label: "gol atma/yeme, galibiyet ya da form" },
  COMBO: { pattern: /galibiyet|kazan|form|gol/u, label: "galibiyet ya da gol" },
};

/** Cümlecik sınırı: noktalı virgül/iki nokta, ardından boşluk gelen virgül/nokta (ondalık "2,4" bölünmez), bağlaçlar. */
const CLAUSE_SPLIT = /[;:]|[,.](?=\s|$)|\s(?:ve|ama|fakat|ancak|oysa|iken|buna karşın)\s/u;
const lower = (text: string) => text.toLocaleLowerCase("tr-TR");
/** Rakam.rakam — Türkçe metinde ondalık nokta (binlik ayırıcı da noktadır ama gerekçelerde binlik sayı yok). */
const DECIMAL_POINT = /\d+\.\d+/gu;

/** Cümleciğin takımı: yalnızca birinin adı geçiyorsa o; ikisi ya da hiçbiri → null (birleşik kapsam). */
function clauseSide(clause: string, sides: MatchSides): "home" | "away" | null {
  const has = (name: string) => lower(clause).includes(lower(name));
  const home = has(sides.home);
  const away = has(sides.away);
  return home === away ? null : home ? "home" : "away";
}

/** Gerekçe denetimi: boş değil, ≤160 karakter, ≤10 sözcük, ondalık virgül, senaryoyla ilgili, xG örneklemi ≥4 maç, bahis dili yok, kısaltma yok, her sayı doğru takımın paketinden. */
export function auditReason(reason: string, scenarioId: ScenarioId, facts: VitrinFacts, sides: MatchSides): string[] {
  const text = reason.trim();
  if (!text) return ["gerekçe boş"];
  const issues: string[] = [];
  if (text.length > REASON_MAX_LENGTH) issues.push(`${text.length} karakter (en fazla ${REASON_MAX_LENGTH})`);
  const words = wordCount(text);
  if (words > REASON_MAX_WORDS) issues.push(`${words} sözcük (en fazla ${REASON_MAX_WORDS})`);
  // Türkçe ondalık ayırıcı virgül: "2.2" reddedilir ("2,2").
  for (const match of text.matchAll(DECIMAL_POINT)) issues.push(`"${match[0]}" ondalık ayırıcı virgül olmalı ("${match[0].replace(".", ",")}")`);
  const topic = SCENARIO_TOPICS[scenarioId];
  if (!topic.pattern.test(lower(text))) issues.push(`senaryoyla ilgisiz — ${topic.label} verisine dayanmalı`);
  const banned = findBannedWords(text);
  if (banned.length) issues.push(`bahis dili: ${banned.join(", ")}`);
  const short = findTeamAbbreviations(text, [sides.home, sides.away]);
  if (short.length) issues.push(`takım kısaltması: ${short.join(", ")}`);

  // xG örneklemi: cümleciğin takımının (takım adı yoksa iki takımın da) xG'si ≥ XG_MIN_SAMPLE maçtan gelmeli.
  for (const clause of text.split(CLAUSE_SPLIT)) {
    if (!XG_MENTION.test(lower(clause))) continue;
    const side = clauseSide(clause, sides);
    const teams = side === "home" ? [facts.ev_sahibi] : side === "away" ? [facts.deplasman] : [facts.ev_sahibi, facts.deplasman];
    for (const team of teams) {
      if (team.xg_ornek_mac < XG_MIN_SAMPLE) issues.push(`${team.takim} xG'si ${team.xg_ornek_mac} maçtan (en az ${XG_MIN_SAMPLE}) — xG gerekçesi yazılamaz`);
    }
  }

  const scopes = allowedNumbersBySide(facts);
  const free = new Set(SCENARIO_NUMBERS[scenarioId] ?? []);
  for (const clause of text.split(CLAUSE_SPLIT)) {
    const side = clauseSide(clause, sides);
    const allowed = side === "home" ? union(scopes.home, scopes.shared, free) : side === "away" ? union(scopes.away, scopes.shared, free) : union(scopes.home, scopes.away, scopes.shared, free);
    const opponent = side === "home" ? scopes.away : side === "away" ? scopes.home : new Set<string>();
    for (const number of findUngroundedNumbers(clause, allowed, opponent)) {
      issues.push(number.foundIn === "opponent" ? `"${number.value}" rakibin verisi — takımlar karışmış` : `"${number.value}" veride yok`);
    }
  }
  return issues;
}

/** Bütün senaryoların denetimi: senaryo → sorunlar (boş dizi = temiz). */
export function auditReasons(scenarios: Scenario[], facts: VitrinFacts, sides: MatchSides): Record<string, string[]> {
  return Object.fromEntries(scenarios.map((scenario) => [scenario.id, auditReason(scenario.reason, scenario.id, facts, sides)]));
}

const decimal = (value: number | null) => (value === null ? null : String(value).replace(".", ","));

/** Parçaları sığdığı kadar birleştirir (≤160 karakter, ≤10 sözcük); ilk parça her zaman alınır. */
function compose(parts: (string | null)[]): string {
  let out = "";
  for (const part of parts) {
    if (!part) continue;
    // Parçalar takım adıyla başlar — özel ad küçültülmez.
    const next = out ? `${out}; ${part}` : part;
    if (next.length + 1 > REASON_MAX_LENGTH || wordCount(next) > REASON_MAX_WORDS) break;
    out = next;
  }
  return out ? `${out}.` : "";
}

/**
 * Kural tabanlı gerekçeler (AI yoksa ya da admin isterse) — sayılar olgu paketinden, denetimden geçer.
 */
export function ruleReason(scenario: Scenario, facts: VitrinFacts, sides: MatchSides): string {
  const home = facts.ev_sahibi;
  const away = facts.deplasman;
  const form = (team: typeof home, name: string) => `${name} son ${team.ornek_mac} maçında ${team.galibiyet} galibiyet aldı`;
  const scoring = (team: typeof home, name: string) => (team.gol_atilan_ort === null ? null : `${name} maç başı ${decimal(team.gol_atilan_ort)} gol atıyor`);
  const conceding = (team: typeof home, name: string) => (team.gol_yenilen_ort === null ? null : `${name} maç başı ${decimal(team.gol_yenilen_ort)} gol yiyor`);
  const favouriteIsHome = scenario.outcome.scenario === "COMBO" ? scenario.outcome.team === "HOME" : scenario.outcome.pick !== "AWAY";
  const [fav, favName, other, otherName] = favouriteIsHome ? [home, sides.home, away, sides.away] : [away, sides.away, home, sides.home];

  switch (scenario.id) {
    case "RESULT_1X2":
      return scenario.outcome.pick === "DRAW"
        ? compose([form(home, sides.home), form(away, sides.away)])
        : compose([form(fav, favName), conceding(other, otherName)]);
    case "BTTS":
      if (scenario.outcome.pick === "YES") return compose([scoring(home, sides.home), scoring(away, sides.away)]);
      return compose([
        home.gol_yemedigi_mac >= away.gol_yemedigi_mac
          ? `${sides.home} son ${home.ornek_mac} maçta ${home.gol_yemedigi_mac} kez gol yemedi`
          : `${sides.away} son ${away.ornek_mac} maçta ${away.gol_yemedigi_mac} kez gol yemedi`,
        scoring(home, sides.home),
      ]);
    case "GOALS_3PLUS":
      if (scenario.outcome.pick === "YES") {
        const goalsSeen = (team: typeof home, name: string) => `${name} son ${team.ornek_mac} maçının ${team.uc_veya_daha_fazla_gollu_mac} tanesinde 3+ gol gördü`;
        return compose([goalsSeen(home, sides.home), goalsSeen(away, sides.away)]);
      }
      return compose([conceding(home, sides.home), conceding(away, sides.away)]);
    case "GOALS_4PLUS":
      // "Gol yağmuru": evet → iki hücum; hayır → iki savunmanın yediği.
      return scenario.outcome.pick === "YES" ? compose([scoring(home, sides.home), scoring(away, sides.away)]) : compose([conceding(home, sides.home), conceding(away, sides.away)]);
    case "HT_RESULT":
      return compose([scoring(fav, favName), conceding(other, otherName)]);
    case "COMBO":
      // Evet → favorinin formu ve hücumu; hayır → rakibin direnci (yediği gol azsa) ve favorinin hücumu.
      return scenario.outcome.pick === "YES" ? compose([form(fav, favName), scoring(fav, favName)]) : compose([conceding(other, otherName), scoring(fav, favName)]);
  }
}
