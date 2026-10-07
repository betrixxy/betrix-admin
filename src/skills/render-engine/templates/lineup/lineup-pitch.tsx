import { pitchPositions } from "@/lib/dashboard/lineup-formations";
import type { LineupSlot } from "@/types/lineup";
import { BODY, GREEN, GREEN_BR, NAVY_800, SCORE, YELLOW, rgba, upper } from "../deep-analysis/deep-analysis-tokens";

/**
 * Muhtemel 11 — taktik tahtası: dikey yeşil saha vektörü (neon çizgiler) + forma renginde
 * numaralı noktalar ve isim etiketleri. Oyuncu yüzü YOKTUR: eksik görsel/gri silüet riski ve
 * görsel indirme maliyeti tamamen ortadan kalkar. Koordinatlar `lineup-formations.ts`'ten gelir.
 */

const LINE = rgba(GREEN_BR, 0.32);
const LINE_WIDTH = 2;
const MARKER = 80;
const MAX_LABEL_WIDTH = 210;
const LABEL_GAP = 10;
/** Bu uzunluğu aşan tam adlar soyada kısaltılır ("Fernando Muslera" → "Muslera"); dar satırda daha erken. */
const MAX_NAME_CHARS = 15;
const MAX_NAME_CHARS_TIGHT = 11;
const TIGHT_LABEL_WIDTH = 200;

/** Kartta görünen ad: uzun tam addan soyadı; admin formda kısa ad yazarsa olduğu gibi kalır. */
export function displayName(name: string, maxChars = MAX_NAME_CHARS): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.split(/\s+/).at(-1) ?? trimmed;
}

/** Forma rengi açıksa lacivert, koyuysa beyaz numara (okunabilirlik). */
function numberColor(hex: string): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return "white";
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? NAVY_800 : "white";
}

function Markings({ width, height }: { width: number; height: number }) {
  const box = (top: boolean, w: number, h: number) => ({
    position: "absolute" as const,
    left: (width - w) / 2,
    ...(top ? { top: 0 } : { bottom: 0 }),
    width: w,
    height: h,
    border: `${LINE_WIDTH}px solid ${LINE}`,
    ...(top ? { borderTop: "none" } : { borderBottom: "none" }),
  });
  return (
    <>
      {/* Çim şeritleri */}
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          style={{ position: "absolute", left: 0, top: (height / 10) * i, width, height: height / 10, backgroundColor: i % 2 === 0 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0)" }}
        />
      ))}
      <div style={{ position: "absolute", left: 0, top: height / 2 - LINE_WIDTH / 2, width, height: LINE_WIDTH, backgroundColor: LINE }} />
      <div style={{ position: "absolute", left: width / 2 - 95, top: height / 2 - 95, width: 190, height: 190, borderRadius: 95, border: `${LINE_WIDTH}px solid ${LINE}` }} />
      <div style={{ position: "absolute", left: width / 2 - 6, top: height / 2 - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: LINE }} />
      <div style={box(true, width * 0.6, height * 0.15)} />
      <div style={box(true, width * 0.3, height * 0.055)} />
      <div style={box(false, width * 0.6, height * 0.15)} />
      <div style={box(false, width * 0.3, height * 0.055)} />
    </>
  );
}

function PlayerMarker({ slot, goalkeeper, colorHex, labelWidth }: { slot: LineupSlot; goalkeeper: boolean; colorHex: string; labelWidth: number }) {
  const fill = goalkeeper ? YELLOW : colorHex;
  const name = displayName(slot.name, labelWidth < TIGHT_LABEL_WIDTH ? MAX_NAME_CHARS_TIGHT : MAX_NAME_CHARS);
  return (
    <div tw="flex flex-col items-center" style={{ width: labelWidth, gap: 10 }}>
      <div
        tw="flex items-center justify-center"
        style={{
          width: MARKER,
          height: MARKER,
          borderRadius: MARKER / 2,
          backgroundColor: fill,
          border: "4px solid rgba(255,255,255,0.92)",
          boxShadow: `0 0 0 6px ${rgba(GREEN_BR, 0.22)}, 0 10px 22px rgba(0,0,0,0.45)`,
        }}
      >
        <span style={{ fontFamily: SCORE, fontSize: slot.number.length > 1 ? 30 : 34, color: numberColor(fill), lineHeight: 1 }}>
          {slot.number || "·"}
        </span>
      </div>
      <div
        tw="flex"
        style={{
          maxWidth: labelWidth,
          padding: "5px 12px",
          borderRadius: 999,
          backgroundColor: "rgba(10,26,47,0.88)",
          border: `1px solid ${rgba(GREEN, 0.35)}`,
        }}
      >
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: name.length > 11 ? 18 : 21, letterSpacing: 0.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {upper(name)}
        </span>
      </div>
    </div>
  );
}

export function LineupPitch({
  formation,
  slots,
  colorHex,
  width,
  height,
}: {
  formation: string;
  slots: LineupSlot[];
  colorHex: string;
  width: number;
  height: number;
}) {
  const points = pitchPositions(formation);
  // Etiket genişliği: aynı satırdaki en yakın komşuya uzaklık — 5'li satırda bile etiketler çakışmaz.
  const labelWidths = points.map((point) => {
    const gaps = points.filter((other) => other !== point && other.y === point.y).map((other) => Math.abs(other.x - point.x) * width);
    return Math.min(MAX_LABEL_WIDTH, ...gaps.map((gap) => gap - LABEL_GAP));
  });
  return (
    <div
      tw="relative flex"
      style={{
        width,
        height,
        borderRadius: 28,
        overflow: "hidden",
        border: `2px solid ${rgba(GREEN_BR, 0.4)}`,
        backgroundImage: "linear-gradient(180deg, #0f4a2e 0%, #0b3a24 55%, #082c1c 100%)",
      }}
    >
      <Markings width={width} height={height} />
      {slots.map((slot, index) => {
        const point = points[index];
        if (!point) return null;
        const labelWidth = labelWidths[index] ?? MAX_LABEL_WIDTH;
        return (
          <div key={index} tw="flex" style={{ position: "absolute", left: point.x * width - labelWidth / 2, top: point.y * height - MARKER / 2 }}>
            <PlayerMarker slot={slot} goalkeeper={index === 0} colorHex={colorHex} labelWidth={labelWidth} />
          </div>
        );
      })}
    </div>
  );
}
