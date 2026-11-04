import { formatDecimal, formatInt } from "../lib/motion";
import type { MatchData } from "./match-data";
import { decimalWords, formationWords, numberWords, ordinalWords, percentInWords, percentWords } from "./speech";

/**
 * Yorum cümlesi: şablon + veri anahtarları. Şablonda rakam yazılamaz; her rakam `MatchData` içinden anahtarla okunur ve kodla
 * eklenir, bu yüzden uydurulamaz. Anahtarın değeri yoksa cümle kurulmaz. Test: `tests/analysis.test.ts`.
 */

export type FactFormat = "prob" | "pct" | "pctIn" | "int" | "ordinal" | "dec1" | "dec2" | "text" | "formation";
type NumberFormat = Exclude<FactFormat, "text" | "formation">;

export type Fact =
  | { key: string; format: FactFormat }
  | { keys: readonly string[]; op: "sum" | "diff"; format: Exclude<NumberFormat, "prob" | "pctIn"> }
  /** Veriden hesaplanmış sayı (dizi uzunluğu, seçilen değer); kaynak anahtarları ayrıca yazılır. */
  | { computed: number; from: readonly string[]; format: NumberFormat }
  /** Sabit etiket (dilim adı gibi). Takım adı değil: ad da anahtardan okunur. `spoken`: seslendirmedeki okunuşu. */
  | { label: string; spoken?: string };

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

const FORMATS: Record<NumberFormat, (value: number) => string> = {
  prob: (value) => `%${Math.round(value * 100)}`,
  pct: (value) => `%${Math.round(value)}`,
  pctIn: percentIn,
  int: (value) => formatInt(Math.round(value)),
  ordinal: (value) => `${Math.round(value)}.`,
  dec1: (value) => formatDecimal(value, 1),
  dec2: (value) => formatDecimal(value, 2),
};

const SPOKEN: Record<NumberFormat, (value: number) => string> = {
  prob: (value) => percentWords(Math.round(value * 100)),
  pct: (value) => percentWords(Math.round(value)),
  pctIn: (value) => percentInWords(Math.round(value)),
  int: numberWords,
  ordinal: (value) => ordinalWords(Math.round(value)),
  dec1: (value) => decimalWords(value, 1),
  dec2: (value) => decimalWords(value, 2),
};

const SLOT = /\{(\w+)\}/gu;

/** Yuva adı dışında rakam var mı. */
export const hasDigit = (template: string): boolean => /\d/u.test(template.replace(SLOT, ""));

export const slotsOf = (template: string): string[] => [...template.matchAll(SLOT)].map((match) => match[1] ?? "").sort();

/** LLM şablonu ancak yuvaları birebir aynıysa ve rakam içermiyorsa kullanılır. */
export const polishUsable = (polished: string, template: string): boolean =>
  !hasDigit(polished) && JSON.stringify(slotsOf(polished)) === JSON.stringify(slotsOf(template));

function fill(data: MatchData, id: string, template: string, facts: Record<string, Fact>, numbers: Record<NumberFormat, (value: number) => string>, spoken: boolean): { shown: Record<string, string>; sources: string[]; figures: string[] } | null {
  if (hasDigit(template)) throw new Error(`Şablonda rakam olamaz: ${id}`);
  const missing = slotsOf(template).filter((slot) => !(slot in facts));
  if (missing.length) throw new Error(`Şablonda tanımsız yuva: ${id} ${missing.join(",")}`);
  const sources: string[] = [];
  const figures: string[] = [];
  const shown: Record<string, string> = {};
  for (const [slot, fact] of Object.entries(facts)) {
    if ("label" in fact) {
      shown[slot] = spoken ? (fact.spoken ?? fact.label) : fact.label;
      if (/\d/u.test(shown[slot] ?? "")) figures.push(shown[slot] ?? "");
      continue;
    }
    if ("computed" in fact) {
      if (!Number.isFinite(fact.computed)) return null;
      shown[slot] = numbers[fact.format](fact.computed);
      figures.push(shown[slot] ?? "");
      sources.push(...fact.from);
      continue;
    }
    if ("key" in fact) {
      const value = valueAt(data, fact.key);
      if (fact.format === "text" || fact.format === "formation") {
        if (typeof value !== "string") return null;
        shown[slot] = fact.format === "formation" && spoken ? formationWords(value) : value;
      } else {
        if (typeof value !== "number" || !Number.isFinite(value)) return null;
        shown[slot] = numbers[fact.format](value);
        figures.push(shown[slot] ?? "");
      }
      sources.push(fact.key);
      continue;
    }
    const values = fact.keys.map((key) => valueAt(data, key));
    if (values.some((value) => typeof value !== "number")) return null;
    const list = values as number[];
    const total = fact.op === "sum" ? list.reduce((sum, value) => sum + value, 0) : Math.abs((list[0] ?? 0) - (list[1] ?? 0));
    shown[slot] = numbers[fact.format](total);
    figures.push(shown[slot] ?? "");
    sources.push(...fact.keys);
  }
  return { shown, sources, figures };
}

export function claim(data: MatchData, id: string, template: string, facts: Record<string, Fact>): Reason | null {
  const filled = fill(data, id, template, facts, FORMATS, false);
  if (!filled) return null;
  const polished = data.context?.polished?.[id];
  const chosen = polished && polishUsable(polished, template) ? polished : template;
  return { id, template, text: chosen.replace(SLOT, (_, slot: string) => filled.shown[slot] ?? ""), sources: filled.sources, figures: filled.figures };
}

export interface VoiceLine { id: string; template: string; text: string; sources: string[] }
export interface Voiceover { text: string; lines: VoiceLine[] }

/** Seslendirme cümlesi: `claim` ile aynı kural, rakamlar yazıyla. LLM `vo.` kimliğiyle doğallaştırabilir. */
export function say(data: MatchData, id: string, template: string, facts: Record<string, Fact> = {}, from: readonly string[] = []): VoiceLine | null {
  const voiceId = `vo.${id}`;
  const filled = fill(data, voiceId, template, facts, SPOKEN, true);
  if (!filled) return null;
  const sources = [...new Set([...filled.sources, ...from])];
  if (!sources.length) throw new Error(`Seslendirme kaynaksız: ${id}`);
  const polished = data.context?.polished?.[voiceId];
  const chosen = polished && polishUsable(polished, template) ? polished : template;
  return { id: voiceId, template, text: chosen.replace(SLOT, (_, slot: string) => filled.shown[slot] ?? ""), sources };
}

export const voiceOf = (items: readonly (VoiceLine | null)[]): Voiceover | null => {
  const lines = items.flatMap((item) => (item ? [item] : []));
  return lines.length ? { text: lines.map((line) => line.text).join(" "), lines } : null;
};

/** Analist notunun ekranda kalan kısmı: ilk cümle sığıyorsa o, sığmıyorsa sözcük sınırında kesilir. Tam hali sese ve açıklamaya gider. */
export const NOTE_SCREEN_CHARS = 84;
export function noteForScreen(note: string): string {
  const clean = note.trim();
  if (clean.length <= NOTE_SCREEN_CHARS) return clean;
  const first = clean.match(/^.+?[.!?](?=\s|$)/u)?.[0];
  if (first && first.length <= NOTE_SCREEN_CHARS) return first;
  const cut = clean.slice(0, NOTE_SCREEN_CHARS - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).trimEnd()}…`;
}
export const noteLine = (note: string): VoiceLine => ({ id: "vo.analyst.note", template: "{note}", text: note.trim(), sources: ["analyst_note"] });

export const claims = (items: readonly (Reason | null)[]): Reason[] => items.flatMap((item) => (item ? [item] : []));

/** Takım adı kısayolu. */
export const TEAM = { home: { key: "teams.home.short_name", format: "text" }, away: { key: "teams.away.short_name", format: "text" } } as const;
