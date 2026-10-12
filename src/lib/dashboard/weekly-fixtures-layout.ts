import { SOCIAL_FORMATS, type SocialFormatId } from "@/types/studio-formats";
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

/**
 * Kart yerleşimi, formata göre (bkz. types/studio-formats.ts). Başlığın altı ile alt imza bandının üstü
 * arası maç alanıdır; Story'de üst/alt platform bantları boş kalır, yatayda maçlar iki sütuna yayılır.
 * 4:5 değerleri ilk tasarımın birebir aynısıdır.
 */
export interface WeeklyLayout {
  width: number;
  height: number;
  pad: number;
  /** Başlık bloğunun üstü. */
  headerTop: number;
  /** Büyük başlığın en büyük punto değeri. */
  titleMax: number;
  bodyTop: number;
  bodyBottom: number;
  /** Alt imza bandının üstü; bant kanvasın altına kadar uzar (Story'de alt güvenli alanı da örter). */
  footerTop: number;
  footerHeight: number;
  columns: number;
  columnGap: number;
  sectionHeader: number;
  sectionGap: number;
  rowGap: number;
  minRow: number;
  maxRow: number;
}

const BASE = { sectionHeader: 40, sectionGap: 14, rowGap: 8, minRow: 54 } as const;

export function weeklyLayout(formatId: SocialFormatId): WeeklyLayout {
  const { width, height, safeTop, safeBottom } = SOCIAL_FORMATS[formatId];
  switch (formatId) {
    case "landscape": {
      const footerHeight = 112;
      const footerTop = height - footerHeight;
      return { ...BASE, width, height, pad: 72, headerTop: 52, titleMax: 96, bodyTop: 272, bodyBottom: footerTop - 24, footerTop, footerHeight, columns: 2, columnGap: 48, maxRow: 92 };
    }
    case "square": {
      const footerHeight = 104;
      const footerTop = height - footerHeight;
      return { ...BASE, width, height, pad: 56, headerTop: 44, titleMax: 84, bodyTop: 252, bodyBottom: footerTop - 20, footerTop, footerHeight, columns: 1, columnGap: 0, maxRow: 88 };
    }
    case "story":
    case "post": {
      const footerHeight = 128;
      const footerTop = height - safeBottom - footerHeight;
      const headerTop = safeTop + 64;
      return { ...BASE, width, height, pad: 56, headerTop, titleMax: 104, bodyTop: headerTop + 236, bodyBottom: footerTop - 26, footerTop, footerHeight, columns: 1, columnGap: 0, maxRow: formatId === "story" ? 112 : 96 };
    }
  }
}

/** Sütun başına tek satır yüksekliği; maçlar sığmıyorsa null. */
export function weeklyRowHeight(sectionCount: number, matchCount: number, layout: WeeklyLayout = weeklyLayout("post")): number | null {
  if (matchCount === 0) return null;
  const { bodyTop, bodyBottom, sectionHeader, sectionGap, rowGap, minRow, maxRow } = layout;
  const fixed = sectionCount * sectionHeader + Math.max(0, sectionCount - 1) * sectionGap + (matchCount - 1) * rowGap;
  const row = Math.floor((bodyBottom - bodyTop - fixed) / matchCount);
  return row < minRow ? null : Math.min(maxRow, row);
}

/**
 * Bölümleri sütunlara dağıtır: her sütun ~eşit sayıda maç alır, sütun sınırına denk gelen bölüm bölünür
 * (devamı yeni sütunda aynı başlıkla sürer). Tek sütunda bölümler olduğu gibi kalır.
 */
export function weeklyColumns(sections: WeeklySection[], columns: number): WeeklySection[][] {
  const total = sections.reduce((sum, section) => sum + section.matches.length, 0);
  if (columns <= 1 || total === 0) return [sections];
  const target = Math.ceil(total / columns);
  const result: WeeklySection[][] = [[]];
  let filled = 0;
  for (const section of sections) {
    let rest = section.matches;
    let part = 0;
    while (rest.length > 0) {
      if (filled >= target && result.length < columns) {
        result.push([]);
        filled = 0;
      }
      const take = result.length >= columns ? rest.length : Math.min(rest.length, target - filled);
      result.at(-1)?.push({ key: part === 0 ? section.key : `${section.key}:${part}`, label: section.label, matches: rest.slice(0, take) });
      rest = rest.slice(take);
      filled += take;
      part += 1;
    }
  }
  return result;
}

export interface WeeklyPlan {
  columns: WeeklySection[][];
  rowHeight: number;
}

/** Kartın yerleşim planı (sütunlar + ortak satır yüksekliği); maçlar bu formata sığmıyorsa null. */
export function weeklyPlan(matches: WeeklyMatch[], grouping: WeeklyGrouping, layout: WeeklyLayout): WeeklyPlan | null {
  const columns = weeklyColumns(weeklySections(matches, grouping), layout.columns).filter((column) => column.length > 0);
  if (columns.length === 0) return null;
  const heights = columns.map((column) => weeklyRowHeight(column.length, column.reduce((sum, section) => sum + section.matches.length, 0), layout));
  if (heights.some((height) => height === null)) return null;
  return { columns, rowHeight: Math.min(...heights.filter((height) => height !== null)) };
}

/** Kartın alt başlığı: hepsi bitmişse "MAÇ SONUÇLARI", hiçbiri oynanmamışsa "FİKSTÜR", karışıksa ikisi. */
export function weeklyKindLabel(matches: WeeklyMatch[]): string {
  const played = matches.filter((match) => match.status === "finished" || match.status === "live" || match.status === "abandoned").length;
  if (played === 0) return "FİKSTÜR";
  return played === matches.length ? "MAÇ SONUÇLARI" : "FİKSTÜR & SONUÇLAR";
}
