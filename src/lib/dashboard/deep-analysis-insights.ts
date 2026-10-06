import {
  ANALYSIS_POINT_COUNT,
  KEY_PLAYER_COUNT,
  type DeepAnalysisStats,
  type KeyPlayerDraft,
  type KeyPlayerStats,
  type MarketAnalysisDraft,
  type MarketSuggestion,
  type StatTileDraft,
  type TeamAnalysisDraft,
  type TeamDeepStats,
} from "@/types/deep-analysis";

/**
 * Derin analiz verisinden stüdyo formunun ilk taslağı — KURAL TABANLI, LLM yok (bkz. CLAUDE.md
 * 1.10: her sayı gerçek veriden gelir, olmayan metrik yazılmaz). Eşiği geçmeyen madde üretilmez;
 * boş kalan alanları admin doldurur. Saf fonksiyonlar, birim test edilebilir.
 */

const POSITION_LABELS = { G: "Kaleci", D: "Defans", M: "Orta Saha", F: "Forvet" } as const;

function n1(value: number): string {
  return value.toFixed(1);
}

function pct(value: number): string {
  return `%${Math.round(value)}`;
}

function wins(team: TeamDeepStats): number {
  return team.form.last5.filter((letter) => letter === "W").length;
}

function losses(team: TeamDeepStats): number {
  return team.form.last5.filter((letter) => letter === "L").length;
}

type Rule = (team: TeamDeepStats) => string | null;

/** Öncelik sırasıyla — ilk ANALYSIS_POINT_COUNT eşleşen madde alınır. */
const STRENGTH_RULES: Rule[] = [
  (t) => (wins(t) >= 3 ? `Son ${t.form.matchesSampled} maçta ${wins(t)} galibiyet — formda` : null),
  (t) => (t.form.goalsForAvg !== null && t.form.goalsForAvg >= 1.8 ? `Maç başı ${n1(t.form.goalsForAvg)} gol ile üretken hücum` : null),
  (t) => (t.form.xgForAvg !== null && t.form.xgForAvg >= 1.6 ? `Maç başı ${n1(t.form.xgForAvg)} xG — net pozisyon üretiyor` : null),
  (t) => (t.form.goalsAgainstAvg !== null && t.form.goalsAgainstAvg <= 0.8 ? `Maç başı yalnızca ${n1(t.form.goalsAgainstAvg)} gol yiyor` : null),
  (t) => (t.cleanSheets >= 2 ? `Son ${t.form.matchesSampled} maçta ${t.cleanSheets} kez kalesini gole kapattı` : null),
  (t) => (t.form.xgAgainstAvg !== null && t.form.xgAgainstAvg <= 1.0 ? `Rakibe maç başı ${n1(t.form.xgAgainstAvg)} xG veriyor — sağlam savunma` : null),
  (t) => (t.possessionAvg !== null && t.possessionAvg >= 55 ? `${pct(t.possessionAvg)} topla oynama — oyunu kontrol ediyor` : null),
  (t) => (t.passAccuracyAvg !== null && t.passAccuracyAvg >= 85 ? `${pct(t.passAccuracyAvg)} pas isabeti` : null),
];

const CAUTION_RULES: Rule[] = [
  (t) => (losses(t) >= 2 ? `Son ${t.form.matchesSampled} maçta ${losses(t)} mağlubiyet` : null),
  (t) => (t.form.goalsAgainstAvg !== null && t.form.goalsAgainstAvg >= 1.5 ? `Maç başı ${n1(t.form.goalsAgainstAvg)} gol yiyor` : null),
  (t) => (t.form.xgAgainstAvg !== null && t.form.xgAgainstAvg >= 1.5 ? `Rakibe maç başı ${n1(t.form.xgAgainstAvg)} xG veriyor` : null),
  (t) => (t.failedToScore >= 2 ? `Son ${t.form.matchesSampled} maçta ${t.failedToScore} kez gol atamadı` : null),
  (t) =>
    t.form.goalsForAvg !== null && t.form.xgForAvg !== null && t.form.goalsForAvg <= t.form.xgForAvg - 0.4
      ? `Bitiricilik: maç başı ${n1(t.form.xgForAvg)} xG'ye karşı ${n1(t.form.goalsForAvg)} gol`
      : null,
  (t) => (t.form.goalsForAvg !== null && t.form.goalsForAvg <= 1.0 ? `Maç başı ${n1(t.form.goalsForAvg)} gol — hücumda üretkenlik sorunu` : null),
  (t) => (t.possessionAvg !== null && t.possessionAvg <= 45 ? `${pct(t.possessionAvg)} topla oynama — oyunu rakibe bırakıyor` : null),
];

function applyRules(rules: Rule[], team: TeamDeepStats): string[] {
  const points = rules.map((rule) => rule(team)).filter((point): point is string => point !== null);
  return Array.from({ length: ANALYSIS_POINT_COUNT }, (_, index) => points[index] ?? "");
}

function playerRole(player: KeyPlayerStats): string {
  const parts: string[] = [player.position ? POSITION_LABELS[player.position] : "Oyuncu"];
  if (player.goals > 0) parts.push(`${player.goals} gol`);
  if (player.assists > 0) parts.push(`${player.assists} asist`);
  if (player.goals + player.assists === 0 && player.keyPasses > 0) parts.push(`${player.keyPasses} kilit pas`);
  if (player.avgRating !== null) parts.push(`${n1(player.avgRating)} puan`);
  return parts.join(" · ");
}

function keyPlayers(team: TeamDeepStats): KeyPlayerDraft[] {
  return Array.from({ length: KEY_PLAYER_COUNT }, (_, index) => {
    const player = team.keyPlayers[index];
    return player ? { name: player.name, role: playerRole(player), photoUrl: player.photoUrl } : { name: "", role: "", photoUrl: "" };
  });
}

/** Görseldeki 4'lü istatistik bloğu (etiketler referans tasarımla aynı) — veri yoksa "—", uydurma sayı yok. */
function statTiles(team: TeamDeepStats): StatTileDraft[] {
  const value = (v: number | null, format: (x: number) => string) => (v === null ? "—" : format(v));
  const { xgForAvg, xgMatchesSampled } = team.form;
  return [
    // Referanstaki "xG (Son 5)" = son maçların toplam xG'si; örneklem 5'ten azsa etiket onu söyler.
    { label: `xG (Son ${xgMatchesSampled || 5})`, value: value(xgForAvg === null ? null : xgForAvg * xgMatchesSampled, n1) },
    { label: "Top Hakimiyeti", value: value(team.possessionAvg, pct) },
    { label: "İsabetli Pas", value: value(team.passAccuracyAvg, pct) },
    // API-Football "başarılı pres" sunmaz — en yakın gerçek gösterge: maç başı müdahale + top kesme.
    { label: "Top Kazanma", value: value(team.ballWinsAvg, n1) },
  ];
}

/** Rakibin açıklarına ve takımın oyun tarzına göre 1-2 cümlelik yaklaşım önerisi. */
function approach(team: TeamDeepStats, opponent: TeamDeepStats): string {
  const name = opponent.form.teamName;
  const sentences: string[] = [];
  if (opponent.form.goalsAgainstAvg !== null && opponent.form.goalsAgainstAvg >= 1.5) {
    sentences.push(`${name} maç başı ${n1(opponent.form.goalsAgainstAvg)} gol yiyor; erken ve yoğun hücum baskısı sonuç getirebilir.`);
  }
  if (opponent.form.goalsForAvg !== null && opponent.form.goalsForAvg >= 1.8) {
    sentences.push(`${name} maç başı ${n1(opponent.form.goalsForAvg)} gol atıyor; geçiş savunmasında kompakt kalmak kritik.`);
  }
  if (team.possessionAvg !== null && opponent.possessionAvg !== null && team.possessionAvg - opponent.possessionAvg >= 8) {
    sentences.push(`Topa daha çok sahip olan taraf (${pct(team.possessionAvg)} / ${pct(opponent.possessionAvg)}); sabırlı pas oyunuyla oyunu rakip yarı alanda tutmalı.`);
  }
  if (team.formation) sentences.push(`Son maçlarda tercih edilen diziliş: ${team.formation}.`);
  return sentences.slice(0, 2).join(" ");
}

function teamDraft(team: TeamDeepStats, opponent: TeamDeepStats): TeamAnalysisDraft {
  return {
    teamName: team.form.teamName,
    logoUrl: team.form.logoUrl,
    colorHex: "",
    heroImageUrl: "",
    strengths: applyRules(STRENGTH_RULES, team),
    cautions: applyRules(CAUTION_RULES, team),
    keyPlayers: keyPlayers(team),
    stats: statTiles(team),
    approach: approach(team, opponent),
    quote: "",
  };
}

/**
 * İki takımın son maç verisinden market önerileri. Beklenen toplam gol = her takımın attığı ile
 * rakibin yediğinin ortalaması, iki yön için toplanır. Öneri değil, gerekçeli bir başlangıç noktası.
 */
export function suggestMarkets(stats: DeepAnalysisStats): MarketSuggestion[] {
  const { home, away } = stats;
  const suggestions: MarketSuggestion[] = [];

  const hf = home.form;
  const af = away.form;
  if (hf.goalsForAvg !== null && hf.goalsAgainstAvg !== null && af.goalsForAvg !== null && af.goalsAgainstAvg !== null) {
    const expected = (hf.goalsForAvg + af.goalsAgainstAvg) / 2 + (af.goalsForAvg + hf.goalsAgainstAvg) / 2;
    if (expected >= 2.8) suggestions.push({ pick: "2.5 Üst", reason: `Beklenen toplam gol ${n1(expected)}` });
    else if (expected <= 2.0) suggestions.push({ pick: "2.5 Alt", reason: `Beklenen toplam gol ${n1(expected)}` });
  }

  const sampled = hf.matchesSampled + af.matchesSampled;
  if (sampled > 0) {
    const btts = home.bttsCount + away.bttsCount;
    const rate = btts / sampled;
    if (rate >= 0.6) suggestions.push({ pick: "KG Var", reason: `İki takımın son ${sampled} maçında ${btts} kez karşılıklı gol` });
    else if (rate <= 0.3) suggestions.push({ pick: "KG Yok", reason: `İki takımın son ${sampled} maçında yalnızca ${btts} kez karşılıklı gol` });
  }

  const formGap = wins(home) - wins(away);
  if (formGap >= 2) suggestions.push({ pick: `${hf.teamName} kazanır (MS 1)`, reason: `Son 5 maçta ${wins(home)} galibiyete karşı ${wins(away)}` });
  else if (formGap <= -2) suggestions.push({ pick: `${af.teamName} kazanır (MS 2)`, reason: `Son 5 maçta ${wins(away)} galibiyete karşı ${wins(home)}` });

  return suggestions;
}

export function buildMarketAnalysisDraft(fixtureId: string, stats: DeepAnalysisStats): MarketAnalysisDraft {
  const [first] = suggestMarkets(stats);
  return {
    fixtureId,
    home: teamDraft(stats.home, stats.away),
    away: teamDraft(stats.away, stats.home),
    marketPick: first?.pick ?? "",
    marketRationale: first?.reason ?? "",
  };
}

export function emptyTeamDraft(teamName = "", logoUrl = ""): TeamAnalysisDraft {
  return {
    teamName,
    logoUrl,
    colorHex: "",
    heroImageUrl: "",
    strengths: Array.from({ length: ANALYSIS_POINT_COUNT }, () => ""),
    cautions: Array.from({ length: ANALYSIS_POINT_COUNT }, () => ""),
    keyPlayers: Array.from({ length: KEY_PLAYER_COUNT }, () => ({ name: "", role: "", photoUrl: "" })),
    stats: [
      { label: "xG (Son 5)", value: "—" },
      { label: "Top Hakimiyeti", value: "—" },
      { label: "İsabetli Pas", value: "—" },
      { label: "Top Kazanma", value: "—" },
    ],
    approach: "",
    quote: "",
  };
}
