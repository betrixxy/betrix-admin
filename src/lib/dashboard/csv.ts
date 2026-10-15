/**
 * CSV üretimi (RFC 4180) — saf. Excel'in UTF-8'i (Türkçe karakterler) tanıması için başa BOM eklenir;
 * ayraç virgül, ondalık nokta, satır sonu CRLF. Dizi değerleri `|` ile birleştirilir.
 */

export type CsvValue = string | number | boolean | Date | null | undefined | readonly string[];

const BOM = "﻿";

function cell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (value instanceof Date) text = value.toISOString();
  else if (Array.isArray(value)) text = value.join("|");
  else if (typeof value === "number") text = Number.isFinite(value) ? String(Math.round(value * 1e6) / 1e6) : "";
  else text = String(value);
  // Formül enjeksiyonuna karşı (=, +, -, @ ile başlayan metin) — sayılar hariç.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: readonly string[], rows: readonly (readonly CsvValue[])[]): string {
  return BOM + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function csvResponse(fileName: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
