/**
 * Kart tarih/saat yazımı — TEK KURAL (saf, İstanbul saati). Bütün kartlar buradan okur:
 *   künye      "30.10.2026"     `fullDate`
 *   kısa       "30.10"          `shortDate`
 *   saat       "20:00"          `clock`
 *   gün başlığı "30 EKİM CUMA"  `dayHeading`
 * Parçalardan kurulur: Node/ICU `tr-TR` gün+ay biçiminde "30/10" verir, saat ayracı sürüme göre değişebilir.
 * Girdi ISO anı ya da "yyyy-MM-dd" gün anahtarı (o günün öğleni — saat dilimi günü kaydırmaz).
 */

const TZ = "Europe/Istanbul";
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const numeric = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const words = new Intl.DateTimeFormat("tr-TR", { timeZone: TZ, day: "numeric", month: "long", weekday: "long" });

const toDate = (input: string | Date) => (input instanceof Date ? input : new Date(DATE_KEY.test(input) ? `${input}T12:00:00Z` : input));

function parts(format: Intl.DateTimeFormat, input: string | Date): Partial<Record<Intl.DateTimeFormatPartTypes, string>> {
  return Object.fromEntries(format.formatToParts(toDate(input)).map((part) => [part.type, part.value]));
}

export function fullDate(input: string | Date): string {
  const p = parts(numeric, input);
  return `${p.day}.${p.month}.${p.year}`;
}

export function shortDate(input: string | Date): string {
  const p = parts(numeric, input);
  return `${p.day}.${p.month}`;
}

export function clock(input: string | Date): string {
  const p = parts(numeric, input);
  return `${p.hour}:${p.minute}`;
}

export function dayHeading(input: string | Date): string {
  const p = parts(words, input);
  return `${p.day} ${p.month} ${p.weekday}`.toLocaleUpperCase("tr-TR");
}

/** Elle/formdan gelen saat metni: "20.00" / "20:00" / "9:05" → "20:00", "09:05"; saat değilse olduğu gibi. */
export function normalizeClock(text: string): string {
  const match = /^\s*(\d{1,2})[.:](\d{2})\s*$/u.exec(text);
  return match ? `${match[1]!.padStart(2, "0")}:${match[2]}` : text;
}
