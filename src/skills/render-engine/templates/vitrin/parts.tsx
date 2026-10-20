import type { VitrinCard, VitrinOpenBox } from "@/types/vitrin";
import { blockOpacity, type BlockFilter, type LayoutBlockId } from "../checkmatch-set/blocks";
import { hexAlpha } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";
import type { BlockSlot, VitrinGeometry } from "./geometry";

/**
 * Vitrin kartının yapı taşları (Satori). Kilitli kutuların cevap alanı İKİ katmanda çizilir:
 * ana katmanda boş bırakılır (yer kaplar), `placeholder` katmanında yalnızca SABİT yer tutucu metin
 * görünür — motor o katmanı sharp ile bulanıklaştırıp ana katmanın altına basar. Gerçek sonuç ya da
 * olasılık bileşene hiç geçmez (`VitrinCard.locked` yalnızca başlık).
 */

/** Bulanık alanın altındaki sabit metin — her maçta aynı; gerçek değer DEĞİLDİR. */
export const LOCKED_PLACEHOLDER = "Sonuç · %00";

export type VitrinLayer = "main" | "placeholder";

const SHADE_RGB = "7,8,12";
const PANEL_BG = "rgba(12,14,20,0.62)";
const PANEL_BORDER = "rgba(255,255,255,0.12)";
const TEXT_SHADOW = "0 2px 12px rgba(0,0,0,0.55)";

/** Ana katmanda blok görünürlüğü (`only`), yer tutucu katmanında her şey gizli. */
const visible = (layer: VitrinLayer, only: BlockFilter, id: LayoutBlockId) => (layer === "placeholder" ? 0 : blockOpacity(only, id));

export function VitrinShade({ g, layer, only }: { g: VitrinGeometry; layer: VitrinLayer; only: BlockFilter }) {
  // Gradyan arka plandır — yerleşim kontrolünde ve yer tutucu katmanında çizilmez.
  if (only || layer === "placeholder") return null;
  const { width, height } = g.frame;
  const span = g.shade.direction === "down" ? height : width;
  const start = (g.shade.start / span) * 100;
  const solid = (g.shade.solid / span) * 100;
  const direction = g.shade.direction === "down" ? "to bottom" : "to right";
  return (
    <div tw="absolute flex" style={{ left: 0, top: 0, width, height }}>
      <div
        tw="absolute flex"
        style={{ left: 0, top: 0, width, height, backgroundImage: `linear-gradient(${direction}, rgba(${SHADE_RGB},0) ${start}%, rgba(${SHADE_RGB},0.72) ${(start + solid) / 2}%, rgba(${SHADE_RGB},0.94) ${solid}%, rgba(${SHADE_RGB},0.97) 100%)` }}
      />
      {/* Üst bant: sayfa etiketi ve tarih fotoğraf üstünde okunsun. */}
      <div tw="absolute flex" style={{ left: 0, top: 0, width, height: px(220, g.k), backgroundImage: `linear-gradient(to bottom, rgba(${SHADE_RGB},0.55), rgba(${SHADE_RGB},0))` }} />
    </div>
  );
}

export function TeamsRow({ card, g, layer, only }: { card: VitrinCard; g: VitrinGeometry; layer: VitrinLayer; only: BlockFilter }) {
  const { k } = g;
  const width = g.stackRight - g.stackLeft;
  const logo = px(52, k);
  const versus = px(26, k);
  const nameWidth = (width - 2 * logo - versus - px(4 * 14, k)) / 2;
  const size = Math.min(fitFontSize(card.homeTeam, nameWidth, px(46, k), 0.46, px(22, k)), fitFontSize(card.awayTeam, nameWidth, px(46, k), 0.46, px(22, k)));
  const name = { fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW, letterSpacing: size * 0.02 };
  return (
    <div tw="absolute flex items-center" style={{ left: g.stackLeft, top: g.teams.top, width, height: g.teams.height, opacity: visible(layer, only, "teams") }}>
      <TeamLogo src={card.homeLogo} name={card.homeTeam} size={logo} />
      <span style={{ ...name, marginLeft: px(14, k) }}>{card.homeTeam}</span>
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: versus, color: hexAlpha(card.accentHex, 0.95), margin: `0 ${px(16, k)}px` }}>×</span>
      <span style={{ ...name, marginRight: px(14, k) }}>{card.awayTeam}</span>
      <TeamLogo src={card.awayLogo} name={card.awayTeam} size={logo} />
    </div>
  );
}

/** "%64" → küçük "%" (Geist; Anton'un yüzde glifi "0/o" gibi okunuyor) + büyük rakam (Anton). */
function Percent({ value, size, color }: { value: string; size: number; color: string }) {
  const digits = value.replace("%", "");
  return (
    <div tw="flex items-start" style={{ color }}>
      <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: Math.round(size * 0.42), lineHeight: 1, marginTop: Math.round(size * 0.08), marginRight: Math.round(size * 0.04) }}>%</span>
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1 }}>{digits}</span>
    </div>
  );
}

function BoxTitle({ text, accentHex, k, maxWidth }: { text: string; accentHex: string; k: number; maxWidth: number }) {
  const upper = text.toLocaleUpperCase("tr-TR");
  const size = fitFontSize(upper, maxWidth, px(21, k), 0.66, px(14, k));
  return <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: size * 0.1, color: accentHex }}>{upper}</span>;
}

/** Açık kutu: başlık · büyük yüzde(ler) · gerekçe. Üç taraflı (1X2/ilk yarı) ya da tek sonuçlu. */
export function OpenBox({ box, slot, card, g, id, layer, only }: { box: VitrinOpenBox; slot: BlockSlot; card: VitrinCard; g: VitrinGeometry; id: "open-1" | "open-2"; layer: VitrinLayer; only: BlockFilter }) {
  const { k } = g;
  const width = g.stackRight - g.stackLeft;
  const pad = px(24, k);
  const inner = width - 2 * pad;
  const triple = box.lines.length === 3;
  const valueSize = px(triple ? 66 : 78, k);
  const reasonSize = px(21, k);
  return (
    <div
      tw="absolute flex flex-col"
      style={{ left: g.stackLeft, top: slot.top, width, height: slot.height, padding: `${px(20, k)}px ${pad}px`, backgroundColor: PANEL_BG, border: `1px solid ${PANEL_BORDER}`, borderLeft: `${px(5, k)}px solid ${card.accentHex}`, borderRadius: px(16, k), opacity: visible(layer, only, id) }}
    >
      <BoxTitle text={box.title} accentHex={card.accentHex} k={k} maxWidth={inner} />
      {triple ? (
        <div tw="flex justify-between" style={{ marginTop: px(14, k) }}>
          {box.lines.map((line) => (
            <div key={line.label} tw="flex flex-col" style={{ width: inner / 3 }}>
              <Percent value={line.value} size={valueSize} color={line.picked ? card.accentHex : "rgba(255,255,255,0.88)"} />
              <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: px(17, k), lineHeight: 1.1, marginTop: px(6, k), color: "rgba(255,255,255,0.8)", letterSpacing: px(1, k) }}>
                {line.label.toLocaleUpperCase("tr-TR")}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div tw="flex items-end" style={{ marginTop: px(12, k) }}>
          <Percent value={box.lines[0]?.value ?? ""} size={valueSize} color={card.accentHex} />
          <span style={{ fontFamily: DISPLAY, fontSize: px(40, k), lineHeight: 1, color: "#fff", marginLeft: px(14, k), marginBottom: px(4, k) }}>{box.lines[0]?.label.toLocaleUpperCase("tr-TR")}</span>
        </div>
      )}
      <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: reasonSize, lineHeight: 1.3, marginTop: px(12, k), color: "rgba(255,255,255,0.92)", maxWidth: inner }}>{box.reason}</span>
    </div>
  );
}

function LockIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="10.5" width="16" height="11" rx="2.5" fill={color} />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Üç kilitli kutu yan yana: başlık açık, cevap alanı bulanık (yer tutucu katmanı) + kilit ikonu. */
export function LockedRow({ card, g, layer, only }: { card: VitrinCard; g: VitrinGeometry; layer: VitrinLayer; only: BlockFilter }) {
  const { k } = g;
  const gap = px(14, k);
  const width = g.stackRight - g.stackLeft;
  const boxWidth = (width - 2 * gap) / 3;
  const pad = px(16, k);
  const titleSize = px(17, k);
  const answerHeight = px(40, k);
  const mainOpacity = layer === "placeholder" ? 0 : blockOpacity(only, "locked");
  return (
    <div tw="absolute flex" style={{ left: g.stackLeft, top: g.locked.top, width, height: g.locked.height }}>
      {card.locked.map((title, index) => (
        <div
          key={title}
          tw="relative flex flex-col justify-between"
          style={{ width: boxWidth, height: g.locked.height, marginLeft: index === 0 ? 0 : gap, padding: pad, borderRadius: px(14, k), backgroundColor: layer === "placeholder" ? "transparent" : PANEL_BG, border: `1px solid ${layer === "placeholder" ? "transparent" : PANEL_BORDER}`, opacity: layer === "placeholder" ? 1 : mainOpacity }}
        >
          <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: titleSize, lineHeight: 1.2, color: "#fff", opacity: layer === "placeholder" ? 0 : 1 }}>{title}</span>
          <div tw="flex items-center justify-between" style={{ height: answerHeight }}>
            <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: px(22, k), color: "rgba(255,255,255,0.9)", opacity: layer === "placeholder" ? 1 : 0 }}>{LOCKED_PLACEHOLDER}</span>
            <div tw="flex" style={{ opacity: layer === "placeholder" ? 0 : 1 }}>
              <LockIcon size={px(24, k)} color={card.accentHex} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Hook({ card, g, layer, only }: { card: VitrinCard; g: VitrinGeometry; layer: VitrinLayer; only: BlockFilter }) {
  const { k } = g;
  const width = g.stackRight - g.stackLeft;
  const [first, second] = card.hook;
  const size = Math.min(px(23, k), fitFontSize(second, width, px(23, k), 0.53, px(12, k)));
  const text = { fontFamily: BODY, fontWeight: 600, fontSize: size, lineHeight: 1.3, textShadow: TEXT_SHADOW };
  return (
    <div tw="absolute flex flex-col justify-center" style={{ left: g.stackLeft, top: g.hook.top, width, height: g.hook.height, opacity: visible(layer, only, "hook") }}>
      <span style={{ ...text, color: "#fff" }}>{first}</span>
      <span style={{ ...text, color: card.accentHex }}>{second}</span>
    </div>
  );
}
