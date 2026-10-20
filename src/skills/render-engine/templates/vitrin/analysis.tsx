import type { MatchResultLetter } from "@/types/sports";
import type { VitrinCard } from "@/types/vitrin";
import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { SetFooter, SetHeader } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";
import { VITRIN_SIZES, type AnalysisColumn, type AnalysisGeometry } from "./geometry";
import { wrapLines } from "../../satori-text";
import { MUTED, Percent, SectionLabel, percentValue } from "./parts";
import { LockedTicket } from "./ticket";

/**
 * 02 ANALİZ — çerçevesiz bilgi blokları: form rehberi (son 5 maç, en yeni sağda), açık kutu 2 (dev
 * yüzde + yarım daire gösterge + ≤10 sözcük gerekçe), 1. kutunun gerekçesi tek satır, kilitli bilet,
 * vurgu renginde tek satır kanca. Zemin posterin bulanık/koyu hâli (motor).
 */

const FORM_COLORS: Record<MatchResultLetter, { fill: string; letter: string }> = {
  W: { fill: "#22C55E", letter: "G" },
  D: { fill: "#8B919C", letter: "B" },
  L: { fill: "#EF4444", letter: "M" },
};
const FORM_SLOTS = 5;

const widthOf = (column: AnalysisColumn) => column.right - column.left;

function FormRow({ name, logo, form, k, width }: { name: string; logo: string | null; form: MatchResultLetter[]; k: number; width: number }) {
  const dot = px(40, k);
  const dotGap = px(12, k);
  const dotsWidth = FORM_SLOTS * dot + (FORM_SLOTS - 1) * dotGap;
  const logoSize = px(42, k);
  const nameWidth = width - dotsWidth - logoSize - px(40, k);
  const size = fitFontSize(name, nameWidth, px(36, k), 0.47, px(22, k));
  // Eksik maç (5'ten az örneklem) solda boş halka: en yeni her zaman en sağda.
  const slots: (MatchResultLetter | null)[] = [...Array<null>(Math.max(0, FORM_SLOTS - form.length)).fill(null), ...form.slice(-FORM_SLOTS)];
  return (
    <div tw="flex items-center justify-between" style={{ width, height: px(VITRIN_SIZES.formRow, k) }}>
      <div tw="flex items-center">
        <TeamLogo src={logo} name={name} size={logoSize} />
        <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff", marginLeft: px(18, k), letterSpacing: size * 0.01 }}>{name}</span>
      </div>
      <div tw="flex items-center">
        {slots.map((letter, index) => (
          <div
            key={index}
            tw="flex items-center justify-center"
            style={{ width: dot, height: dot, borderRadius: dot / 2, marginLeft: index === 0 ? 0 : dotGap, backgroundColor: letter ? FORM_COLORS[letter].fill : "transparent", border: letter ? "none" : "2px solid rgba(255,255,255,0.2)" }}
          >
            {letter ? <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: px(18, k), lineHeight: 1, color: "#0B0C12" }}>{FORM_COLORS[letter].letter}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FormGuide({ card, g, only }: { card: VitrinCard; g: AnalysisGeometry; only: BlockFilter }) {
  const { k } = g;
  const s = VITRIN_SIZES;
  const column = g.columns.form;
  const width = widthOf(column);
  return (
    <div tw="absolute flex flex-col" style={{ left: column.left, top: g.form.top, width, height: g.form.height, opacity: blockOpacity(only, "form") }}>
      <div tw="flex items-center justify-between" style={{ height: px(s.sectionLabel, k), marginBottom: px(s.sectionLabelGap, k) }}>
        <SectionLabel text="Form · son 5 maç" color={card.accentHex} size={px(19, k)} maxWidth={width / 2} />
        <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: px(15, k), letterSpacing: px(2, k), color: MUTED }}>ESKİ → YENİ</span>
      </div>
      <FormRow name={card.homeTeam} logo={card.homeLogo} form={card.homeForm} k={k} width={width} />
      <div tw="flex" style={{ height: px(s.formRowGap, k) }} />
      <FormRow name={card.awayTeam} logo={card.awayLogo} form={card.awayForm} k={k} width={width} />
    </div>
  );
}

/** Yarım daire gösterge: soluk iz + vurgu renginde değer yayı; ortada dev yüzde, altında sonuç. */
function Gauge({ value, label, color, k }: { value: number; label: string; color: string; k: number }) {
  const width = px(360, k);
  const stroke = px(28, k);
  const r = width / 2 - stroke / 2;
  const cx = width / 2;
  const cy = width / 2;
  const angle = Math.PI - (Math.min(100, Math.max(0, value)) / 100) * Math.PI;
  const end = { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
  const height = px(VITRIN_SIZES.gauge, k);
  const size = px(104, k);
  return (
    <div tw="relative flex flex-col items-center" style={{ width, height }}>
      <svg style={{ position: "absolute", left: 0, top: 0 }} width={width} height={cy + stroke} viewBox={`0 0 ${width} ${cy + stroke}`}>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} fill="none" strokeLinecap="round" />
        {value > 0 ? <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" /> : null}
      </svg>
      <div tw="absolute flex justify-center" style={{ left: 0, width, top: cy - size + px(4, k) }}>
        <Percent value={value} size={size} color="#fff" />
      </div>
      <span tw="absolute" style={{ top: cy + stroke / 2 + px(10, k), fontFamily: BODY, fontWeight: 800, fontSize: px(22, k), lineHeight: 1, letterSpacing: px(4, k), color }}>{label.toLocaleUpperCase("tr-TR")}</span>
    </div>
  );
}

function OpenGauge({ card, g, only }: { card: VitrinCard; g: AnalysisGeometry; only: BlockFilter }) {
  const { k } = g;
  const s = VITRIN_SIZES;
  const box = card.open[1];
  const column = g.columns.open;
  const width = widthOf(column);
  const picked = box.lines.find((line) => line.picked) ?? box.lines[0];
  const reasonWidth = g.openStacked ? width : width - px(360 + 48, k);
  const reasonSize = px(g.openStacked ? 28 : 36, k);
  const reason = (
    <div tw="flex flex-col">
      {wrapLines(box.reason, reasonWidth, reasonSize).map((line) => (
        <span key={line} style={{ fontFamily: BODY, fontWeight: 700, fontSize: reasonSize, lineHeight: 1.22, color: "#fff" }}>{line}</span>
      ))}
    </div>
  );
  return (
    <div tw="absolute flex flex-col" style={{ left: column.left, top: g.open.top, width, height: g.open.height, opacity: blockOpacity(only, "open-2") }}>
      <div tw="flex" style={{ height: px(s.sectionLabel, k), marginBottom: px(s.sectionLabelGap, k) }}>
        <SectionLabel text={box.title} color={card.accentHex} size={px(19, k)} maxWidth={width} />
      </div>
      <div tw={g.openStacked ? "flex flex-col" : "flex items-center"}>
        <Gauge value={percentValue(picked?.value ?? "")} label={picked?.label ?? ""} color={card.accentHex} k={k} />
        <div tw="flex" style={g.openStacked ? { marginTop: px(16, k) } : { marginLeft: px(48, k), width: reasonWidth }}>
          {reason}
        </div>
      </div>
    </div>
  );
}

/** 1. kutunun gerekçesi — tek satır, kısa. */
function ReasonLine({ card, g, only }: { card: VitrinCard; g: AnalysisGeometry; only: BlockFilter }) {
  const { k } = g;
  const column = g.columns.reasonLine;
  const width = widthOf(column);
  const label = "KAZANMA";
  const labelSize = px(17, k);
  const labelWidth = Math.round(label.length * labelSize * 0.86) + px(28, k);
  const size = fitFontSize(card.open[0].reason, width - labelWidth, px(25, k), 0.5, px(14, k));
  return (
    <div tw="absolute flex items-center" style={{ left: column.left, top: g.reasonLine.top, width, height: g.reasonLine.height, opacity: blockOpacity(only, "open-1") }}>
      <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: labelSize, letterSpacing: labelSize * 0.16, color: card.accentHex, width: labelWidth }}>{label}</span>
      <span style={{ fontFamily: BODY, fontWeight: 500, fontSize: size, lineHeight: 1, color: "rgba(255,255,255,0.86)" }}>{card.open[0].reason}</span>
    </div>
  );
}

function Hook({ card, g, only }: { card: VitrinCard; g: AnalysisGeometry; only: BlockFilter }) {
  const column = g.columns.hook;
  const width = widthOf(column);
  const size = fitFontSize(card.hookLine, width, px(27, g.k), 0.52, px(14, g.k));
  return (
    <div tw="absolute flex items-center" style={{ left: column.left, top: g.hook.top, width, height: g.hook.height, opacity: blockOpacity(only, "hook") }}>
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, lineHeight: 1, color: card.accentHex }}>{card.hookLine}</span>
    </div>
  );
}

export function AnalysisTemplate({ card, g, only }: { card: VitrinCard; g: AnalysisGeometry; only?: BlockFilter }) {
  const s = VITRIN_SIZES;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <SetHeader card={{ pageLabel: card.pageLabels[1], dateLabel: card.dateLabel, accentHex: card.accentHex }} box={g.box} k={g.k} only={only} />
      <FormGuide card={card} g={g} only={only} />
      <OpenGauge card={card} g={g} only={only} />
      <ReasonLine card={card} g={g} only={only} />
      <LockedTicket card={card} g={g} only={only} />
      <Hook card={card} g={g} only={only} />
      <SetFooter card={card} box={g.box} size={px(s.footerSize, g.k)} logoHeight={px(s.logoHeight, g.k)} only={only} />
    </div>
  );
}
