import type { VitrinCard } from "@/types/vitrin";
import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { hexAlpha } from "../checkmatch-set/set-parts";
import { BODY, fitFontSize, px } from "../match-day/shared";
import type { AnalysisGeometry } from "./geometry";
import { LockIcon, MUTED } from "./parts";

/**
 * Kilitli bölüm — "bilet": koyu zemin, üst/alt kenar tırtıklı (perforasyon), solda kilitli koçan,
 * kesik çizgi, sağda üç senaryo başlığı AÇIK; cevap yerine kasıtlı "• • •" (gerçek değer kartta yok,
 * bulanık sahte metin de yok). Köşede "+{N−2} senaryo" rozeti.
 */

export const LOCKED_ANSWER = "• • •";

const TICKET_FILL = "#0B0C12";

/** Bilet çerçevesi: üst ve alt kenarda küçük yarım daire ısırıkları, koçan hizasında büyük çentik. */
function ticketPath(width: number, height: number, stub: number, bite: number, notch: number, step: number): string {
  const edge = (y: number, direction: 1 | -1) => {
    // direction 1: soldan sağa (üst kenar), −1: sağdan sola (alt kenar). sweep 0 → ısırık iki kenarda da içe doğru.
    const parts: string[] = [];
    const xs: number[] = [];
    for (let x = step; x < width - step / 2; x += step) if (Math.abs(x - stub) > notch + bite * 2) xs.push(x);
    const stops = [...xs.map((x) => ({ x, r: bite })), { x: stub, r: notch }].sort((a, b) => a.x - b.x);
    const ordered = direction === 1 ? stops : stops.reverse();
    for (const { x, r } of ordered) {
      const from = x - direction * r;
      const to = x + direction * r;
      parts.push(`L ${from} ${y} A ${r} ${r} 0 0 0 ${to} ${y}`);
    }
    return parts.join(" ");
  };
  return `M 0 0 ${edge(0, 1)} L ${width} 0 L ${width} ${height} ${edge(height, -1)} L 0 ${height} Z`;
}

export function LockedTicket({ card, g, only }: { card: VitrinCard; g: AnalysisGeometry; only: BlockFilter }) {
  const { k } = g;
  const column = g.columns.locked;
  const width = column.right - column.left;
  const height = g.locked.height;
  const stub = px(150, k);
  const pad = px(30, k);
  const mainWidth = width - stub - 2 * pad;
  const answerWidth = px(96, k);
  const rowHeight = Math.round((height - 2 * pad - px(40, k)) / 3);
  const badgeSize = px(20, k);
  return (
    <div tw="absolute flex" style={{ left: column.left, top: g.locked.top, width, height, opacity: blockOpacity(only, "locked") }}>
      <svg style={{ position: "absolute", left: 0, top: 0 }} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <path d={ticketPath(width, height, stub, px(7, k), px(16, k), px(26, k))} fill={TICKET_FILL} stroke="rgba(255,255,255,0.12)" strokeWidth={1.5} />
        <line x1={stub} y1={px(22, k)} x2={stub} y2={height - px(22, k)} stroke="rgba(255,255,255,0.22)" strokeWidth={2} strokeDasharray={`${px(8, k)} ${px(8, k)}`} />
      </svg>
      <div tw="absolute flex flex-col items-center justify-center" style={{ left: 0, top: 0, width: stub, height }}>
        <LockIcon size={px(54, k)} color={card.accentHex} />
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: px(15, k), letterSpacing: px(3, k), color: MUTED, marginTop: px(14, k) }}>KİLİTLİ</span>
      </div>
      <div tw="absolute flex flex-col" style={{ left: stub + pad, top: pad, width: mainWidth }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: px(17, k), lineHeight: 1, letterSpacing: px(3, k), color: MUTED, height: px(40, k) }}>KİLİTLİ SENARYOLAR</span>
        {card.locked.map((title, index) => {
          // Geist Bold küçük harf ≈ 0,55 em; NBSP satırı bölünmediği için tahmin bir pay daha geniş tutulur.
          const size = fitFontSize(title, mainWidth - answerWidth - px(16, k), px(27, k), 0.62, px(14, k));
          return (
            <div key={title} tw="flex items-center justify-between" style={{ height: rowHeight, borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, lineHeight: 1.15, color: "#fff", maxWidth: mainWidth - answerWidth - px(16, k) }}>{title}</span>
              <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: px(26, k), lineHeight: 1, color: card.accentHex, width: answerWidth, textAlign: "right" }}>{LOCKED_ANSWER}</span>
            </div>
          );
        })}
      </div>
      {card.hiddenCount > 0 ? (
        <div
          tw="absolute flex items-center"
          style={{ right: px(26, k), top: -Math.round(badgeSize * 0.9), height: Math.round(badgeSize * 1.9), padding: `0 ${px(16, k)}px`, borderRadius: badgeSize, backgroundColor: card.accentHex, boxShadow: `0 0 ${px(18, k)}px ${hexAlpha(card.accentHex, 0.4)}` }}
        >
          <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: badgeSize, lineHeight: 1, color: "#0B0C12" }}>+{card.hiddenCount} senaryo</span>
        </div>
      ) : null}
    </div>
  );
}
