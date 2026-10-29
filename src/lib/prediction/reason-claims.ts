import type { ScenarioOutcome } from "@/types/prediction";
import type { MatchSides } from "./catalog";

/**
 * Gerekçe YÖN ve ÖRNEKLEM denetimi — saf. Gerekçedeki her sayısal iddia (ör. "Konyaspor son 5 maçta maç
 * başı 0,8 gol attı") bir metriğe çevrilir ve seçili sonuca göre yönü bulunur: destekler (+1), çelişir
 * (−1), nötr (0). "İki takım da gol bulur mu? EVET" için az gol atmak çelişir ve reddedilir. AI gerekçesi
 * de kural tabanlı gerekçe de aynı fonksiyondan geçer (`reasons.ts::auditReason`, `rule-reasons.ts`).
 *
 * Eşikler (maç başı ortalama / son N maçtaki oran) bilinçli olarak kaba: ortadaki bant nötrdür —
 * nötr iddia tek başına sonucu desteklemez.
 */

export type ClaimMetric = "GOALS_FOR" | "GOALS_AGAINST" | "XG_FOR" | "XG_AGAINST" | "WINS" | "LOSSES" | "DRAWS" | "CLEAN_SHEETS" | "FAILED_TO_SCORE" | "GOALS_3PLUS_MATCHES";
export type Direction = -1 | 0 | 1;

export interface Claim {
  metric: ClaimMetric;
  /** İddianın takımı (cümlecikte tek takım adı; yoksa önceki cümleciğin öznesi); belirsizse null. */
  side: "home" | "away" | null;
  /** Ortalama metriklerde maç başı değer; sayım metriklerinde örnekleme oran (0–1). */
  value: number;
  text: string;
}

/** Cümlecik sınırı — `reasons.ts` ile aynı (ondalık "2,4" bölünmez). */
export const CLAUSE_SPLIT = /[;:]|[,.](?=\s|$)|\s(?:ve|ama|fakat|ancak|oysa|iken|buna karşın)\s/u;
const lower = (text: string) => text.toLocaleLowerCase("tr-TR");
const num = (raw: string) => Number(raw.replace(",", "."));

/** Örneklem ifadesi: "son 5 maçta", "8 maçta", "bu sezon ligde", "üst üste 3", "aralarındaki son maçlar". */
const SAMPLE = /son \d+ maç\p{L}*|\d+ maç(?:ta|ında|ının|ın)(?!\p{L})|bu sezon|ligde|üst üste \d+|aralarındaki son/gu;
/** Senaryonun kendi sayıları ("3+ gol", "4+ gol") örneklem istemez. */
const SCENARIO_NUMBER = /\d\+/gu;
const PER_MATCH = /maç başı|ortalama/u;

export function clauseSide(clause: string, sides: MatchSides): "home" | "away" | null {
  const has = (name: string) => lower(clause).includes(lower(name));
  const home = has(sides.home);
  const away = has(sides.away);
  return home === away ? null : home ? "home" : "away";
}

const hasOwnName = (clause: string, sides: MatchSides) => lower(clause).includes(lower(sides.home)) || lower(clause).includes(lower(sides.away));

/** Cümlecikler; takım adı geçmeyen cümlecik önceki cümleciğin öznesini ve örneklemini devralır. */
interface Clause {
  text: string;
  /** Özgün yazımıyla (mesajlar için). */
  raw: string;
  side: "home" | "away" | null;
  sampled: boolean;
  sampleSize: number | null;
}

export function splitClauses(reason: string, sides: MatchSides): Clause[] {
  const out: Clause[] = [];
  for (const raw of reason.split(CLAUSE_SPLIT)) {
    const text = lower(raw).trim();
    if (!text) continue;
    const previous = out.at(-1);
    const own = hasOwnName(text, sides);
    const size = /son (\d+) maç|(\d+) maç(?:ta|ında|ının|ın)(?!\p{L})/u.exec(text);
    const sampleSize = size ? Number(size[1] ?? size[2]) : null;
    const sampled = new RegExp(SAMPLE.source, "u").test(text);
    out.push({
      text,
      raw: raw.trim(),
      side: own ? clauseSide(text, sides) : (previous?.side ?? null),
      sampled: sampled || (!own && (previous?.sampled ?? false)),
      sampleSize: sampleSize ?? (!own ? (previous?.sampleSize ?? null) : null),
    });
  }
  return out;
}

/** Örneklemsiz sayı içeren cümlecikler (her sayının örneklemi yazılmalı; "maç başı" tek başına yetmez). */
export function unsampledClauses(reason: string, sides: MatchSides): string[] {
  return splitClauses(reason, sides)
    .filter((clause) => !clause.sampled && /\d/u.test(clause.text.replace(SAMPLE, " ").replace(SCENARIO_NUMBER, " ")))
    .map((clause) => clause.raw);
}

const N = "(\\d+(?:,\\d+)?)";
/** Metrik desenleri (küçük harf). Sayım desenlerinde sayı, örneklemdeki maç sayısıdır. */
const PATTERNS: { metric: ClaimMetric; re: RegExp; count: boolean }[] = [
  { metric: "CLEAN_SHEETS", re: new RegExp(`${N} (?:kez|maçta|maçında) gol yeme(?:di|miş|yerek)`, "u"), count: true },
  { metric: "FAILED_TO_SCORE", re: new RegExp(`${N} (?:kez|maçta|maçında) gol ata(?:madı|mamış)`, "u"), count: true },
  { metric: "GOALS_3PLUS_MATCHES", re: new RegExp(`${N} (?:tanesinde|kez|maçta|maçında) 3\\+ gol`, "u"), count: true },
  { metric: "XG_AGAINST", re: new RegExp(`${N} xg(?:'ye|’ye)? (?:izin|yedi|yiyor)`, "u"), count: false },
  { metric: "XG_FOR", re: new RegExp(`${N} xg(?!(?:'ye|’ye)? (?:izin|yedi|yiyor))`, "u"), count: false },
  { metric: "GOALS_FOR", re: new RegExp(`${N} gol (?:at(?!ama)|buldu|buluyor|kaydet)`, "u"), count: false },
  { metric: "GOALS_AGAINST", re: new RegExp(`${N} gol (?:yiyor|yedi(?!\\p{L})|yemiş|yiyerek)|${N} gole izin`, "u"), count: false },
  { metric: "WINS", re: new RegExp(`${N} galibiyet|${N} maç(?:ı)? kazan|üst üste ${N} maç kazan`, "u"), count: true },
  { metric: "LOSSES", re: new RegExp(`${N} (?:mağlubiyet|yenilgi)|${N} (?:kez|maçta) yenil|${N} maç(?:ı)? kaybet`, "u"), count: true },
  { metric: "DRAWS", re: new RegExp(`${N} beraberlik`, "u"), count: true },
];

/** Gerekçenin sayısal iddiaları; örneklem yazılmamışsa takımın son maç sayısı (`fallbackSample`). */
export function extractClaims(reason: string, sides: MatchSides, fallbackSample: (side: "home" | "away" | null) => number): Claim[] {
  const claims: Claim[] = [];
  for (const clause of splitClauses(reason, sides)) {
    for (const { metric, re, count } of PATTERNS) {
      const match = re.exec(clause.text);
      if (!match) continue;
      const raw = match.slice(1).find((group) => group !== undefined);
      if (raw === undefined) continue;
      const value = num(raw);
      const streak = metric === "WINS" && /üst üste/u.test(match[0]);
      const sample = streak ? value : (clause.sampleSize ?? fallbackSample(clause.side));
      // Ortalama: "maç başı"/ondalık değer doğrudan; tamsayı toplam ("9 gol attı") örnekleme bölünür.
      const perMatch = count ? value / Math.max(sample, value, 1) : PER_MATCH.test(clause.text) || raw.includes(",") ? value : value / Math.max(sample, 1);
      claims.push({ metric, side: clause.side, value: perMatch, text: match[0] });
    }
  }
  return claims;
}

const band = (value: number, low: number, high: number): Direction => (value >= high ? 1 : value <= low ? -1 : 0);

/** İddia "maçta gol çok" yönünde mi (+1), "gol az" mı (−1)? Takımdan bağımsız. */
export function goalsSignal(claim: Claim): Direction {
  switch (claim.metric) {
    case "GOALS_FOR":
    case "GOALS_AGAINST":
    case "XG_FOR":
    case "XG_AGAINST":
      return band(claim.value, 1.0, 1.3);
    case "GOALS_3PLUS_MATCHES":
      return band(claim.value, 0.4, 0.6);
    case "CLEAN_SHEETS":
    case "FAILED_TO_SCORE":
      return (-band(claim.value, 0.2, 0.4)) as Direction;
    default:
      return 0;
  }
}

/** İddia, iddianın takımının GÜÇLÜ olduğunu mu (+1) zayıf olduğunu mu (−1) söylüyor? */
export function strengthSignal(claim: Claim): Direction {
  switch (claim.metric) {
    case "WINS":
      return band(claim.value, 0.2, 0.6);
    case "LOSSES":
      return claim.value === 0 ? 1 : claim.value >= 0.4 ? -1 : 0;
    case "GOALS_FOR":
    case "XG_FOR":
      return band(claim.value, 1.0, 1.5);
    case "GOALS_AGAINST":
    case "XG_AGAINST":
      return (-band(claim.value, 1.0, 1.5)) as Direction;
    case "CLEAN_SHEETS":
      return claim.value >= 0.4 ? 1 : 0;
    case "FAILED_TO_SCORE":
      return claim.value >= 0.4 ? -1 : 0;
    default:
      return 0;
  }
}

/** Seçilen tarafın gözünden güç: kendi gücü destekler, rakibin gücü çelişir; takımsız iddia nötr. */
function sideDirection(claim: Claim, team: "HOME" | "AWAY"): Direction {
  if (claim.side === null) return 0;
  const strength = strengthSignal(claim);
  return ((claim.side === (team === "HOME" ? "home" : "away") ? 1 : -1) * strength) as Direction;
}

/** İddianın seçili sonuca göre yönü. Beraberlik seçiminde yön ölçülmez (güç iddiası beraberliğe dair değil). */
export function claimDirection(claim: Claim, outcome: ScenarioOutcome): Direction {
  switch (outcome.scenario) {
    case "RESULT_1X2":
    case "HT_RESULT":
      return outcome.pick === "DRAW" ? 0 : sideDirection(claim, outcome.pick);
    case "BTTS":
    case "GOALS_3PLUS":
    case "GOALS_4PLUS":
      return ((outcome.pick === "YES" ? 1 : -1) * goalsSignal(claim)) as Direction;
    case "COMBO": {
      const result = sideDirection(claim, outcome.team);
      const goals = goalsSignal(claim);
      if (outcome.pick === "YES") return result === -1 ? -1 : result === 1 || goals === 1 ? 1 : goals === -1 ? -1 : 0;
      return result === -1 || goals === -1 ? 1 : result === 1 || goals === 1 ? -1 : 0;
    }
  }
}

/** Yön ölçülmeyen seçim (beraberlik): gerekçe yalnızca diğer denetimlerden geçer. */
export const directionApplies = (outcome: ScenarioOutcome): boolean => !("pick" in outcome && outcome.pick === "DRAW");

/**
 * Destekleyen iddia zorunlu mu? "Kazanır VE 3+ gol — HAYIR" bir birleşimin reddidir; tek bir olgu onu
 * nadiren doğrudan destekler — nötr iddia kabul; koşullardan birini destekleyen iddia çelişir, reddedilir.
 */
const requiresSupport = (outcome: ScenarioOutcome): boolean => !(outcome.scenario === "COMBO" && outcome.pick === "NO");

/** Yön sorunları: çelişen her iddia; iddia var ama hiçbiri desteklemiyorsa bir sorun. Boş dizi = yön temiz. */
export function directionIssues(reason: string, outcome: ScenarioOutcome, sides: MatchSides, fallbackSample: (side: "home" | "away" | null) => number): string[] {
  if (!directionApplies(outcome)) return [];
  const claims = extractClaims(reason, sides, fallbackSample);
  if (!claims.length) return [];
  const directions = claims.map((claim) => claimDirection(claim, outcome));
  const issues = claims.filter((_, index) => directions[index] === -1).map((claim) => `"${claim.text}" seçili sonucu desteklemiyor, tersini söylüyor`);
  if (!issues.length && requiresSupport(outcome) && !directions.includes(1)) issues.push("gerekçedeki veri seçili sonucu desteklemiyor (nötr)");
  return issues;
}
