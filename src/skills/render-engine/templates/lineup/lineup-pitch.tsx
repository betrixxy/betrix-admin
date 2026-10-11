import { pitchPositions } from "@/lib/dashboard/lineup-formations";
import type { LineupPalette, LineupSlot } from "@/types/lineup";
import { SCORE, TEAM, rgba, upper } from "../deep-analysis/deep-analysis-tokens";
import { CONTENT_BOTTOM, CONTENT_TOP, LineupBackground, W, displayName } from "./lineup-chrome";

/**
 * ŞABLON 1 — Taktik Tahtası (`pitch`). Yeşil çim YOK: saha, logodan türetilen gece zemininin hafifçe
 * aydınlanmış bir camıdır; çizgiler ve parıltı logonun açık vurgu rengiyle (LightVibrant) ince çizilir.
 * Numaralar logonun canlı renginde dairelerde, isimler koyu etiket içinde beyaz (her zeminde okunur).
 * Koordinatlar `lineup-formations.ts`'ten gelir (hücum yukarı, kaleci en altta, satır içinde soldan sağa).
 */

const PITCH = { left: 60, top: CONTENT_TOP - 14, width: W - 120, height: CONTENT_BOTTOM - CONTENT_TOP + 4 } as const;
const LAYOUT = { spreadStep: 0.205, maxSpread: 0.8 } as const;
const LINE_WIDTH = 2;
const MARKER = 72;
const MAX_LABEL_WIDTH = 220;
const LABEL_GAP = 12;
const NAME_MAX_FONT = 21;
/** Tahtadaki tüm isimler tek boyutta (hiyerarşi); bu boyuta sığmayan tek tük ad üç noktayla kısalır. */
const NAME_MIN_FONT = 16;
/** Bricolage ExtraBold büyük harfte ortalama karakter genişliği / font boyutu. */
const CHAR_WIDTH_RATIO = 0.7;
const LABEL_PADDING_X = 12;
const MAX_NAME_CHARS = 15;
const MAX_NAME_CHARS_TIGHT = 11;
const TIGHT_LABEL_WIDTH = 170;

/** Saha çizgileri: dış çizgi panelin kenarıdır; orta çizgi, orta yuvarlak, ceza ve kale alanları, penaltı noktaları. */
function Markings({ width, height, accent }: { width: number; height: number; accent: string }) {
  const color = rgba(accent, 0.55);
  const line = (style: Record<string, number | string>) => ({ position: "absolute" as const, boxShadow: `0 0 8px ${rgba(accent, 0.28)}`, ...style });
  const box = (top: boolean, w: number, h: number) =>
    line({ left: (width - w) / 2, ...(top ? { top: -LINE_WIDTH } : { bottom: -LINE_WIDTH }), width: w, height: h, border: `${LINE_WIDTH}px solid ${color}` });
  const spot = (top: number) => line({ left: width / 2 - 4, top: top - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: color });
  const circle = 200;
  return (
    <>
      {/* İnce şeritler — çim değil, tahta dokusu. */}
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} style={{ position: "absolute", left: 0, top: (height / 10) * i, width, height: height / 10, backgroundColor: i % 2 === 0 ? "rgba(255,255,255,0.022)" : "rgba(0,0,0,0)" }} />
      ))}
      <div style={line({ left: 0, top: height / 2 - LINE_WIDTH / 2, width, height: LINE_WIDTH, backgroundColor: color })} />
      <div style={line({ left: width / 2 - circle / 2, top: height / 2 - circle / 2, width: circle, height: circle, borderRadius: circle / 2, border: `${LINE_WIDTH}px solid ${color}` })} />
      <div style={spot(height / 2)} />
      <div style={box(true, width * 0.58, height * 0.16)} />
      <div style={box(true, width * 0.28, height * 0.06)} />
      <div style={spot(height * 0.11)} />
      <div style={box(false, width * 0.58, height * 0.16)} />
      <div style={box(false, width * 0.28, height * 0.06)} />
      <div style={spot(height * 0.89)} />
    </>
  );
}

function shownName(name: string, labelWidth: number): string {
  return upper(displayName(name, labelWidth < TIGHT_LABEL_WIDTH ? MAX_NAME_CHARS_TIGHT : MAX_NAME_CHARS));
}

/** Tüm isimler için ortak boyut: en dar sığan isme göre, alt sınırla. */
function boardFontSize(names: string[], labelWidths: number[]): number {
  // Önce eşle, sonra süz — süzme indeksleri kaydırıp isimleri yanlış genişlikle eşlemesin.
  const fits = names
    .map((name, i) => (name ? Math.floor(((labelWidths[i] ?? MAX_LABEL_WIDTH) - LABEL_PADDING_X * 2) / (name.length * CHAR_WIDTH_RATIO)) : Infinity))
    .filter(Number.isFinite);
  return Math.max(NAME_MIN_FONT, Math.min(NAME_MAX_FONT, ...fits));
}

function PlayerMarker({ slot, name, fontSize, goalkeeper, palette, labelWidth }: { slot: LineupSlot; name: string; fontSize: number; goalkeeper: boolean; palette: LineupPalette; labelWidth: number }) {
  const [fill, ink] = goalkeeper ? [palette.keeper, palette.keeperText] : [palette.kit, palette.kitText];
  return (
    <div tw="flex flex-col items-center" style={{ width: labelWidth, gap: 10 }}>
      <div
        tw="flex items-center justify-center"
        style={{
          width: MARKER,
          height: MARKER,
          borderRadius: MARKER / 2,
          backgroundColor: fill,
          border: `3px solid ${palette.text}`,
          boxShadow: `0 0 0 6px ${rgba(palette.accent, 0.16)}, 0 12px 24px rgba(0,0,0,0.55)`,
        }}
      >
        <span style={{ fontFamily: SCORE, fontSize: slot.number.length > 1 ? 28 : 32, color: ink, lineHeight: 1 }}>{slot.number || "·"}</span>
      </div>
      <div tw="flex" style={{ maxWidth: labelWidth, padding: `5px ${LABEL_PADDING_X}px`, borderRadius: 8, backgroundColor: rgba(palette.backgroundBottom, 0.88), border: `1px solid ${rgba(palette.accent, 0.28)}` }}>
        <span style={{ fontFamily: TEAM, fontWeight: 800, fontSize, letterSpacing: 0.8, color: palette.text, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </span>
      </div>
    </div>
  );
}

export function LineupPitch({ formation, slots, palette }: { formation: string; slots: LineupSlot[]; palette: LineupPalette }) {
  const { width, height } = PITCH;
  const points = pitchPositions(formation, LAYOUT);
  // Etiket genişliği: aynı satırdaki en yakın komşuya uzaklık — 5'li satırda bile isimler çakışmaz.
  const labelWidths = points.map((point) => {
    const gaps = points.filter((other) => other !== point && other.y === point.y).map((other) => Math.abs(other.x - point.x) * width);
    return Math.min(MAX_LABEL_WIDTH, ...gaps.map((gap) => gap - LABEL_GAP));
  });
  const names = slots.map((slot, index) => shownName(slot.name, labelWidths[index] ?? MAX_LABEL_WIDTH));
  const fontSize = boardFontSize(names, labelWidths);

  return (
    <>
      <LineupBackground palette={palette} glow={{ left: 0, top: -540, size: W }} />
      <div
        tw="flex"
        style={{
          position: "absolute",
          ...PITCH,
          borderRadius: 26,
          overflow: "hidden",
          border: `${LINE_WIDTH}px solid ${rgba(palette.accent, 0.6)}`,
          boxShadow: `0 0 34px ${rgba(palette.accent, 0.14)}, 0 30px 60px rgba(0,0,0,0.5)`,
          backgroundImage: `linear-gradient(180deg, ${rgba(palette.glow, 0.1)} 0%, rgba(255,255,255,0.03) 45%, ${rgba(palette.backgroundBottom, 0.6)} 100%)`,
        }}
      >
        <Markings width={width} height={height} accent={palette.accent} />
        {slots.map((slot, index) => {
          const point = points[index];
          if (!point) return null;
          const labelWidth = labelWidths[index] ?? MAX_LABEL_WIDTH;
          return (
            <div key={index} tw="flex" style={{ position: "absolute", left: point.x * width - labelWidth / 2, top: point.y * height - MARKER / 2 }}>
              <PlayerMarker slot={slot} name={names[index] ?? ""} fontSize={fontSize} goalkeeper={index === 0} palette={palette} labelWidth={labelWidth} />
            </div>
          );
        })}
      </div>
    </>
  );
}
