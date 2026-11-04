/** Seslendirme: rakamlar yazıyla. Saf; ekran metnindeki biçimlerin okunuş karşılığı. */

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"] as const;
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"] as const;

function underThousand(value: number): string[] {
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return [
    ...(hundreds === 0 ? [] : hundreds === 1 ? ["yüz"] : [ONES[hundreds] ?? "", "yüz"]),
    ...(Math.floor(rest / 10) ? [TENS[Math.floor(rest / 10)] ?? ""] : []),
    ...(rest % 10 ? [ONES[rest % 10] ?? ""] : []),
  ];
}

/** 500000 → "beş yüz bin", 1000 → "bin", -8 → "eksi sekiz". */
export function numberWords(value: number): string {
  const whole = Math.round(Math.abs(value));
  if (whole === 0) return "sıfır";
  const thousands = Math.floor(whole / 1000);
  const words = [...(thousands === 0 ? [] : thousands === 1 ? ["bin"] : [...underThousand(thousands), "bin"]), ...underThousand(whole % 1000)];
  return `${value < 0 ? "eksi " : ""}${words.join(" ")}`;
}

const LOCATIVE: Record<string, string> = { sıfır: "sıfırında", bir: "birinde", iki: "ikisinde", üç: "üçünde", dört: "dördünde", beş: "beşinde", altı: "altısında", yedi: "yedisinde", sekiz: "sekizinde", dokuz: "dokuzunda", on: "onunda", yirmi: "yirmisinde", otuz: "otuzunda", kırk: "kırkında", elli: "ellisinde", altmış: "altmışında", yetmiş: "yetmişinde", seksen: "sekseninde", doksan: "doksanında", yüz: "yüzünde" };
const ORDINAL: Record<string, string> = { sıfır: "sıfırıncı", bir: "birinci", iki: "ikinci", üç: "üçüncü", dört: "dördüncü", beş: "beşinci", altı: "altıncı", yedi: "yedinci", sekiz: "sekizinci", dokuz: "dokuzuncu", on: "onuncu", yirmi: "yirminci", otuz: "otuzuncu", kırk: "kırkıncı", elli: "ellinci", altmış: "altmışıncı", yetmiş: "yetmişinci", seksen: "sekseninci", doksan: "doksanıncı", yüz: "yüzüncü" };

const lastWord = (words: string, table: Record<string, string>): string => {
  const parts = words.split(" ");
  const last = parts.pop() ?? "";
  return [...parts, table[last] ?? last].join(" ");
};

export const percentWords = (value: number): string => `yüzde ${numberWords(value)}`;
/** 18 → "yüzde on sekizinde". */
export const percentInWords = (value: number): string => `yüzde ${lastWord(numberWords(value), LOCATIVE)}`;
/** 3 → "üçüncü". */
export const ordinalWords = (value: number): string => lastWord(numberWords(value), ORDINAL);
/** 1.8 → "bir virgül sekiz", 2.0 → "iki". */
export function decimalWords(value: number, digits = 1): string {
  const [whole = "0", part = ""] = Math.abs(value).toFixed(digits).split(".");
  const tail = /^0*$/u.test(part) ? "" : ` virgül ${numberWords(Number(part))}`;
  return `${value < 0 ? "eksi " : ""}${numberWords(Number(whole))}${tail}`;
}
/** "4-2-3-1" → "dört iki üç bir". */
export const formationWords = (name: string): string => name.split("-").map((part) => numberWords(Number(part))).join(" ");
/** "76–90+" → "yetmiş altı ile doksan". */
export const slotWords = (slot: string): string => slot.replace(/\+/gu, "").split("–").map((part) => numberWords(Number(part))).join(" ile ");

/** Konuşma hızı: dakikada ~180 sözcük. Gerçek sesle henüz ölçülmedi. */
export const WORDS_PER_SECOND = 3;
export const wordCount = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;
