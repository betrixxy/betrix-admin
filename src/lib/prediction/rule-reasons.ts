import { formatNumber } from "@/lib/format/number";
import { REASON_MAX_LENGTH, REASON_MAX_WORDS, wordCount, type Scenario } from "@/types/prediction";
import type { MatchSides } from "./catalog";
import { directionIssues } from "./reason-claims";
import { auditReason, type VitrinFacts } from "./reasons";

/**
 * Kural tabanlı gerekçeler (AI yoksa ya da AI gerekçesi denetimden geçmezse) — sayılar olgu paketinden,
 * her parçada örneklem yazılı ("son 5 maçta"). Aday parçalar seçili sonuca göre YÖN denetiminden geçer
 * (`reason-claims.ts`, AI denetimiyle aynı fonksiyon): yalnızca sonucu destekleyen parçalar yazılır,
 * çelişen hiçbir zaman. Destekleyen parça yoksa gerekçe boş kalır (kart kilitlenir, admin yazar).
 * Gerekçeler KUTUYA ÖZGÜDÜR (2026-10-30): `ruleReasons` senaryoları katalog sırasıyla yazar, bir kutunun
 * kullandığı parça sonrakilerde yeniden kullanılmaz — iki açık kutuya aynı cümle ("Fenerbahçe son 5 maçta
 * maç başı 1,8 gol attı.") yazılmaz; her senaryonun aday sırası önce kendi konusunun verisini dener.
 */

type Team = VitrinFacts["ev_sahibi"];

const decimal = (value: number) => formatNumber(value);
/** "İki takım da gol buldu" parçasının destek eşiği (son maçların oranı). */
const BOTH_SCORED_SUPPORT = 0.6;
/** Sayının bulunma eki ("4'ünde", "3'ünde", "5'inde") — "… tanesinde" 10 sözcük sınırını aşıyordu. */
const LOCATIVE: Record<number, string> = { 1: "inde", 2: "sinde", 3: "ünde", 4: "ünde", 5: "inde", 6: "sında", 7: "sinde", 8: "inde", 9: "unda", 10: "unda" };
const locative = (count: number) => `${count}'${LOCATIVE[count] ?? "inde"}`;

/** Takımın aday parçaları (her biri tek iddia, kendi örneklemiyle). */
function teamParts(team: Team, name: string, withXg: boolean): Record<string, string | null> {
  const n = team.ornek_mac;
  return {
    form: `${name} son ${n} maçında ${team.galibiyet} galibiyet aldı`,
    losses: team.maglubiyet > 0 ? `${name} son ${n} maçında ${team.maglubiyet} kez yenildi` : null,
    scoring: team.gol_atilan_ort === null ? null : `${name} son ${n} maçta maç başı ${decimal(team.gol_atilan_ort)} gol attı`,
    conceding: team.gol_yenilen_ort === null ? null : `${name} son ${n} maçta maç başı ${decimal(team.gol_yenilen_ort)} gol yedi`,
    // "0 kez gol yemedi" okunmaz — sıfır sayım yazılmaz.
    clean: team.gol_yemedigi_mac > 0 ? `${name} son ${n} maçta ${team.gol_yemedigi_mac} kez gol yemedi` : null,
    blank: team.gol_atamadigi_mac > 0 ? `${name} son ${n} maçta ${team.gol_atamadigi_mac} kez gol atamadı` : null,
    goalsSeen: `${name} son ${n} maçının ${team.uc_veya_daha_fazla_gollu_mac} tanesinde 3+ gol gördü`,
    // "İki takım da gol bulur mu?"nun kendi verisi. Yön desenlerinde (`reason-claims.ts`) karşılığı yok —
    // yalnızca açıkça destekliyorsa (≥ %60) aday olur, EVET seçiminde.
    bothScored: team.iki_takimin_da_gol_buldugu_mac / Math.max(n, 1) >= BOTH_SCORED_SUPPORT ? `${name} son ${n} maçının ${locative(team.iki_takimin_da_gol_buldugu_mac)} iki takım da gol buldu` : null,
    xg: withXg && "xg_ort" in team && typeof team.xg_ort === "number" ? `${name} bu sezon ligde maç başına ${decimal(team.xg_ort)} xG üretiyor` : null,
  };
}

/** Senaryoya göre aday sırası: önce en doğrudan veri. `a` seçilen taraf (taraf yoksa ev sahibi), `b` rakibi. */
function candidates(scenario: Scenario, facts: VitrinFacts, sides: MatchSides): (string | null)[] {
  const { outcome } = scenario;
  const awayFirst = outcome.scenario === "COMBO" ? outcome.team === "AWAY" : "pick" in outcome && outcome.pick === "AWAY";
  const home = teamParts(facts.ev_sahibi, sides.home, true);
  const away = teamParts(facts.deplasman, sides.away, true);
  const [a, b] = awayFirst ? [away, home] : [home, away];
  switch (scenario.id) {
    case "RESULT_1X2":
    case "HT_RESULT":
      if ("pick" in outcome && outcome.pick === "DRAW") return [home.form, away.form];
      return [a.form, a.scoring, b.conceding, b.losses, a.clean, a.losses, b.form, b.blank];
    case "BTTS":
      return outcome.pick === "YES"
        ? [a.bothScored, b.bothScored, b.scoring, a.conceding, b.conceding, a.scoring, a.goalsSeen, b.goalsSeen]
        : [a.clean, b.clean, a.blank, b.blank, a.scoring, b.scoring];
    case "GOALS_3PLUS":
    case "GOALS_4PLUS":
      return outcome.pick === "YES"
        ? [a.goalsSeen, b.goalsSeen, a.scoring, b.scoring, a.conceding, b.conceding, a.xg, b.xg]
        : [a.clean, b.clean, a.goalsSeen, b.goalsSeen, a.conceding, b.conceding, a.blank, b.blank];
    case "COMBO":
      return outcome.pick === "YES" ? [a.form, a.scoring, b.conceding, a.goalsSeen] : [b.clean, a.blank, a.losses, b.form, a.goalsSeen, b.goalsSeen, b.conceding, a.form];
  }
}

/** Parça seçili sonucu destekliyor mu? AI denetimiyle aynı yön kuralı (`directionIssues`). */
function supports(part: string, scenario: Scenario, facts: VitrinFacts, sides: MatchSides): boolean {
  const sample = (side: "home" | "away" | null) => (side === "away" ? facts.deplasman.ornek_mac : facts.ev_sahibi.ornek_mac);
  return directionIssues(part, scenario.outcome, sides, sample).length === 0;
}

/** Parçaları sığdığı kadar birleştirir (≤160 karakter, ≤10 sözcük); ilk parça her zaman alınır. */
function compose(parts: string[]): string {
  let out = "";
  for (const part of parts) {
    // Parçalar takım adıyla başlar — özel ad küçültülmez.
    const next = out ? `${out}; ${part}` : part;
    if (next.length + 1 > REASON_MAX_LENGTH || wordCount(next) > REASON_MAX_WORDS) break;
    out = next;
  }
  return out ? `${out}.` : "";
}

/** Gerekçenin parçaları ("a; b." → ["a", "b"]) — kullanılmış parça kümesi için. */
const partsOf = (reason: string): string[] => reason.replace(/\.$/u, "").split("; ").filter(Boolean);

/** Tek senaryonun gerekçesi; `used` verilirse o parçalar atlanır (başka kutunun gerekçesi). */
export function ruleReason(scenario: Scenario, facts: VitrinFacts, sides: MatchSides, used: ReadonlySet<string> = new Set()): string {
  const parts = candidates(scenario, facts, sides).filter((part): part is string => part !== null && !used.has(part) && supports(part, scenario, facts, sides));
  const passes = (text: string) => text !== "" && auditReason(text, scenario.outcome, facts, sides).length === 0;
  const joined = compose(parts);
  if (passes(joined)) return joined;
  // Birleşik metin denetime takılırsa (ör. konu) tek parçalar sırayla denenir.
  return parts.map((part) => `${part}.`).find(passes) ?? "";
}

/**
 * Bütün senaryoların kural tabanlı gerekçeleri, KUTUYA ÖZGÜ: senaryolar verilen sırayla (katalog: önce
 * kazanma olasılıkları) yazılır, bir gerekçenin parçası sonrakilerde kullanılmaz. Ayrı parça kalmazsa
 * gerekçe boş (kutu açılırsa kart kilitlenir, admin yazar) — iki kutuda aynı cümle olmaz.
 */
export function ruleReasons(scenarios: readonly Scenario[], facts: VitrinFacts, sides: MatchSides): string[] {
  const used = new Set<string>();
  return scenarios.map((scenario) => {
    const reason = ruleReason(scenario, facts, sides, used);
    for (const part of partsOf(reason)) used.add(part);
    return reason;
  });
}
