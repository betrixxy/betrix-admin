import { nameOrigin, originFromCountry, type NameOrigin } from "@/lib/dashboard/name-case";
import type { CardPersonName, SportmonksPerson } from "@/types/person-name";

/**
 * Kişi kart adı — TEK KAYNAK (saf), BÜTÜN kartlar (2026-10-30). Resmi tam ad (API ya da Sportmonks
 * firstname + lastname) kartta YAZILMAZ. Öncelik: arşivdeki admin düzeltmesi (`nameOverride`) → Sportmonks
 * yaygın adı (oyuncu eşleşmesiyle: "Vinícius Júnior", "Uğurcan Çakır") → API kısa adından soyad
 * ("S. Mbangula" → "Mbangula"; eşleşen ama yaygın adsız Sportmonks kaydı harfleri geri yükler: "U. Cakir" →
 * "Çakır"). Posterde ilk ad küçük + soyad büyük yalnızca güvenilir yaygın ad varsa (`posterName`); yoksa
 * yalnızca soyad. Büyük harf kökeni: adın kendi harfi → uyruk → takım ipucu (Nijeryalı forvet "OSIMHEN").
 */

/** Karşılaştırma anahtarı: aksan/Türkçe harf farkı yok sayılır ("Çakır" = "cakir", "Sánchez" = "sanchez"); ayrışmayan harfler de ("Jørgensen" = "jorgensen", "Łukasz" = "lukasz"). */
export function foldName(value: string): string {
  return value
    .replace(/[ıİ]/gu, "i")
    .replace(/[øØ]/gu, "o")
    .replace(/[łŁ]/gu, "l")
    .replace(/[đĐ]/gu, "d")
    .replace(/ß/gu, "ss")
    .replace(/[æÆ]/gu, "ae")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/gu, "")
    .trim();
}

const INITIAL = /^(\p{L})\.$/u;

/** "A.Yüzgeç" gibi bitişik baş harfi ayırır; sözcükler boşlukla. */
const tokens = (name: string) => name.replace(/(\p{L})\.(?=\p{L})/gu, "$1. ").split(/\s+/u).filter(Boolean);
const words = (value: string | null) => (value ?? "").split(/[\s-]+/u).filter(Boolean);

/** Soyada dahil ekler ("van Dijk") ve soyadı tek başına bırakmayan sonekler ("Vinícius Júnior"). */
const PARTICLES = new Set(["van", "von", "der", "den", "de", "da", "di", "del", "della", "dos", "das", "do", "du", "el", "al", "le", "la", "ter", "ten", "mac", "mc"]);
const SUFFIXES = new Set(["junior", "jr", "jr.", "filho", "neto", "sobrinho", "ii", "iii"]);

/**
 * Soyadı (+ önündeki ekler, + sonek): "Virgil van Dijk" → "van Dijk", "Mohamed Salah" → "Salah", "Vinícius
 * Júnior" → olduğu gibi. Büyük harfli adda da çalışır (katlanmış karşılaştırma: "DI" → "di", "ı" değil).
 * `firstWords`: ekler soyada katılırken önde ilk ad olarak bırakılan en az sözcük.
 */
export function shortNameOf(fullName: string, firstWords = 1): string {
  const all = fullName.trim().split(/\s+/u);
  if (all.length <= 1) return fullName.trim();
  let start = all.length - 1;
  if (SUFFIXES.has(foldName(all[start] ?? ""))) start -= 1;
  while (start > firstWords && PARTICLES.has(foldName(all[start - 1] ?? ""))) start -= 1;
  return all.slice(start).join(" ");
}

/** Büyük adın üstündeki küçük ilk ad (kısa ad dışında kalan). */
export function firstNameOf(fullName: string): string {
  const short = shortNameOf(fullName);
  return fullName.trim().slice(0, fullName.trim().length - short.length).trim();
}

/** Adda baş harf var mı ("S. Mbangula", "A.Yüzgeç") — baş harfli ad güvenilir yaygın ad sayılmaz. */
export const hasInitial = (name: string) => tokens(name).some((token) => INITIAL.test(token));

/** API kısa adından soyad: baş harfler atılır, sonra `shortNameOf` ("S. Mbangula" → "Mbangula", "Gabriel" → "Gabriel"). */
export function surnameOf(apiName: string): string {
  const named = tokens(apiName).filter((token) => !INITIAL.test(token));
  // Baş harf atılınca önde ilk ad kalmayabilir: ekler başa kadar soyada dahil ("D. Van der Westhuizen").
  const firstWords = named.length < tokens(apiName).length ? 0 : 1;
  return named.length > 0 ? shortNameOf(named.join(" "), firstWords) : apiName.trim();
}

/**
 * KISA ad: baş harf + soyad, harfler olduğu gibi ("Uğurcan Çakır" → "U. Çakır", "S. Mbangula" → aynı,
 * "A. Hernández de la Fuente" → "A. de la Fuente"); soyad adın tamamıysa yalnız soyad ("Vinícius Júnior",
 * "Gabriel", "Mbangula").
 */
export function shortForm(name: string): string {
  const all = tokens(name);
  const surname = surnameOf(name);
  const surnameWords = surname.split(/\s+/u).length;
  const first = all[0];
  if (!first || all.length <= surnameWords) return surname;
  const letter = INITIAL.exec(first)?.[1] ?? [...first][0] ?? "";
  return `${letter}. ${surname}`;
}

/** Poster adı: güvenilir yaygın adda ilk ad küçük + soyad büyük; değilse yalnızca soyad (ilk ad boş). */
export function posterName(name: string, reliable: boolean): { firstName: string; lastName: string } {
  const lastName = shortNameOf(name);
  if (!reliable) return { firstName: "", lastName };
  const firstName = firstNameOf(name);
  return { firstName: hasInitial(firstName) ? "" : firstName, lastName };
}

/** Baş harfin karşılığı: resmi ilk adın ve kullanılan adın İLK sözcüğü ("Barış Alper" → yalnızca Barış; "Murat Eyüp" + "Eyüp Aydın" → Murat, Eyüp). */
function givenWords(person: SportmonksPerson): string[] {
  return [words(person.firstname)[0], words(person.displayName)[0]].filter((word): word is string => Boolean(word));
}

function personWords(person: SportmonksPerson): string[] {
  return [...words(person.lastname), ...words(person.displayName), ...words(person.firstname)];
}

function matches(apiName: string, person: SportmonksPerson): boolean {
  const all = new Set(personWords(person).map(foldName));
  const given = givenWords(person).map((word) => foldName(word).charAt(0));
  let named = 0;
  for (const token of tokens(apiName)) {
    const initial = INITIAL.exec(token);
    if (initial) {
      if (!given.includes(foldName(initial[1] ?? ""))) return false;
    } else {
      // Tireli soyad ("Wan-Bissaka") Sportmonks sözcükleri gibi parça parça aranır.
      if (!words(token).every((part) => all.has(foldName(part)))) return false;
      named += 1;
    }
  }
  return named > 0;
}

/** API adına uyan tek Sportmonks kişisi; birden çok aday varsa forma numarası ayırır, yine belirsizse null. */
export function matchPerson(apiName: string, people: readonly SportmonksPerson[], jersey: number | null = null): SportmonksPerson | null {
  const found = people.filter((person) => matches(apiName, person));
  if (found.length <= 1) return found[0] ?? null;
  const byJersey = jersey === null ? [] : found.filter((person) => person.jersey === jersey);
  return byJersey.length === 1 ? byJersey[0]! : null;
}

/** API adının biçimiyle, harfleri Sportmonks adından: sözcük sözcük katlanmış eşi aranır, yoksa API sözcüğü kalır. */
export function restoreName(apiName: string, person: SportmonksPerson): string {
  const pool = personWords(person);
  const given = givenWords(person);
  return tokens(apiName)
    .map((token) => {
      const initial = INITIAL.exec(token);
      if (initial) {
        const word = given.find((w) => foldName(w).charAt(0) === foldName(initial[1] ?? ""));
        return word ? `${[...word][0]}.` : token;
      }
      // Aynı katlanmış sözcüğün birden çok yazımı varsa (Sportmonks soyadı alanı bazen ASCII: "Ibrahimoglu" /
      // görünen ad "İbrahimoğlu") Türkçe/aksanlı yazım kazanır. Tireli sözcük parça parça ("Kouyate-Diakhaby").
      return token
        .split("-")
        .map((part) => {
          const same = pool.filter((word) => foldName(word) === foldName(part));
          return same.find((word) => !isAsciiName(word)) ?? same[0] ?? part;
        })
        .join("-");
    })
    .join(" ");
}

/** Büyük harf kökeni: adın kendi işareti → uyruk → takım ipucu. */
export function personOrigin(name: string, nationality: string | null, hint: NameOrigin | null): NameOrigin | null {
  return nameOrigin(name) ?? originFromCountry(nationality) ?? hint;
}

export interface CardPersonNameInput {
  apiName: string;
  /** Arşivdeki Person düzeltmesi (`nameOverride`) — her zaman kazanır. */
  override?: string | null | undefined;
  /** Takımın Sportmonks kadrosu ya da koç adayları; yoksa boş. */
  people?: readonly SportmonksPerson[] | undefined;
  jersey?: number | null | undefined;
  /** Uyruk bulunamazsa takımın kişi kökeni (bkz. `team-origin.ts`). */
  teamHint?: NameOrigin | null | undefined;
}

export function cardPersonName(input: CardPersonNameInput): CardPersonName {
  const hint = input.teamHint ?? null;
  const person = matchPerson(input.apiName, input.people ?? [], input.jersey ?? null);
  const override = input.override?.trim();
  if (override) return { name: override, short: shortForm(override), origin: personOrigin(override, person?.nationality ?? null, hint), source: "override", reliable: !hasInitial(override) };
  const common = person?.displayName?.trim();
  if (person && common && !hasInitial(common)) return { name: common, short: shortForm(common), origin: personOrigin(common, person.nationality, hint), source: "sportmonks", reliable: true };
  // Yaygın ad yok (ya da baş harfli: "S. Mbangula"): uzun = API kısa adından soyad, kısa = API baş harfi + soyad;
  // eşleşen kayıt yalnızca harfleri geri yükler ("U. Cakir" → "U. Çakır").
  const restore = (value: string) => (person ? restoreName(value, person) : value);
  const name = restore(surnameOf(input.apiName));
  return { name, short: restore(shortForm(input.apiName)), origin: personOrigin(name, person?.nationality ?? null, hint), source: "api", reliable: false };
}

/** Kart adı istenen kişi: API kimliği (düzeltme anahtarı), API adı, forma numarası. */
export interface PersonEntry {
  apiId: number | null;
  apiName: string;
  jersey?: number | null;
}

/** Takım kaynakları: Sportmonks kadrosu / koç adayları, arşiv düzeltmeleri (API kimliği → ad), kişi kökeni ipucu. */
export interface TeamPeople {
  people: readonly SportmonksPerson[];
  overrides: ReadonlyMap<number, string>;
  teamHint: NameOrigin | null;
}

/** Takımın oyuncu adları (girişle aynı sırada) — sunucu (`person-directory.ts`) ve görsel testler aynı yoldan. */
export function cardPlayerNames(entries: readonly PersonEntry[], team: TeamPeople): CardPersonName[] {
  return entries.map((entry) => cardPersonName({ apiName: entry.apiName, override: entry.apiId === null ? null : team.overrides.get(entry.apiId), people: team.people, jersey: entry.jersey ?? null, teamHint: team.teamHint }));
}

/** Teknik direktör adı: adaylardan yalnızca ilki (takımı çalıştırmış olan öne sıralı, `coachPeople`). */
export function cardCoachName(coach: PersonEntry, team: TeamPeople): CardPersonName {
  return cardPersonName({ apiName: coach.apiName, override: coach.apiId === null ? null : team.overrides.get(coach.apiId), people: team.people.slice(0, 1), teamHint: team.teamHint });
}

/** Yalnızca ASCII harf — Türkçe karakter içermesi muhtemel API adı (rapor süzgeci). */
export const isAsciiName = (name: string) => !/[^\x00-\x7F]/u.test(name);

/** Ad raporuna girer mi: ad ASCII ve Türk olması muhtemel; öneri mevcut adla aynıysa (ör. "Kaan Ayhan") girmez. */
export function personNeedsReview(current: string, match: SportmonksPerson | null, suggestion: string | null): boolean {
  if (!isAsciiName(current)) return false;
  if (match) return match.nationality === "Turkey" && suggestion !== null && suggestion !== current;
  return nameOrigin(current) !== "intl";
}
