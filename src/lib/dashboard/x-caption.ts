import { BRAND_TAG } from "@/lib/dashboard/caption-hashtags";
import { captionLength } from "@/lib/dashboard/publish-caption";
import { PUBLISH_PLATFORM_DEFS, type PublishPlatform } from "@/types/publishing";

/**
 * Kural tabanlı X sürümü (2026-10-31, canlı test: X metni AI'ya bağlıydı, şablon 280'i aşıyordu). Yapay zekâ
 * YOK — kaydın şablon (Instagram) metninden görüntüleme anında türetilir; böylece eski kayıtlarda da, admin'in
 * düzenlediği metinde de çalışır, kayıt şeması değişmez. AI uyarlaması Yayın Merkezi'nde isteğe bağlı düğmedir.
 * Öncelik (sığana kadar sırayla feda edilir; başlık — skor/ana olgu — asla düşmez, sözcük ortadan kesilmez):
 * 1. etkileşim sorusu, 2. açıklama cümleleri (gerekçe, kanca, not — "Tamamı görselde."), 3. uzun liste satırları
 * ayraçtan ("A, B, …" / " · …") eşit sınıra kısalır, 4. sondan satır düşer (altı kalmamış ara başlık da), 5. hashtag
 * 3 → 2, 6. başlık sözcük sınırından.
 * Hashtag: şablonun ilk iki etiketi + #CheckMatch (X önerisi 2–3). Uzunluk `captionLength` (emoji 2 sayılır).
 */

export const X_LIMIT = PUBLISH_PLATFORM_DEFS.X.captionLimit;
export const MORE_LINE = "Tamamı görselde.";
const MIN_CAP = 70;
const TAG = /#[\p{L}\p{N}_]+/gu;
const TAG_LINE = /^\s*(#[\p{L}\p{N}_]+\s*)+$/u;
const QUESTION = /👇\s*$/u;
const SEPARATORS = [", ", " · "];

const xLength = (text: string): number => captionLength(text, "X");

/** Biçim düzeltmesi (eski kayıtlar için de): "?:" → "?", iki nokta sonrası boşluk (saat/oran hariç), çift boşluk, noktalamadan önce boşluk. */
export function tidyCaption(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/\?:/gu, "?")
        // "19:00" / "2:1" (rakam:rakam) ve "https://" olduğu gibi kalır.
        .replace(/:(?=[^\s/])/gu, (colon: string, at: number, whole: string) => (/\d/u.test(whole[at - 1] ?? "") && /\d/u.test(whole[at + 1] ?? "") ? colon : ": "))
        .replace(/(?<=\S) {2,}/gu, " ")
        .replace(/(?<=\S) +(?=[,.;:!?](?:\s|$))/gu, "")
        .trimEnd(),
    )
    .join("\n");
}

/** Liste satırını ayraçtan kısaltır ("A, B, …"); ayraç yoksa sözcük sınırından ("…"). Sözcük ortadan kesilmez. */
export function shortenLine(line: string, cap: number): string {
  if (xLength(line) <= cap) return line;
  for (const separator of SEPARATORS) {
    let cut = line.lastIndexOf(separator);
    while (cut > 0) {
      const candidate = `${line.slice(0, cut)}${separator}…`;
      if (xLength(candidate) <= cap) return candidate;
      cut = line.lastIndexOf(separator, cut - 1);
    }
  }
  const words = line.split(" ");
  while (words.length > 1 && xLength(`${words.join(" ")}…`) > cap) words.pop();
  return `${words.join(" ")}…`;
}

interface BodyLine {
  text: string;
  block: number;
}

const isUpper = (text: string): boolean => /\p{L}/u.test(text) && text === text.toLocaleUpperCase("tr-TR");

/** Ara başlık: büyük harf satır ("31 EKİM CUMARTESİ"), ":" ile biten satır ya da aynı paragrafta ara başlığın üstündeki satır. */
function isHeader(lines: BodyLine[], index: number): boolean {
  const line = lines[index];
  if (!line) return false;
  // Maç / tablo satırı ("PSG - LASK", "1. PSG — 25 P (…)") büyük harfli olsa da başlık değildir.
  if (/ [-–—] |\(/u.test(line.text)) return false;
  if (isUpper(line.text) || line.text.trimEnd().endsWith(":")) return true;
  const next = lines[index + 1];
  return next !== undefined && next.block === line.block && isHeader(lines, index + 1);
}

/** İlk `count` satır; sonda altı kalmamış ara başlık bırakmaz (başlık mı diye bütün listeye bakılır). */
function keepFirst(lines: BodyLine[], count: number): BodyLine[] {
  let kept = count;
  while (kept > 0 && isHeader(lines, kept - 1)) kept -= 1;
  return lines.slice(0, kept);
}

/** X etiketleri: ilk iki özel etiket + marka (yoksa yalnızca marka). */
export function xHashtags(tags: string[], count: 2 | 3 = 3): string[] {
  const specific = [...new Set(tags)].filter((tag) => tag !== BRAND_TAG);
  return [...specific.slice(0, count - 1), BRAND_TAG];
}

const compose = (title: string, lines: string[], tags: string[]) => [title, ...lines, tags.join(" ")].filter((line) => line.length > 0).join("\n");

/** Şablon metninden ≤ 280 karakterlik X sürümü. */
export function xCaptionFrom(caption: string): string {
  const raw = tidyCaption(caption).split("\n");
  const tags = raw.filter((line) => TAG_LINE.test(line)).flatMap((line) => line.match(TAG) ?? []);
  const content = raw.filter((line) => !TAG_LINE.test(line));
  let block = 0;
  const all: BodyLine[] = [];
  for (const text of content) {
    if (text.trim() === "") block += 1;
    else all.push({ text: text.trim(), block });
  }
  const [first, ...rest] = all;
  if (!first) return BRAND_TAG;
  const title = first.text;
  const question = rest.filter((line) => QUESTION.test(line.text)).map((line) => line.text);
  const body = rest.filter((line) => !QUESTION.test(line.text));
  // Açıklama cümlesi (paragrafın ilk satırı değil, harfle başlayıp noktayla biter: Vitrin gerekçesi, kanca, karne notu) satırlardan önce feda edilir.
  const prose = (line: BodyLine, index: number) => body[index - 1]?.block === line.block && /^\p{L}/u.test(line.text) && line.text.endsWith(".");
  const core = body.filter((line, index) => !prose(line, index));
  const texts = (lines: BodyLine[], cap = Infinity) => lines.map((line) => shortenLine(line.text, cap));
  const fits = (text: string) => xLength(text) <= X_LIMIT;
  const full = xHashtags(tags, 3);
  const more = core.length < body.length ? [MORE_LINE] : [];

  const whole = [compose(title, [...texts(body), ...question], full), compose(title, texts(body), full), compose(title, [...texts(core), ...more], full)];
  for (const candidate of whole) if (fits(candidate)) return candidate;
  // Uzun liste satırları eşit sınıra kısalır (Muhtemel 11'in iki dizilişi dengeli kalır).
  const longest = Math.max(0, ...core.map((line) => xLength(line.text)));
  for (let cap = longest - 5; cap >= MIN_CAP; cap -= 5) {
    const candidate = compose(title, [...texts(core, cap), ...more], full);
    if (fits(candidate)) return candidate;
  }
  // Sondan satır düşer: önce en çok satır, satır içinde en az kısaltma.
  for (const tagSet of [full, xHashtags(tags, 2)]) {
    for (let count = core.length - 1; count >= 0; count -= 1) {
      const kept = keepFirst(core, count);
      for (const cap of [Infinity, 120, 100, 85, MIN_CAP]) {
        const candidate = compose(title, [...texts(kept, cap), MORE_LINE], tagSet);
        if (fits(candidate)) return candidate;
      }
    }
  }
  return compose(shortenLine(title, X_LIMIT - xLength(BRAND_TAG) - 1), [], [BRAND_TAG]);
}

/** Yayın Merkezi'nin platform başlangıç metni (AI yok): X → kural tabanlı ≤280 sürüm, diğerleri biçimi düzeltilmiş şablon. */
export function templateCaption(caption: string, platform: PublishPlatform): string {
  return platform === "X" ? xCaptionFrom(caption) : tidyCaption(caption);
}
