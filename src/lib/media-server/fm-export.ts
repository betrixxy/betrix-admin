import type { DateOrder, FmClub, FmPerson } from "@/types/media-server";
import type { Result } from "@/types/result";

/**
 * FM26 dışa aktarımlarını okur. FM resim dosyaları (`face_<UID>.png`, `club_<UID>.png`) isim
 * içermez; isim/doğum tarihi/kulüp bilgisi yalnızca oyun içinden dışa aktarılan bir görünümden
 * gelir. Desteklenen biçimler: FM "Web Sayfası" (.html), FM "Metin" çıktısı (`|` ayraçlı) ve
 * CSV/TSV/`;` ayraçlı tablolar.
 */

type Table = { header: string[]; rows: string[][] };

const HEADER_ALIASES = {
  uid: ["uid", "uniqueid", "fmid", "id"],
  name: ["name", "fullname", "isim", "ad", "adsoyad", "player", "oyuncu"],
  dob: ["dob", "dateofbirth", "birthdate", "dogumtarihi", "born"],
  club: ["club", "kulup", "team", "takim"],
  nation: ["nation", "country", "ulke"],
  shortName: ["shortname", "kisaad"],
} as const;

type Column = keyof typeof HEADER_ALIASES;

function headerKey(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "").replace(/ı/g, "i").replace(/[^a-z0-9]/g, "");
}

function findColumn(header: string[], column: Column): number {
  const keys = header.map(headerKey);
  const aliases: readonly string[] = HEADER_ALIASES[column];
  return keys.findIndex((key) => aliases.includes(key));
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseHtmlTable(text: string): string[][] {
  const rows: string[][] = [];
  for (const tr of text.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(tr[1] ?? "").matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) =>
      decodeEntities((cell[1] ?? "").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim(),
    );
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

/** Tırnak destekli tek satır CSV ayrıştırma. */
function splitDelimited(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else current += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { cells.push(current.trim()); current = ""; }
    else current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseTextTable(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  const first = lines[0] ?? "";
  if (first.includes("|")) {
    return lines
      .filter((line) => !/^[\s|\-=+_]*$/.test(line))
      .map((line) => line.split("|").map((c) => c.trim()))
      .map((cells) => cells.slice(cells[0] === "" ? 1 : 0, cells.at(-1) === "" ? -1 : undefined));
  }
  const delimiter = first.includes("\t")
    ? "\t"
    : (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  return lines.map((line) => splitDelimited(line, delimiter));
}

export function parseTable(text: string): Table {
  const clean = text.replace(/^﻿/, "");
  const rows = /<table/i.test(clean) ? parseHtmlTable(clean) : parseTextTable(clean);
  // Başlık satırı: "UID"/"Unique ID" sütununu içeren ilk satır (FM çıktısında üstte başlık metni olabilir).
  const headerIndex = rows.findIndex((row) => findColumn(row, "uid") >= 0);
  if (headerIndex < 0) return { header: [], rows: [] };
  return { header: rows[headerIndex] ?? [], rows: rows.slice(headerIndex + 1) };
}

const DATE_PATTERN = /(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})/;

/** Tüm satırlardan tarih sırasını çıkarır; çelişki ya da belirsizlikte hata döner. */
export function detectDateOrder(values: string[]): Result<DateOrder> {
  let dmy = 0;
  let mdy = 0;
  let ymd = 0;
  for (const value of values) {
    const m = DATE_PATTERN.exec(value);
    if (!m) continue;
    const [a, b] = [m[1] ?? "", m[2] ?? ""];
    if (a.length === 4) ymd += 1;
    else if (Number(a) > 12) dmy += 1;
    else if (Number(b) > 12) mdy += 1;
  }
  const kinds = [dmy > 0, mdy > 0, ymd > 0].filter(Boolean).length;
  if (kinds > 1) {
    return { ok: false, error: { code: "DATE_ORDER_CONFLICT", message: `Tarih biçimi çelişkili (GG/AA: ${dmy}, AA/GG: ${mdy}, YYYY: ${ymd}).` } };
  }
  if (ymd > 0) return { ok: true, data: "YMD" };
  if (dmy > 0) return { ok: true, data: "DMY" };
  if (mdy > 0) return { ok: true, data: "MDY" };
  return { ok: false, error: { code: "DATE_ORDER_UNKNOWN", message: "Tarih sırası tespit edilemedi — --date-format DMY|MDY|YMD verin." } };
}

/** "12/3/2001 (24 years old)" → "2001-03-12" (DMY). Geçersiz tarih → null. */
export function parseFmDate(value: string, order: DateOrder): string | null {
  const m = DATE_PATTERN.exec(value);
  if (!m) return null;
  const [p1, p2, p3] = [m[1] ?? "", m[2] ?? "", m[3] ?? ""];
  const [y, mo, d] = order === "YMD" ? [p1, p2, p3] : order === "DMY" ? [p3, p2, p1] : [p3, p1, p2];
  if (y.length !== 4) return null;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}

function cell(row: string[], index: number): string | null {
  if (index < 0) return null;
  const value = row[index]?.trim() ?? "";
  return value === "" || value === "-" ? null : value;
}

function validUid(value: string | null): value is string {
  return value !== null && /^\d+$/.test(value);
}

export function readFmPeople(text: string, dateOrder: DateOrder | null): Result<FmPerson[]> {
  const { header, rows } = parseTable(text);
  const [uidCol, nameCol, dobCol, clubCol] = (["uid", "name", "dob", "club"] as const).map((c) => findColumn(header, c));
  if (uidCol === undefined || uidCol < 0 || nameCol === undefined || nameCol < 0) {
    return { ok: false, error: { code: "MISSING_COLUMNS", message: `Oyuncu dosyasında "UID" ve "Name" sütunları zorunlu. Bulunan başlıklar: ${header.join(", ")}` } };
  }
  if (dobCol === undefined || dobCol < 0) {
    return { ok: false, error: { code: "MISSING_COLUMNS", message: `Oyuncu dosyasında "DoB" (doğum tarihi) sütunu zorunlu — doğum tarihi olmadan kesin eşleşme yapılmaz.` } };
  }
  let order = dateOrder;
  if (!order) {
    const detected = detectDateOrder(rows.map((row) => row[dobCol] ?? ""));
    if (!detected.ok) return detected;
    order = detected.data;
  }
  const resolvedOrder = order;
  const people = rows.flatMap((row): FmPerson[] => {
    const uid = cell(row, uidCol);
    const name = cell(row, nameCol);
    if (!validUid(uid) || !name) return [];
    const dobRaw = cell(row, dobCol);
    return [{ uid, name, dob: dobRaw ? parseFmDate(dobRaw, resolvedOrder) : null, club: cell(row, clubCol ?? -1) }];
  });
  return { ok: true, data: people };
}

export function readFmClubs(text: string): Result<FmClub[]> {
  const { header, rows } = parseTable(text);
  const [uidCol, nameCol, nationCol, shortCol] = (["uid", "name", "nation", "shortName"] as const).map((c) => findColumn(header, c));
  if (uidCol === undefined || uidCol < 0 || nameCol === undefined || nameCol < 0 || nationCol === undefined || nationCol < 0) {
    return { ok: false, error: { code: "MISSING_COLUMNS", message: `Kulüp dosyasında "UID", "Name" ve "Nation" sütunları zorunlu. Bulunan başlıklar: ${header.join(", ")}` } };
  }
  const clubs = rows.flatMap((row): FmClub[] => {
    const uid = cell(row, uidCol);
    const name = cell(row, nameCol);
    if (!validUid(uid) || !name) return [];
    return [{ uid, name, shortName: cell(row, shortCol ?? -1), nation: cell(row, nationCol) }];
  });
  return { ok: true, data: clubs };
}
