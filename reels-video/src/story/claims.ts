import { formatDecimal, formatInt } from "../lib/motion";
import type { MatchData } from "./match-data";

/**
 * Yorum cümlesi: şablon + veri anahtarları. Şablonda rakam yazılamaz; her rakam `MatchData` içinden anahtarla okunur ve kodla
 * eklenir, bu yüzden uydurulamaz. Anahtarın değeri yoksa cümle kurulmaz. Test: `tests/analysis.test.ts`.
 */

export type FactFormat = "prob" | "pct" | "pctIn" | "int" | "dec1" | "dec2" | "text";

export type Fact =
  | { key: string; format: FactFormat }
  | { keys: readonly string[]; op: "sum" | "diff"; format: Exclude<FactFormat, "text" | "prob" | "pctIn"> }
  /** Sabit etiket (dilim adı gibi). Takım adı değil: ad da anahtardan okunur. */
  | { label: string };

export interface Reason {
  id: string;
  /** `{yuva}` işaretli şablon: LLM yalnız bunu görür. */
  template: string;
  text: string;
  /** Cümlenin dayandığı veri anahtarları. Boş olamaz. */
  sources: string[];
  /** Metindeki bütün rakamlar buradan gelir. */
  figures: string[];
}

export const valueAt = (data: unknown, path: string): unknown => path.split(".").reduce<unknown>((value, part) => (value !== null && typeof value === "object" ? (value as Record<string, unknown>)[part] : undefined), data);

/** "%18'inde": Türkçe ek sayının okunuşuna bağlı, son basamak (yoksa onlar) belirler. */
const ONES: Record<number, string> = { 1: "inde", 2: "sinde", 3: "ünde", 4: "ünde", 5: "inde", 6: "sında", 7: "sinde", 8: "inde", 9: "unda" };
const TENS: Record<number, string> = { 1: "unda", 2: "sinde", 3: "unda", 4: "ında", 5: "sinde", 6: "ında", 7: "inde", 8: "inde", 9: "ında" };
export const percentIn = (value: number): string => {
  const whole = Math.round(value);
  const suffix = whole === 0 ? "ında" : whole % 100 === 0 ? "ünde" : whole % 10 === 0 ? TENS[(whole / 10) % 10] : ONES[whole % 10];
  return `%${whole}'${suffix}`;
};

const FORMATS: Record<Exclude<FactFormat, "text">, (value: number) => string> = {
  prob: (value) => `%${Math.round(value * 100)}`,
  pct: (value) => `%${Math.round(value)}`,
  pctIn: percentIn,
  int: (value) => formatInt(Math.round(value)),
  dec1: (value) => formatDecimal(value, 1),
  dec2: (value) => formatDecimal(value, 2),
};

const SLOT = /\{(\w+)\}/gu;

/** Yuva adı dışında rakam var mı. */
export const hasDigit = (template: string): boolean => /\d/u.test(template.replace(SLOT, ""));

export const slotsOf = (template: string): string[] => [...template.matchAll(SLOT)].map((match) => match[1] ?? "").sort();

/** LLM şablonu ancak yuvaları birebir aynıysa ve rakam içermiyorsa kullanılır. */
export const polishUsable = (polished: string, template: string): boolean =>
  !hasDigit(polished) && JSON.stringify(slotsOf(polished)) === JSON.stringify(slotsOf(template));

export function claim(data: MatchData, id: string, template: string, facts: Record<string, Fact>): Reason | null {
  if (hasDigit(template)) throw new Error(`Şablonda rakam olamaz: ${id}`);
  const missing = slotsOf(template).filter((slot) => !(slot in facts));
  if (missing.length) throw new Error(`Şablonda tanımsız yuva: ${id} ${missing.join(",")}`);
  const sources: string[] = [];
  const figures: string[] = [];
  const shown: Record<string, string> = {};
  for (const [slot, fact] of Object.entries(facts)) {
    if ("label" in fact) {
      shown[slot] = fact.label;
      if (/\d/u.test(fact.label)) figures.push(fact.label);
      continue;
    }
    if ("key" in fact) {
      const value = valueAt(data, fact.key);
      if (fact.format === "text") {
        if (typeof value !== "string") return null;
        shown[slot] = value;
      } else {
        if (typeof value !== "number" || !Number.isFinite(value)) return null;
        shown[slot] = FORMATS[fact.format](value);
        figures.push(shown[slot] ?? "");
      }
      sources.push(fact.key);
      continue;
    }
    const values = fact.keys.map((key) => valueAt(data, key));
    if (values.some((value) => typeof value !== "number")) return null;
    const numbers = values as number[];
    const total = fact.op === "sum" ? numbers.reduce((sum, value) => sum + value, 0) : Math.abs((numbers[0] ?? 0) - (numbers[1] ?? 0));
    shown[slot] = FORMATS[fact.format](total);
    figures.push(shown[slot] ?? "");
    sources.push(...fact.keys);
  }
  const polished = data.context?.polished?.[id];
  const chosen = polished && polishUsable(polished, template) ? polished : template;
  return { id, template, text: chosen.replace(SLOT, (_, slot: string) => shown[slot] ?? ""), sources, figures };
}

export const claims = (items: readonly (Reason | null)[]): Reason[] => items.flatMap((item) => (item ? [item] : []));

/** Takım adı kısayolu. */
export const TEAM = { home: { key: "teams.home.short_name", format: "text" }, away: { key: "teams.away.short_name", format: "text" } } as const;
