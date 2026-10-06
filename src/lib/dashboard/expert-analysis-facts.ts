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

/** Olgu paketindeki her sayı (ve tam sayı kısmı / tek ondalık yuvarlaması) — izinli sayı kümesi. */
export function allowedNumbers(facts: unknown): Set<string> {
  const allowed = new Set<string>();
  for (const match of JSON.stringify(facts).matchAll(NUMBER_PATTERN)) {
    const value = Number(match[0]);
    allowed.add(String(value));
    allowed.add(String(Math.round(value)));
    allowed.add(String(Number(value.toFixed(1))));
  }
  return allowed;
}

/** Metindeki, olgu paketinde karşılığı olmayan sayılar (ör. uydurulmuş bir istatistik). */
export function findUngroundedNumbers(text: string, allowed: Set<string>): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(NUMBER_PATTERN)) {
    if (!allowed.has(canonical(match[0]))) found.add(match[0]);
  }
  return [...found];
}
