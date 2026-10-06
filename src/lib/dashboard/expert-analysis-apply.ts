import {
  findTeamAbbreviations,
  findUngroundedNumbers,
  union,
  type NumberScopes,
} from "@/lib/dashboard/expert-analysis-facts";
import type { ExpertAnalysisOutput } from "@/lib/services/anthropic/types";
import {
  ANALYSIS_POINT_COUNT,
  KEY_PLAYER_COUNT,
  type DeepAnalysisStats,
  type KeyPlayerDraft,
  type MarketAnalysisDraft,
  type TeamAnalysisDraft,
  type TeamDeepStats,
  type TeamSide,
} from "@/types/deep-analysis";

/**
 * Analist (Claude) çıktısını forma uygulayan saf fonksiyonlar — servis/env bağımlılığı yok, birim
 * test edilebilir (bkz. tests/unit/expert-analysis.test.ts).
 */

/** Market çizgileri olgu değil, market adıdır ("2.5 Üst") — sayı denetiminden muaf. */
export const MARKET_LINES = ["0.5", "1.5", "2.5", "3.5", "4.5"];

/** Form/şablon sınırları (bkz. market-analysis/actions.ts şeması). */
const LIMITS = { point: 120, role: 60, approach: 400, quote: 240, pick: 40, rationale: 160 } as const;

const SIDE_LABEL: Record<TeamSide, string> = { home: "Ev sahibi", away: "Deplasman" };

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–-]+$/, "")}…`;
}

function points(values: string[]): string[] {
  return Array.from({ length: ANALYSIS_POINT_COUNT }, (_, i) => clip(values[i] ?? "", LIMITS.point));
}

const sameName = (a: string, b: string) => a.toLocaleLowerCase("tr-TR").trim() === b.toLocaleLowerCase("tr-TR").trim();

/**
 * Modelin seçtiği oyuncuları gerçek oyuncu verisine bağlar (fotoğraf oradan gelir). Pakette olmayan
 * bir ad uydurma sayılır ve atlanır; eksik kalan yerler kural tabanlı seçimle tamamlanır.
 */
function players(
  chosen: ExpertAnalysisOutput["home"]["key_players"],
  team: TeamDeepStats,
  fallback: KeyPlayerDraft[],
  warn: (message: string) => void,
): KeyPlayerDraft[] {
  const result: KeyPlayerDraft[] = [];
  for (const pick of chosen) {
    const player = team.keyPlayers.find((p) => sameName(p.name, pick.name));
    if (!player) {
      warn(`"${pick.name}" olgu paketinde yok — atlandı`);
      continue;
    }
    if (result.some((p) => sameName(p.name, player.name))) continue;
    result.push({ name: player.name, role: clip(pick.role, LIMITS.role), photoUrl: player.photoUrl });
  }
  for (const extra of fallback) {
    if (result.length >= KEY_PLAYER_COUNT) break;
    if (extra.name && !result.some((p) => sameName(p.name, extra.name))) result.push(extra);
  }
  while (result.length < KEY_PLAYER_COUNT) result.push({ name: "", role: "", photoUrl: "" });
  return result.slice(0, KEY_PLAYER_COUNT);
}

const OTHER: Record<TeamSide, TeamSide> = { home: "away", away: "home" };

/**
 * Kural tabanlı taslağın (logo, renk, istatistik bloğu, oyuncu fotoğrafları) üzerine analistin
 * metinlerini yazar ve "Çelik Kasa" denetimini uygular. Saf fonksiyon.
 *
 * Sayı denetimi takım izolasyonludur (bkz. expert-analysis-facts.ts):
 * - Güçlü yön, dikkat, oyuncu rolü, alıntı → yalnızca o takımın paketi. Rakibin sayısı da hatadır
 *   ("takım karışmış"), hiçbir pakette olmayan sayı da ("veride yok").
 * - Önerilen yaklaşım → tanımı gereği rakibe karşı plan: kendi + rakip + ortak (aralarındaki maçlar).
 * - Market gerekçesi → iki takım + ortak + market çizgileri ("2.5 Üst").
 * Ayrıca her metinde takım kısaltması/lakabı aranır ("Gala", "GS"…).
 */
export function applyExpertAnalysis(
  base: MarketAnalysisDraft,
  output: ExpertAnalysisOutput,
  stats: DeepAnalysisStats,
  scopes: NumberScopes,
): { draft: MarketAnalysisDraft; warnings: string[] } {
  const warnings: string[] = [];
  const officialNames = [stats.fixture.homeTeam.name, stats.fixture.awayTeam.name];

  const check = (owner: string, field: string, text: string, allowed: Set<string>, opponent?: Set<string>) => {
    for (const { value, foundIn } of findUngroundedNumbers(text, allowed, opponent)) {
      const reason = foundIn === "opponent" ? "rakibin verisine ait — takım karışmış" : "veride yok";
      warnings.push(`${owner} metninde dayanaksız sayı: ${value} (${field}; ${reason})`);
    }
    for (const abbreviation of findTeamAbbreviations(text, officialNames)) {
      warnings.push(`${owner} metninde kısaltma/lakap: "${abbreviation}" (${field}) — resmi takım adını kullanın`);
    }
  };

  const team = (side: TeamSide): TeamAnalysisDraft => {
    const analysis = output[side];
    const owner = SIDE_LABEL[side];
    const own = scopes[side];
    const opponent = scopes[OTHER[side]];
    const draft: TeamAnalysisDraft = {
      ...base[side],
      strengths: points(analysis.strengths),
      cautions: points(analysis.cautions),
      keyPlayers: players(analysis.key_players, stats[side], base[side].keyPlayers, (m) => warnings.push(`${owner} · ${m}`)),
      approach: clip(analysis.approach, LIMITS.approach),
      quote: clip(analysis.quote, LIMITS.quote),
    };
    draft.strengths.forEach((text, i) => check(owner, `güçlü yön ${i + 1}`, text, own, opponent));
    draft.cautions.forEach((text, i) => check(owner, `dikkat ${i + 1}`, text, own, opponent));
    draft.keyPlayers.forEach((player, i) => check(owner, `oyuncu ${i + 1} rolü`, player.role, own, opponent));
    check(owner, "alıntı", draft.quote, own, opponent);
    check(owner, "önerilen yaklaşım", draft.approach, union(own, opponent, scopes.shared));
    return draft;
  };

  const draft: MarketAnalysisDraft = {
    ...base,
    home: team("home"),
    away: team("away"),
    marketPick: clip(output.market.pick, LIMITS.pick),
    marketRationale: clip(output.market.rationale, LIMITS.rationale),
  };
  check("Market gerekçesi", "market", draft.marketRationale, union(scopes.home, scopes.away, scopes.shared, new Set(MARKET_LINES)));
  return { draft, warnings };
}
