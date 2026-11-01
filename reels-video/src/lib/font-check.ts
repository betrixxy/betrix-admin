/**
 * TrueType cmap okuyucu: bir karakterin glifi dosyada var mı? Eksik glif (tofu) tarayıcıda fark edilmeden yedek
 * fonta düşer, bu yüzden ölçüm dosyanın kendisinden yapılır. Biçim 4 ve 12.
 */

function cmapTable(font: Buffer): number {
  const tables = font.readUInt16BE(4);
  for (let index = 0; index < tables; index += 1) {
    const entry = 12 + index * 16;
    if (font.toString("latin1", entry, entry + 4) === "cmap") return font.readUInt32BE(entry + 8);
  }
  throw new Error("cmap tablosu yok");
}

function glyphInFormat12(font: Buffer, at: number, code: number): number {
  const groups = font.readUInt32BE(at + 12);
  for (let index = 0; index < groups; index += 1) {
    const group = at + 16 + index * 12;
    const start = font.readUInt32BE(group);
    if (code >= start && code <= font.readUInt32BE(group + 4)) return font.readUInt32BE(group + 8) + code - start;
  }
  return 0;
}

function glyphInFormat4(font: Buffer, at: number, code: number): number {
  if (code > 0xffff) return 0;
  const segCount = font.readUInt16BE(at + 6) / 2;
  const ends = at + 14;
  const starts = ends + segCount * 2 + 2;
  const deltas = starts + segCount * 2;
  const offsets = deltas + segCount * 2;
  for (let index = 0; index < segCount; index += 1) {
    if (code > font.readUInt16BE(ends + index * 2)) continue;
    const start = font.readUInt16BE(starts + index * 2);
    if (code < start) return 0;
    const delta = font.readUInt16BE(deltas + index * 2);
    const offsetAt = offsets + index * 2;
    const offset = font.readUInt16BE(offsetAt);
    if (offset === 0) return (code + delta) & 0xffff;
    const glyph = font.readUInt16BE(offsetAt + offset + (code - start) * 2);
    return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
  }
  return 0;
}

export function glyphId(font: Buffer, code: number): number {
  const cmap = cmapTable(font);
  const subtables = font.readUInt16BE(cmap + 2);
  let best = 0;
  for (let index = 0; index < subtables; index += 1) {
    const at = cmap + font.readUInt32BE(cmap + 4 + index * 8 + 4);
    const format = font.readUInt16BE(at);
    if (format === 12) best = Math.max(best, glyphInFormat12(font, at, code));
    if (format === 4) best = Math.max(best, glyphInFormat4(font, at, code));
  }
  return best;
}

/** Dizedeki, dosyada glifi olmayan karakterler (boşluk hariç). */
export const missingGlyphs = (font: Buffer, text: string): string[] =>
  [...new Set(text)].filter((char) => char.trim() !== "" && glyphId(font, char.codePointAt(0) ?? 0) === 0);
