import { LINEUP_SIZE, type SquadPosition } from "@/types/lineup";

/**
 * Diziliş ("4-2-3-1") → satırlar ve saha koordinatları. Saf, sunucu bağımlılığı yok: hem form
 * (pozisyon grupları) hem Satori şablonu (oyuncu noktalarının yeri) bu tek kaynaktan okur.
 */

export const FORMATION_OPTIONS = [
  "4-2-3-1", "4-3-3", "4-4-2", "4-1-4-1", "4-4-1-1", "4-3-1-2", "4-1-2-1-2", "4-2-2-2", "4-5-1",
  "3-5-2", "3-4-3", "3-4-2-1", "3-4-1-2", "5-3-2", "5-4-1",
] as const;

export const DEFAULT_FORMATION = "4-2-3-1";

export const LINE_LABELS: Record<SquadPosition, string> = { G: "Kaleci", D: "Savunma", M: "Orta Saha", F: "Forvet" };

export interface FormationLine {
  role: SquadPosition;
  /** Bu satırın `slots` dizisindeki ilk indeksi. */
  start: number;
  size: number;
}

/** "4-2-3-1" → [4,2,3,1]; kaleci hariç toplam 10 değilse ya da 2-5 satır dışındaysa null. */
export function parseFormation(value: string): number[] | null {
  const trimmed = value.trim();
  if (!/^\d(-\d){1,4}$/.test(trimmed)) return null;
  const lines = trimmed.split("-").map(Number);
  if (lines.some((n) => n < 1 || n > 6)) return null;
  return lines.reduce((sum, n) => sum + n, 0) === LINEUP_SIZE - 1 ? lines : null;
}

export function isValidFormation(value: string): boolean {
  return parseFormation(value) !== null;
}

/** Kaleci dahil satırlar: ilk satır savunma, son satır forvet, aradakiler orta saha. */
export function formationLines(formation: string): FormationLine[] {
  const outfield = parseFormation(formation) ?? parseFormation(DEFAULT_FORMATION) ?? [];
  const lines: FormationLine[] = [{ role: "G", start: 0, size: 1 }];
  let start = 1;
  outfield.forEach((size, index) => {
    const role: SquadPosition = index === 0 ? "D" : index === outfield.length - 1 ? "F" : "M";
    lines.push({ role, start, size });
    start += size;
  });
  return lines;
}

/** Aynı roldeki ardışık satırları tek grupta toplar (form başlıkları: Kaleci/Savunma/Orta Saha/Forvet). */
export function formationGroups(formation: string): { role: SquadPosition; indexes: number[] }[] {
  const groups: { role: SquadPosition; indexes: number[] }[] = [];
  for (const line of formationLines(formation)) {
    const indexes = Array.from({ length: line.size }, (_, i) => line.start + i);
    const last = groups.at(-1);
    if (last && last.role === line.role) last.indexes.push(...indexes);
    else groups.push({ role: line.role, indexes });
  }
  return groups;
}

export interface PitchPoint {
  /** 0..1, soldan sağa (takımın hücum yönüne bakarken sol = 0). */
  x: number;
  /** 0..1, yukarıdan aşağıya — hücum yukarı doğru, kaleci en altta. */
  y: number;
}

const GOALKEEPER_Y = 0.88;
const BACK_LINE_Y = 0.7;
const FRONT_LINE_Y = 0.13;
const LINE_SPREAD_STEP = 0.205;
const MAX_LINE_SPREAD = 0.78;

export interface PitchLayoutOptions {
  /** Satırdaki iki komşu arası yatay pay (0..1). */
  spreadStep?: number;
  /** Bir satırın kaplayabileceği en geniş yatay alan (0..1). */
  maxSpread?: number;
}

/** 11 pozisyonun saha koordinatı, `slots` sırasıyla. */
export function pitchPositions(formation: string, options: PitchLayoutOptions = {}): PitchPoint[] {
  const spreadStep = options.spreadStep ?? LINE_SPREAD_STEP;
  const maxSpread = options.maxSpread ?? MAX_LINE_SPREAD;
  const lines = formationLines(formation);
  const outfieldCount = lines.length - 1;
  const points: PitchPoint[] = [];
  lines.forEach((line, lineIndex) => {
    const y =
      lineIndex === 0
        ? GOALKEEPER_Y
        : BACK_LINE_Y - ((lineIndex - 1) * (BACK_LINE_Y - FRONT_LINE_Y)) / Math.max(outfieldCount - 1, 1);
    const spread = Math.min(maxSpread, spreadStep * (line.size - 1));
    for (let i = 0; i < line.size; i += 1) {
      const x = line.size === 1 ? 0.5 : 0.5 - spread / 2 + (i * spread) / (line.size - 1);
      points.push({ x, y });
    }
  });
  return points;
}
