import { allowedNumbersBySide, buildAnalysisFacts, findTeamAbbreviations, findUngroundedNumbers, union } from "@/lib/dashboard/expert-analysis-facts";
import { cardTeamName } from "@/lib/archive/names";
import type { DeepAnalysisStats, SeasonLeagueXg } from "@/types/deep-analysis";
import { REASON_MAX_LENGTH, REASON_MAX_WORDS, wordCount, type Scenario, type ScenarioId, type ScenarioOutcome } from "@/types/prediction";
import { findBannedWords } from "./banned-words";
import type { MatchSides } from "./catalog";
import { CLAUSE_SPLIT, clauseSide, directionIssues, unsampledClauses } from "./reason-claims";
import { differentLeagues, SEASON_XG_MIN_MATCHES } from "./season-xg";

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

/**
 * Gerekçenin xG kaynağı: bu sezonun yurt içi LİG maçları (`TeamDeepStats.seasonLeagueXg`), en az bu
 * kadar xG'li maç. Azsa (ya da lig bulunamazsa) xG paketten çıkar ve xG'li gerekçe reddedilir.
 * Son 5 maç (tüm kulvarlar) xG'si gerekçeye girmez — tek maçlık sapmalar ortalamayı şişiriyordu.
 * Eşik modelle ortak (`season-xg.ts`).
 */
export const XG_MIN_SAMPLE = SEASON_XG_MIN_MATCHES;
/** xG gerekçesinde örneklem bu ifadeyle yazılır. */
export const XG_SCOPE_PHRASE = "bu sezon ligde";
/** Gerekçede xG'ye dayanma: "xG", "beklenen gol", "gol beklentisi". */
const XG_MENTION = /xg|beklenen gol|gol beklentisi/u;
/** Takım adı geçmeden kıyas: "iki takım", "rakibinden", "daha fazla/yüksek/düşük/az", "üstün"... */
const XG_COMPARISON = /iki takım|rakib|daha (?:fazla|yüksek|düşük|az)|üstün|geride|önde|kıyas/u;

const tally = (letters: string, letter: string) => [...letters].filter((value) => value === letter).length;
/** Son 5 maçtan (tüm kulvarlar) gelen xG anahtarları — gerekçe paketine girmez. */
type RecentXgKey = "xg_ort" | "xg_izin_ort" | "sut_basi_xg";
const RECENT_XG_KEYS = new Set<string>(["xg_ort", "xg_izin_ort", "sut_basi_xg"] satisfies RecentXgKey[]);
const round2 = (value: number | null) => (value === null ? null : Math.round(value * 100) / 100);

/**
 * Vitrin olgu paketi: mevcut paket, takım adları kart adıyla ve bahis dili taşıyan anahtarlar analiz
 * diliyle ("kg_var_mac" → "iki_takimin_da_gol_buldugu_mac"); sayılar aynı. Galibiyet/beraberlik/
 * mağlubiyet sayıları formdan eklenir (gerekçelerin "son 5 maçta 4 galibiyet" diyebilmesi için).
 * Form (son 5 maç) aynen kalır; xG yalnızca bu sezonun lig maçlarından gelir.
 */
export function vitrinFacts(stats: DeepAnalysisStats) {
  const base = buildAnalysisFacts(stats);
  const sides = matchSides(stats);
  const team = (facts: typeof base.ev_sahibi, name: string, seasonXg: SeasonLeagueXg | null) => {
    const { kg_var_mac, ust_2_5_mac, ...rest } = facts;
    // Son 5 maçın xG'si gerekçe paketine girmez.
    const recent = Object.fromEntries(Object.entries(rest).filter(([key]) => !RECENT_XG_KEYS.has(key))) as Omit<typeof rest, RecentXgKey>;
    const sampled = seasonXg?.matchesSampled ?? 0;
    return {
      ...recent,
      takim: name,
      galibiyet: tally(facts.form_eskiden_yeniye, "G"),
      beraberlik: tally(facts.form_eskiden_yeniye, "B"),
      maglubiyet: tally(facts.form_eskiden_yeniye, "M"),
      iki_takimin_da_gol_buldugu_mac: kg_var_mac,
      uc_veya_daha_fazla_gollu_mac: ust_2_5_mac,
      // xG'li lig maçı sayısı (bu sezon) — < XG_MIN_SAMPLE ise xG anahtarları pakette hiç yok.
      xg_ornek_mac: sampled,
      ...(seasonXg && sampled >= XG_MIN_SAMPLE
        ? { xg_kapsam: XG_SCOPE_PHRASE, xg_ort: round2(seasonXg.xgForAvg), xg_izin_ort: round2(seasonXg.xgAgainstAvg) }
        : {}),
    };
  };
  return {
    // Farklı yurt içi ligler (Avrupa kupaları vb.): iki takımın xG'si kıyaslanamaz (denetlenir).
    mac: { ...base.mac, ev_sahibi: sides.home, deplasman: sides.away, farkli_ligler: differentLeagues(stats) },
    ev_sahibi: team(base.ev_sahibi, sides.home, stats.home.seasonLeagueXg),
    deplasman: team(base.deplasman, sides.away, stats.away.seasonLeagueXg),
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

const lower = (text: string) => text.toLocaleLowerCase("tr-TR");
/** Rakam.rakam — Türkçe metinde ondalık nokta (binlik ayırıcı da noktadır ama gerekçelerde binlik sayı yok). */
const DECIMAL_POINT = /\d+\.\d+/gu;

/**
 * Gerekçe denetimi: boş değil, ≤160 karakter, ≤10 sözcük, ondalık virgül, senaryoyla ilgili, seçili sonucu
 * DESTEKLER (yön, `reason-claims.ts`), her sayının örneklemi yazılı ("son 5 maçta", "bu sezon ligde"), xG
 * yalnızca bu sezon ≥5 lig maçından ve "bu sezon ligde" diye, bahis dili yok, kısaltma yok, her sayı doğru
 * takımın paketinden.
 */
export function auditReason(reason: string, outcome: ScenarioOutcome, facts: VitrinFacts, sides: MatchSides): string[] {
  const scenarioId: ScenarioId = outcome.scenario;
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
  // Örneklem: her sayının örneklemi cümlecikte (ya da aynı öznenin önceki cümleciğinde) yazılır.
  for (const clause of unsampledClauses(text, sides)) issues.push(`örneklem yok: "${clause}" — "son 5 maçta" ya da "bu sezon ligde" gibi yazılmalı`);
  // Yön: gerekçe seçili sonucu desteklemeli; çelişen iddia reddedilir.
  const sample = (side: "home" | "away" | null) => (side === "away" ? facts.deplasman.ornek_mac : facts.ev_sahibi.ornek_mac);
  issues.push(...directionIssues(text, outcome, sides, sample));

  // xG örneklemi: cümleciğin takımının (takım adı yoksa iki takımın da) xG'si bu sezon ≥ XG_MIN_SAMPLE lig maçından gelmeli.
  for (const clause of text.split(CLAUSE_SPLIT)) {
    if (!XG_MENTION.test(lower(clause))) continue;
    const side = clauseSide(clause, sides);
    const teams = side === "home" ? [facts.ev_sahibi] : side === "away" ? [facts.deplasman] : [facts.ev_sahibi, facts.deplasman];
    for (const team of teams) {
      if (team.xg_ornek_mac < XG_MIN_SAMPLE) issues.push(`${team.takim} xG'si bu sezon ligde ${team.xg_ornek_mac} maçtan (en az ${XG_MIN_SAMPLE}) — xG gerekçesi yazılamaz`);
    }
  }
  // Örneklem cümlede açıkça yazılır ("bu sezon ligde"); cümlecik ayrılsa da cümle düzeyinde aranır.
  if (XG_MENTION.test(lower(text)) && !lower(text).includes(XG_SCOPE_PHRASE)) issues.push(`xG örneklemi "${XG_SCOPE_PHRASE}" diye yazılmalı`);
  // Farklı liglerde iki takımın xG'si aynı cümlede kıyaslanamaz: iki ad birlikte ya da kıyas sözcüğüyle.
  if (facts.mac.farkli_ligler && XG_MENTION.test(lower(text))) {
    const bothNames = lower(text).includes(lower(sides.home)) && lower(text).includes(lower(sides.away));
    if (bothNames || XG_COMPARISON.test(lower(text))) issues.push("farklı ligler: iki takımın xG'si kıyaslanamaz");
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
  return Object.fromEntries(scenarios.map((scenario) => [scenario.id, auditReason(scenario.reason, scenario.outcome, facts, sides)]));
}

/**
 * AI gerekçeleri denetimden geçmezse kural tabanlı gerekçeye düşülür (o da geçiyorsa) — kart yön ya da
 * örneklem hatasıyla kilitlenmez; değiştirilen her gerekçe sebebiyle `replaced`'da (stüdyoda uyarı olur).
 */
export function auditedReasons(scenarios: Scenario[], written: Partial<Record<ScenarioId, string>>, facts: VitrinFacts, sides: MatchSides) {
  const reasons: Partial<Record<ScenarioId, string>> = {};
  const replaced: { id: ScenarioId; outcome: ScenarioOutcome; issues: string[] }[] = [];
  for (const scenario of scenarios) {
    const ai = written[scenario.id]?.trim();
    if (!ai) continue;
    const issues = auditReason(ai, scenario.outcome, facts, sides);
    const fallbackClean = scenario.reason.trim() !== "" && auditReason(scenario.reason, scenario.outcome, facts, sides).length === 0;
    if (issues.length && fallbackClean) replaced.push({ id: scenario.id, outcome: scenario.outcome, issues });
    else reasons[scenario.id] = ai;
  }
  return { reasons, replaced };
}

export { ruleReason, ruleReasons } from "./rule-reasons";
