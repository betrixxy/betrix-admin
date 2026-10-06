import type { DeepAnalysisStats, TeamDeepStats } from "@/types/deep-analysis";

/**
 * LLM analistine verilen "olgu paketi" ve çıktının sayı denetimi — saf fonksiyonlar.
 *
 * CLAUDE.md 1.10'un ilkesi LLM'le de geçerlidir: görselde/metinde geçen her sayı gerçek veriden
 * gelir. Model yalnızca bu paketi görür; çıktıdaki her sayı paketteki sayılarla karşılaştırılır,
 * pakette olmayan sayı "dayanaksız" olarak işaretlenir (admin yayından önce görür).
 */

const round = (value: number | null, digits = 1) => (value === null ? null : Number(value.toFixed(digits)));

function teamFacts(team: TeamDeepStats) {
  const { form } = team;
  const sm = team.sportmonks;
  return {
    takim: form.teamName,
    ornek_mac: form.matchesSampled,
    form_eskiden_yeniye: form.last5.map((r) => ({ W: "G", D: "B", L: "M" })[r]).join(""),
    gol_atilan_ort: round(form.goalsForAvg),
    gol_yenilen_ort: round(form.goalsAgainstAvg),
    xg_ort: round(form.xgForAvg, 2),
    xg_izin_ort: round(form.xgAgainstAvg, 2),
    topla_oynama_yuzde: round(team.possessionAvg, 0),
    pas_isabeti_yuzde: round(team.passAccuracyAvg, 0),
    sut_ort: round(team.shotsAvg),
    sut_izin_ort: round(team.shotsConcededAvg),
    isabetli_sut_ort: round(team.shotsOnTargetAvg),
    ceza_sahasi_ici_sut_yuzde: round(team.shotsInsideBoxPct, 0),
    sut_isabet_yuzde: round(team.shotAccuracyPct, 0),
    gole_donusum_yuzde: round(team.conversionPct, 0),
    sut_basi_xg: round(team.xgPerShot, 2),
    kilit_pas_ort: round(team.keyPassesAvg),
    calim_basari_yuzde: round(team.dribbleSuccessPct, 0),
    ikili_mucadele_yuzde: round(team.duelsWonPct, 0),
    top_kazanma_ort: round(team.ballWinsAvg),
    ppda_tum_saha: round(team.ppdaFullPitch),
    kg_var_mac: team.bttsCount,
    ust_2_5_mac: team.over25Count,
    gol_yemedigi_mac: team.cleanSheets,
    gol_atamadigi_mac: team.failedToScore,
    dizilis: team.formation,
    sportmonks: sm
      ? {
          ornek_mac: sm.matchesSampled,
          buyuk_sans_ort: round(sm.bigChancesCreatedAvg),
          kacirilan_buyuk_sans_ort: round(sm.bigChancesMissedAvg),
          izin_verilen_buyuk_sans_ort: round(sm.bigChancesConcededAvg),
          tehlikeli_atak_ort: round(sm.dangerousAttacksAvg),
          orta_isabeti_yuzde: round(sm.crossAccuracyPct, 0),
          uzun_pas_isabeti_yuzde: round(sm.longPassAccuracyPct, 0),
        }
      : null,
    oyuncular: team.keyPlayers.map((p) => ({
      ad: p.name,
      pozisyon: p.position,
      mac: p.appearances,
      dakika: p.minutes,
      gol: p.goals,
      asist: p.assists,
      kilit_pas: p.keyPasses,
      ort_puan: round(p.avgRating),
    })),
  };
}

export type AnalysisFacts = ReturnType<typeof buildAnalysisFacts>;

/** Modelin göreceği tek veri kaynağı. `null` alanlar "veri yok" demektir. */
export function buildAnalysisFacts(stats: DeepAnalysisStats) {
  const { fixture, headToHead } = stats;
  return {
    mac: {
      ev_sahibi: fixture.homeTeam.name,
      deplasman: fixture.awayTeam.name,
      turnuva: fixture.competition.name,
    },
    ev_sahibi: teamFacts(stats.home),
    deplasman: teamFacts(stats.away),
    aralarindaki_son_maclar: {
      ev_sahibi_galibiyet: headToHead.homeWins,
      beraberlik: headToHead.draws,
      deplasman_galibiyet: headToHead.awayWins,
      skorlar: headToHead.matches.map((m) => `${m.homeTeamName} ${m.homeGoals}-${m.awayGoals} ${m.awayTeamName}`),
    },
  };
}

const NUMBER_PATTERN = /\d+(?:[.,]\d+)?/g;

function canonical(raw: string): string {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? String(value) : raw;
}

/** Bir değerdeki her sayı (ve tam sayı / tek ondalık yuvarlaması) — izinli sayı kümesi. */
function numbersIn(value: unknown): Set<string> {
  const allowed = new Set<string>();
  for (const match of JSON.stringify(value).matchAll(NUMBER_PATTERN)) {
    const n = Number(match[0]);
    allowed.add(String(n));
    allowed.add(String(Math.round(n)));
    allowed.add(String(Number(n.toFixed(1))));
  }
  return allowed;
}

/**
 * Takım izolasyonu: her takımın sayıları ayrı kümede. Ev sahibinin metni yalnızca `home` ile,
 * deplasmanınki yalnızca `away` ile denetlenir; `shared` (maç künyesi + aralarındaki son maçlar)
 * yalnızca iki takımı birlikte ele alan alanlarda (yaklaşım, market gerekçesi) geçerlidir.
 */
export interface NumberScopes {
  home: Set<string>;
  away: Set<string>;
  shared: Set<string>;
}

export function allowedNumbersBySide(facts: AnalysisFacts): NumberScopes {
  return {
    home: numbersIn(facts.ev_sahibi),
    away: numbersIn(facts.deplasman),
    shared: numbersIn({ mac: facts.mac, aralarindaki_son_maclar: facts.aralarindaki_son_maclar }),
  };
}

export function union(...sets: Set<string>[]): Set<string> {
  return new Set(sets.flatMap((set) => [...set]));
}

export interface UngroundedNumber {
  /** Metinde geçtiği hâliyle sayı. */
  value: string;
  /** "opponent": izinli kapsamda yok ama rakibin paketinde var → takımlar karışmış. "nowhere": uydurma. */
  foundIn: "opponent" | "nowhere";
}

/**
 * Metindeki, izinli kapsamda karşılığı olmayan sayılar. `opponent` verilirse bulunamayan sayının
 * rakibin paketinde olup olmadığı da raporlanır (yanlış takıma atfedilmiş istatistik).
 */
export function findUngroundedNumbers(text: string, allowed: Set<string>, opponent: Set<string> = new Set()): UngroundedNumber[] {
  const found = new Map<string, UngroundedNumber>();
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    const value = canonical(match[0]);
    if (allowed.has(value) || found.has(match[0])) continue;
    found.set(match[0], { value: match[0], foundIn: opponent.has(value) ? "opponent" : "nowhere" });
  }
  return [...found.values()];
}

/** Yaygın kulüp kısaltma ve lakapları — resmi ad dışında hiçbiri kullanılmaz. */
const KNOWN_SHORT_FORMS = ["GS", "FB", "BJK", "TS", "İBFK", "Cimbom", "Gala", "Fener", "Kartal", "Kanarya"];

/** Takım adının başıyla örtüşen gerçek Türkçe kelimeler — kısaltma sayılmaz (ör. "Kasım" ayı). */
const REAL_WORDS = new Set(["kasım", "trabzon"]);

const words = (text: string) => text.match(/\p{L}+/gu) ?? [];
const lower = (text: string) => text.toLocaleLowerCase("tr-TR");

/**
 * Metindeki takım kısaltmaları: bilinen kısaltma/lakaplar ve resmi ad kelimelerinin kırpılmış hâli
 * (ör. "Galatasaray" → "Gala'nın"). Resmi adın tamamı ve ekli hâlleri ("Galatasaray'ın") geçerlidir.
 */
export function findTeamAbbreviations(text: string, officialNames: string[]): string[] {
  const nameWords = officialNames.flatMap((name) => words(name).map(lower)).filter((word) => word.length >= 5);
  const banned = new Set(KNOWN_SHORT_FORMS.map(lower));
  const hits = new Set<string>();
  for (const word of words(text)) {
    const w = lower(word);
    if (nameWords.includes(w) || REAL_WORDS.has(w)) continue;
    const truncated = w.length >= 3 && nameWords.some((name) => name.startsWith(w) && name.length - w.length >= 3);
    if (banned.has(w) || truncated) hits.add(word);
  }
  return [...hits];
}
