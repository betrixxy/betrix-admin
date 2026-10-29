import { pitchPositions } from "@/lib/dashboard/lineup-formations";
import type { LineupPalette, LineupSlot } from "@/types/lineup";
import { upperName, type NameOrigin } from "@/lib/dashboard/name-case";
import { rgba } from "../studio-tokens";
import type { BlockFilter } from "../checkmatch-set/blocks";
import { LineupBackground, TYPE, displayName, nameStyle, shown } from "./lineup-chrome";
import type { LineupGeometry } from "./lineup-geometry";

/**
 * ŞABLON 1 — Taktik Tahtası (`pitch`). Yeşil çim YOK: saha, logodan türetilen gece zemininin hafifçe
 * aydınlanmış bir camıdır; çizgiler ve parıltı logonun açık vurgu rengiyle (LightVibrant) ince çizilir.
 * Numaralar logonun canlı renginde dairelerde, isimler koyu etiket içinde beyaz (her zeminde okunur).
 * Koordinatlar `lineup-formations.ts`'ten gelir (hücum yukarı, kaleci en altta, satır içinde soldan sağa).
 * Geniş-basık içerik alanında (kare, yatay) saha 90° döner: kaleci solda, hücum sağa; satır içi sıra yukarıdan aşağı.
 */

const LAYOUT = { spreadStep: 0.205, maxSpread: 0.8 } as const;
const LINE_WIDTH = 2;
const MARKER = 72;
const MAX_LABEL_WIDTH = 220;
const LABEL_GAP = 12;
const NAME_MAX_FONT = 21;
/** Tahtadaki tüm isimler tek boyutta (hiyerarşi); bu boyuta sığmayan tek tük ad üç noktayla kısalır. */
const NAME_MIN_FONT = 16;
/** Manrope ExtraBold büyük harfte ortalama karakter genişliği / font boyutu (+ harf aralığı payı). */
const CHAR_WIDTH_RATIO = 0.74;
const LABEL_PADDING_X = 12;
const MAX_NAME_CHARS = 15;
const MAX_NAME_CHARS_TIGHT = 11;
const TIGHT_LABEL_WIDTH = 170;

/** Saha çizgileri: dış çizgi panelin kenarıdır; orta çizgi, orta yuvarlak, ceza ve kale alanları, penaltı noktaları. */
function Markings({ width, height, accent, horizontal, circle }: { width: number; height: number; accent: string; horizontal: boolean; circle: number }) {
  const color = rgba(accent, 0.55);
  const line = (style: Record<string, number | string>) => ({ position: "absolute" as const, boxShadow: `0 0 8px ${rgba(accent, 0.28)}`, ...style });
  // `across` kale çizgisine paralel, `depth` sahanın içine doğru ölçüdür; `start` = üst (dikey) / sol (yatay) kale.
  const along = horizontal ? width : height;
  const wide = horizontal ? height : width;
  const box = (start: boolean, across: number, depth: number) =>
    line(
      horizontal
        ? { top: (height - across) / 2, left: start ? -LINE_WIDTH : width - depth + LINE_WIDTH, width: depth, height: across, border: `${LINE_WIDTH}px solid ${color}` }
        : { left: (width - across) / 2, ...(start ? { top: -LINE_WIDTH } : { bottom: -LINE_WIDTH }), width: across, height: depth, border: `${LINE_WIDTH}px solid ${color}` },
    );
  const spot = (at: number) =>
    line({ ...(horizontal ? { left: at - 4, top: height / 2 - 4 } : { left: width / 2 - 4, top: at - 4 }), width: 8, height: 8, borderRadius: 4, backgroundColor: color });
  return (
    <>
      {/* İnce şeritler — çim değil, tahta dokusu (sahanın boyuna dik). */}
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            ...(horizontal ? { left: (width / 10) * i, top: 0, width: width / 10, height } : { left: 0, top: (height / 10) * i, width, height: height / 10 }),
            backgroundColor: i % 2 === 0 ? "rgba(255,255,255,0.022)" : "rgba(0,0,0,0)",
          }}
        />
      ))}
      <div
        style={line(
          horizontal
            ? { left: width / 2 - LINE_WIDTH / 2, top: 0, width: LINE_WIDTH, height, backgroundColor: color }
            : { left: 0, top: height / 2 - LINE_WIDTH / 2, width, height: LINE_WIDTH, backgroundColor: color },
        )}
      />
      <div style={line({ left: width / 2 - circle / 2, top: height / 2 - circle / 2, width: circle, height: circle, borderRadius: circle / 2, border: `${LINE_WIDTH}px solid ${color}` })} />
      <div style={spot(along / 2)} />
      <div style={box(true, wide * 0.58, along * 0.16)} />
      <div style={box(true, wide * 0.28, along * 0.06)} />
      <div style={spot(along * 0.11)} />
      <div style={box(false, wide * 0.58, along * 0.16)} />
      <div style={box(false, wide * 0.28, along * 0.06)} />
      <div style={spot(along * 0.89)} />
    </>
  );
}

function shownName(name: string, labelWidth: number, origin: NameOrigin | null): string {
  return upperName(displayName(name, labelWidth < TIGHT_LABEL_WIDTH ? MAX_NAME_CHARS_TIGHT : MAX_NAME_CHARS), origin);
}

/** Tüm isimler için ortak boyut: en dar sığan isme göre, alt sınırla. */
function boardFontSize(names: string[], labelWidths: number[], k: number): number {
  // Önce eşle, sonra süz — süzme indeksleri kaydırıp isimleri yanlış genişlikle eşlemesin.
  const fits = names
    .map((name, i) => (name ? Math.floor(((labelWidths[i] ?? MAX_LABEL_WIDTH) - LABEL_PADDING_X * 2) / (name.length * CHAR_WIDTH_RATIO)) : Infinity))
    .filter(Number.isFinite);
  return Math.max(Math.round(NAME_MIN_FONT * k), Math.min(Math.round(NAME_MAX_FONT * k), ...fits));
}

function PlayerMarker({ slot, name, fontSize, goalkeeper, palette, labelWidth, marker }: { slot: LineupSlot; name: string; fontSize: number; goalkeeper: boolean; palette: LineupPalette; labelWidth: number; marker: number }) {
  const [fill, ink] = goalkeeper ? [palette.keeper, palette.keeperText] : [palette.kit, palette.kitText];
  const numberScale = marker / MARKER;
  return (
    <div tw="flex flex-col items-center" style={{ width: labelWidth, gap: 10 }}>
      <div
        tw="flex items-center justify-center"
        style={{
          width: marker,
          height: marker,
          borderRadius: marker / 2,
          backgroundColor: fill,
          border: `3px solid ${palette.text}`,
          boxShadow: `0 0 0 6px ${rgba(palette.accent, 0.16)}, 0 12px 24px rgba(0,0,0,0.55)`,
        }}
      >
        <span style={{ fontFamily: TYPE.DISPLAY, fontSize: Math.round((slot.number.length > 1 ? 28 : 33) * numberScale), color: ink, lineHeight: 1, letterSpacing: -0.5 }}>{slot.number || "·"}</span>
      </div>
      <div tw="flex" style={{ maxWidth: labelWidth, padding: `5px ${LABEL_PADDING_X}px`, borderRadius: 8, backgroundColor: rgba(palette.backgroundBottom, 0.88), border: `1px solid ${rgba(palette.accent, 0.28)}` }}>
        <span style={{ ...nameStyle(fontSize, palette.text), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </span>
      </div>
    </div>
  );
}

/** `peopleOrigin`: oyuncu adlarının varsayılan kökeni (takımın ülkesi, bkz. name-case.ts). */
export function LineupPitch({
  g,
  formation,
  slots,
  palette,
  peopleOrigin = null,
  only,
}: {
  g: LineupGeometry;
  formation: string;
  slots: LineupSlot[];
  palette: LineupPalette;
  peopleOrigin?: NameOrigin | null;
  only?: BlockFilter;
}) {
  const { width, height } = g.content;
  const marker = Math.round(MARKER * g.k);
  // Yatay sahada kaleci solda, hücum sağda: (x, y) → (1 - y, x).
  const points = pitchPositions(formation, LAYOUT).map((point) => (g.horizontalPitch ? { x: 1 - point.y, y: point.x } : point));
  // Etiket genişliği: dikeyde aynı satırdaki, yatayda komşu hattaki en yakın oyuncuya uzaklık — isimler çakışmaz.
  const labelWidths = points.map((point) => {
    const gaps = g.horizontalPitch
      ? points.filter((other) => Math.abs(other.x - point.x) > 1e-6).map((other) => Math.abs(other.x - point.x) * width)
      : points.filter((other) => other !== point && other.y === point.y).map((other) => Math.abs(other.x - point.x) * width);
    return Math.min(MAX_LABEL_WIDTH, ...gaps.map((gap) => gap - LABEL_GAP));
  });
  const names = slots.map((slot, index) => shownName(slot.name, labelWidths[index] ?? MAX_LABEL_WIDTH, slot.origin ?? peopleOrigin));
  const fontSize = boardFontSize(names, labelWidths, g.k);
  const glowSize = Math.max(g.content.width, 1080);

  return (
    <>
      <LineupBackground g={g} palette={palette} only={only} glow={{ left: Math.round(g.content.left + g.content.width / 2 - glowSize / 2), top: g.header.top - 52 - 540, size: glowSize }} />
      <div
        tw="flex"
        style={{
          position: "absolute",
          ...g.content,
          borderRadius: 26,
          overflow: "hidden",
          border: `${LINE_WIDTH}px solid ${rgba(palette.accent, 0.6)}`,
          boxShadow: `0 0 34px ${rgba(palette.accent, 0.14)}, 0 30px 60px rgba(0,0,0,0.5)`,
          backgroundImage: `linear-gradient(${g.horizontalPitch ? 270 : 180}deg, ${rgba(palette.glow, 0.1)} 0%, rgba(255,255,255,0.03) 45%, ${rgba(palette.backgroundBottom, 0.6)} 100%)`,
          ...shown(only, "card-body"),
        }}
      >
        <Markings width={width} height={height} accent={palette.accent} horizontal={g.horizontalPitch} circle={Math.round(200 * g.k)} />
        {slots.map((slot, index) => {
          const point = points[index];
          if (!point) return null;
          const labelWidth = labelWidths[index] ?? MAX_LABEL_WIDTH;
          return (
            <div key={index} tw="flex" style={{ position: "absolute", left: point.x * width - labelWidth / 2, top: point.y * height - marker / 2 }}>
              <PlayerMarker slot={slot} name={names[index] ?? ""} fontSize={fontSize} goalkeeper={index === 0} palette={palette} labelWidth={labelWidth} marker={marker} />
            </div>
          );
        })}
      </div>
    </>
  );
}
