import type { WeeklyGrouping, WeeklyMatch } from "@/types/weekly-fixtures";

/** "Haftanın Maçları" kartının saf yerleşim kuralları (istemci ve şablon da içe aktarır). */

export interface WeeklySection {
  key: string;
  /** "14 AĞUSTOS CUMA" ya da "A GRUBU". */
  label: string;
  matches: WeeklyMatch[];
}

const DAY_LABEL = new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "numeric", month: "long", weekday: "long" });
const SHORT_DATE = new Intl.DateTimeFormat("tr-TR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

const upper = (value: string) => value.toLocaleUpperCase("tr-TR");
/** yyyy-MM-dd → UTC öğlen: saat dilimi kayması günü değiştirmesin (tarih zaten İstanbul'a göre). */
const dateOf = (dateKey: string) => new Date(`${dateKey}T12:00:00Z`);

/** "2026-08-14" → "14 AĞUSTOS CUMA". */
export function dayLabel(dateKey: string): string {
  const parts = DAY_LABEL.formatToParts(dateOf(dateKey));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return upper(`${get("day")} ${get("month")} ${get("weekday")}`);
}

/** "2026-08-14" → "14.08". */
export function shortDate(dateKey: string): string {
  return SHORT_DATE.format(dateOf(dateKey));
}

/** Tüm maçların grup harfi varsa kart gruplara, yoksa günlere bölünür. */
export function weeklyGrouping(matches: WeeklyMatch[]): WeeklyGrouping {
  return matches.length > 0 && matches.every((match) => match.group) ? "group" : "date";
}

/** Bölümler admin'in sırasını korur: bölüm sırası ilk görünüşe göre, bölüm içi sıra listedeki gibi. */
export function weeklySections(matches: WeeklyMatch[], grouping: WeeklyGrouping): WeeklySection[] {
  const sections = new Map<string, WeeklySection>();
  for (const match of matches) {
    const key = grouping === "group" ? `group:${match.group ?? ""}` : `date:${match.dateKey}`;
    const label = grouping === "group" ? `${match.group ?? ""} GRUBU` : dayLabel(match.dateKey);
    const section = sections.get(key) ?? { key, label, matches: [] };
    section.matches.push(match);
    sections.set(key, section);
  }
  const ordered = [...sections.values()];
  // Gruplar her zaman harf sırasıyla (A, B, C…); günler admin'in sırasıyla.
  return grouping === "group" ? ordered.toSorted((a, b) => a.key.localeCompare(b.key)) : ordered;
}

/**
 * Başlığı ikiye böler: "Lig Aşaması · 2. Maç Günü" → üst satır "LİG AŞAMASI", büyük başlık "2. MAÇ GÜNÜ".
 * Ayraç yoksa üst satır boş, başlığın tamamı büyük yazılır.
 */
export function splitTitle(title: string): { kicker: string; main: string } {
  const parts = title.split(" · ").map((part) => part.trim()).filter(Boolean);
  const main = parts.pop() ?? "";
  return { kicker: parts.join(" · ").toLocaleUpperCase("tr-TR"), main: main.toLocaleUpperCase("tr-TR") };
}

export interface MatchCenter {
  /** Saat ("21.30"), skor ("2 - 1") ya da kısa durum ("ERT."). */
  primary: string;
  kind: "time" | "score" | "status";
  /** Küçük alt satır: canlı dakika, uzatma/penaltı notu ya da grup kartında maç tarihi. */
  note: string;
}

/** Ortadaki kutu: oynanmamış maçta saat, oynanan/bitmiş maçta skor. */
export function matchCenter(match: WeeklyMatch, grouping: WeeklyGrouping): MatchCenter {
  const dateNote = grouping === "group" ? shortDate(match.dateKey) : "";
  const score = `${match.home.goals ?? 0} - ${match.away.goals ?? 0}`;
  switch (match.status) {
    case "scheduled":
      return { primary: match.time || "—", kind: match.time ? "time" : "status", note: dateNote };
    case "live":
      return { primary: score, kind: "score", note: match.elapsed ? `CANLI ${match.elapsed}'` : "CANLI" };
    case "finished":
      return { primary: score, kind: "score", note: dateNote };
    case "postponed":
      return { primary: "ERT.", kind: "status", note: "ERTELENDİ" };
    case "cancelled":
      return { primary: "İPTAL", kind: "status", note: dateNote };
    case "abandoned":
      return { primary: score, kind: "score", note: "YARIDA KALDI" };
  }
}

/** Gönderi metni: başlık + bölüm bölüm "Ev 2-1 Dep" / "21.30 Ev - Dep". */
export function weeklyCaption(leagueName: string, title: string, matches: WeeklyMatch[], grouping: WeeklyGrouping): string {
  const lines = [`${leagueName} | ${title}`];
  for (const section of weeklySections(matches, grouping)) {
    lines.push("", section.label);
    for (const match of section.matches) {
      const center = matchCenter(match, grouping);
      lines.push(center.kind === "score" ? `${match.home.name} ${center.primary} ${match.away.name}` : `${center.primary} ${match.home.name} - ${match.away.name}`);
    }
  }
  return lines.join("\n");
}

/** Kart dikey yerleşimi (1080×1350): başlığın altı ile alt imza bandının üstü arası maç alanıdır. */
export const WEEKLY_LAYOUT = {
  bodyTop: 300,
  bodyBottom: 1196,
  sectionHeader: 40,
  sectionGap: 14,
  rowGap: 8,
  minRow: 54,
  maxRow: 96,
} as const;

/** Maç satırı yüksekliği; maçlar karta sığmıyorsa null (form uyarır, kayıt reddedilir). */
export function weeklyRowHeight(sectionCount: number, matchCount: number): number | null {
  if (matchCount === 0) return null;
  const { bodyTop, bodyBottom, sectionHeader, sectionGap, rowGap, minRow, maxRow } = WEEKLY_LAYOUT;
  const fixed = sectionCount * sectionHeader + Math.max(0, sectionCount - 1) * sectionGap + (matchCount - 1) * rowGap;
  const row = Math.floor((bodyBottom - bodyTop - fixed) / matchCount);
  return row < minRow ? null : Math.min(maxRow, row);
}

/** Kartın alt başlığı: hepsi bitmişse "MAÇ SONUÇLARI", hiçbiri oynanmamışsa "FİKSTÜR", karışıksa ikisi. */
export function weeklyKindLabel(matches: WeeklyMatch[]): string {
  const played = matches.filter((match) => match.status === "finished" || match.status === "live" || match.status === "abandoned").length;
  if (played === 0) return "FİKSTÜR";
  return played === matches.length ? "MAÇ SONUÇLARI" : "FİKSTÜR & SONUÇLAR";
}
