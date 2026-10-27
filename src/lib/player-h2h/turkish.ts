/**
 * Kart metinleri için Türkçe ekler — saf. Özel adlara gelen ek kesme işaretiyle ayrılır, ünlü uyumu
 * adın SON ÜNLÜSÜNE göre (yabancı harfler aksansız hâliyle okunur: "Vlahović" → "i" → "Vlahović'in").
 */

const VOWELS = "aeıioöuü";

/** Aksanları atar ama Türkçe ünlüleri korur (ö ü ı); küçük harf. */
function plain(word: string): string {
  return [...word.toLocaleLowerCase("tr-TR")]
    .map((char) => (VOWELS.includes(char) || /[çğş]/u.test(char) ? char : char.normalize("NFD").replace(/[̀-ͯ]/gu, "")))
    .join("");
}

function lastVowel(word: string): string | null {
  const letters = plain(word);
  for (let i = letters.length - 1; i >= 0; i -= 1) {
    const char = letters[i] ?? "";
    if (VOWELS.includes(char)) return char;
  }
  return null;
}

/** Dört biçimli ünlü uyumu: a ı → ı · e i → i · o u → u · ö ü → ü. */
function harmony4(vowel: string | null): "ı" | "i" | "u" | "ü" {
  if (vowel === "a" || vowel === "ı") return "ı";
  if (vowel === "o" || vowel === "u") return "u";
  if (vowel === "ö" || vowel === "ü") return "ü";
  return "i";
}

/** İlgi eki: "Salah" → "Salah'ın", "Vlahović" → "Vlahović'in", "Icardi" → "Icardi'nin". */
export function genitive(name: string): string {
  const trimmed = name.trim();
  const end = plain(trimmed).slice(-1);
  const vowel = harmony4(lastVowel(trimmed));
  return `${trimmed}'${VOWELS.includes(end) ? "n" : ""}${vowel}n`;
}

const UNITS: Record<number, string> = { 0: "ı", 1: "i", 2: "si", 3: "ü", 4: "ü", 5: "i", 6: "sı", 7: "si", 8: "i", 9: "u" };
const TENS: Record<number, string> = { 1: "u", 2: "si", 3: "u", 4: "ı", 5: "si", 6: "ı", 7: "i", 8: "i", 9: "ı" };

/** Sayıya gelen 3. tekil iyelik eki: 1'i, 2'si, 3'ü, 6'sı, 10'u, 40'ı, 100'ü — son okunan sözcüğe göre. */
export function numberPossessive(value: number): string {
  const n = Math.abs(Math.trunc(value));
  let suffix: string;
  if (n === 0 || n % 10 !== 0) suffix = UNITS[n % 10] ?? "i";
  else if (n % 100 !== 0) suffix = TENS[(n / 10) % 10] ?? "u";
  else if (n % 1000 !== 0) suffix = "ü"; // yüz
  else suffix = "i"; // bin
  return `${n}'${suffix}`;
}
