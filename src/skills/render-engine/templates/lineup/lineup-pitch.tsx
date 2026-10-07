import { pitchPositions, type PitchLayoutOptions } from "@/lib/dashboard/lineup-formations";
import type { LineupSlot } from "@/types/lineup";
import { NAVY_800, SCORE, TEAM, YELLOW, rgba, upper } from "../deep-analysis/deep-analysis-tokens";

/**
 * Muhtemel 11 — minimalist taktik tahtası. Saha çizgisi YOK: yalnızca forma renginde numaralı
 * daireler ve altında temiz tipografiyle isim. Koordinatlar `lineup-formations.ts`'ten gelir
 * (hücum yukarı, kaleci en altta, satır içinde soldan sağa).
 */

const MARKER = 70;
const MAX_LABEL_WIDTH = 220;
const LABEL_GAP = 12;
const NAME_MAX_FONT = 22;
/** Tahtadaki tüm isimler tek boyutta (hiyerarşi); bu boyuta sığmayan tek tük ad üç noktayla kısalır. */
const NAME_MIN_FONT = 17;
/** Bricolage ExtraBold büyük harfte ortalama karakter genişliği / font boyutu. */
const CHAR_WIDTH_RATIO = 0.66;
/** Bu uzunluğu aşan tam adlar soyada kısaltılır ("Fernando Muslera" → "Muslera"); dar satırda daha erken. */
const MAX_NAME_CHARS = 15;
const MAX_NAME_CHARS_TIGHT = 11;
const TIGHT_LABEL_WIDTH = 170;

/** Kartta görünen ad: uzun tam addan soyadı; admin formda kısa ad yazarsa olduğu gibi kalır. */
export function displayName(name: string, maxChars = MAX_NAME_CHARS): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.split(/\s+/).at(-1) ?? trimmed;
}

/** Forma rengi açıksa lacivert, koyuysa beyaz numara (okunabilirlik). */
export function numberColor(hex: string): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return "white";
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? NAVY_800 : "white";
}

function shownName(name: string, labelWidth: number): string {
  return upper(displayName(name, labelWidth < TIGHT_LABEL_WIDTH ? MAX_NAME_CHARS_TIGHT : MAX_NAME_CHARS));
}

/** Tüm isimler için ortak boyut: en dar sığan isme göre, alt sınırla. */
function boardFontSize(names: string[], labelWidths: number[]): number {
  // Önce eşle, sonra süz — süzme indeksleri kaydırıp isimleri yanlış genişlikle eşlemesin.
  const fits = names
    .map((name, i) => (name ? Math.floor((labelWidths[i] ?? MAX_LABEL_WIDTH) / (name.length * CHAR_WIDTH_RATIO)) : Infinity))
    .filter(Number.isFinite);
  return Math.max(NAME_MIN_FONT, Math.min(NAME_MAX_FONT, ...fits));
}

function PlayerMarker({ slot, name, fontSize, goalkeeper, colorHex, labelWidth }: { slot: LineupSlot; name: string; fontSize: number; goalkeeper: boolean; colorHex: string; labelWidth: number }) {
  const fill = goalkeeper ? YELLOW : colorHex;
  return (
    <div tw="flex flex-col items-center" style={{ width: labelWidth, gap: 10 }}>
      <div
        tw="flex items-center justify-center"
        style={{
          width: MARKER,
          height: MARKER,
          borderRadius: MARKER / 2,
          backgroundColor: fill,
          border: "3px solid rgba(255,255,255,0.95)",
          boxShadow: `0 0 0 6px ${rgba(fill, 0.22)}, 0 12px 26px rgba(0,0,0,0.55)`,
        }}
      >
        <span style={{ fontFamily: SCORE, fontSize: slot.number.length > 1 ? 28 : 32, color: numberColor(fill), lineHeight: 1 }}>
          {slot.number || "·"}
        </span>
      </div>
      <span
        style={{
          maxWidth: labelWidth,
          fontFamily: TEAM,
          fontWeight: 800,
          fontSize,
          letterSpacing: 0.6,
          color: "white",
          textShadow: "0 2px 10px rgba(0,0,0,0.9)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </span>
    </div>
  );
}

export function LineupBoard({
  formation,
  slots,
  colorHex,
  width,
  height,
  layout,
}: {
  formation: string;
  slots: LineupSlot[];
  colorHex: string;
  width: number;
  height: number;
  layout?: PitchLayoutOptions;
}) {
  const points = pitchPositions(formation, layout);
  // Etiket genişliği: aynı satırdaki en yakın komşuya uzaklık — 5'li satırda bile isimler çakışmaz.
  const labelWidths = points.map((point) => {
    const gaps = points.filter((other) => other !== point && other.y === point.y).map((other) => Math.abs(other.x - point.x) * width);
    return Math.min(MAX_LABEL_WIDTH, ...gaps.map((gap) => gap - LABEL_GAP));
  });
  const names = slots.map((slot, index) => shownName(slot.name, labelWidths[index] ?? MAX_LABEL_WIDTH));
  const fontSize = boardFontSize(names, labelWidths);
  return (
    <div tw="relative flex" style={{ width, height }}>
      {slots.map((slot, index) => {
        const point = points[index];
        if (!point) return null;
        const labelWidth = labelWidths[index] ?? MAX_LABEL_WIDTH;
        return (
          <div key={index} tw="flex" style={{ position: "absolute", left: point.x * width - labelWidth / 2, top: point.y * height - MARKER / 2 }}>
            <PlayerMarker slot={slot} name={names[index] ?? ""} fontSize={fontSize} goalkeeper={index === 0} colorHex={colorHex} labelWidth={labelWidth} />
          </div>
        );
      })}
    </div>
  );
}
