import { groupRows } from "@/lib/player-h2h/rows";
import type { H2HCard, H2HPlayerCard, H2HRow } from "@/types/player-h2h";
import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { SetFooter, SetHeader } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";
import { MUTED } from "../vitrin/parts";
import { H2H_SIZES, chartContentHeight, chartRowHeight, type H2HCompareGeometry } from "./geometry";
import { LOSER_BAR, StatValue, TIE_BAR, upperLabel, valueColor } from "./parts";

/**
 * 02 İSTATİSTİKLER — yayıncı "kelebek" grafiği: ortada istatistik adı, solda/sağda değer, çubuklar
 * ortadan dışa (uzunluk iki değerin büyüğüne oranla). Kazanan değer kalın ve takım renginde, kaybeden
 * soluk. Grup başlıkları (HÜCUM · YARATICILIK · PAS · TOP KAZANMA). Üstte küçük yüzler ve adlar (kim
 * solda, kim sağda), altta dipnot. Kutu/panel çerçevesi yok; zemin posterin bulanık hâli (motor).
 */

function Face({ player, k, align }: { player: H2HPlayerCard; k: number; align: "left" | "right" }) {
  const size = px(H2H_SIZES.face, k);
  // İnce halka, takım renginde.
  const ring = Math.max(2, px(2.5, k));
  const nameSize = fitFontSize(player.name, px(330, k), px(46, k), 0.47, px(24, k));
  const photo = player.face ? (
    // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
    <img src={player.face} alt="" width={size - 2 * ring - 2} height={size - 2 * ring - 2} style={{ borderRadius: size, objectFit: "cover" }} />
  ) : (
    <TeamLogo src={player.teamLogo} name={player.name} size={Math.round(size * 0.62)} />
  );
  const text = (
    <div tw="flex flex-col" style={{ alignItems: align === "left" ? "flex-start" : "flex-end", margin: align === "left" ? `0 0 0 ${px(22, k)}px` : `0 ${px(22, k)}px 0 0` }}>
      <span style={{ fontFamily: DISPLAY, fontSize: nameSize, lineHeight: 1, color: "#fff" }}>{player.name}</span>
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: px(17, k), lineHeight: 1, letterSpacing: px(17, k) * 0.18, color: MUTED, marginTop: px(12, k) }}>{player.sampleLine}</span>
    </div>
  );
  const circle = (
    <div tw="flex items-center justify-center" style={{ width: size, height: size, borderRadius: size, border: `${ring}px solid ${player.hex}`, backgroundColor: "rgba(7,8,12,0.55)" }}>
      {photo}
    </div>
  );
  return (
    <div tw="flex items-center" style={{ flexDirection: align === "left" ? "row" : "row-reverse" }}>
      {circle}
      {text}
    </div>
  );
}

function Faces({ card, g, only }: { card: H2HCard; g: H2HCompareGeometry; only: BlockFilter }) {
  return (
    <div tw="absolute flex items-center justify-between" style={{ left: g.box.left, top: g.faces.top, width: g.box.right - g.box.left, height: g.faces.height, opacity: blockOpacity(only, "faces") }}>
      <Face player={card.left} k={g.k} align="left" />
      <Face player={card.right} k={g.k} align="right" />
    </div>
  );
}

function Bar({ value, max, length, height, color, from }: { value: number; max: number; length: number; height: number; color: string; from: "left" | "right" }) {
  const width = max > 0 && value > 0 ? Math.max(height, Math.round((value / max) * length)) : 0;
  return (
    <div tw="flex" style={{ width: length, height, justifyContent: from === "left" ? "flex-start" : "flex-end" }}>
      <div tw="flex" style={{ width, height, borderRadius: height / 2, backgroundColor: color }} />
    </div>
  );
}

function ButterflyRow({ row, card, width, height, k }: { row: H2HRow; card: H2HCard; width: number; height: number; k: number }) {
  const s = H2H_SIZES;
  const label = px(s.labelColumn, k);
  const valueWidth = px(s.valueWidth, k);
  const gap = px(18, k);
  const barLength = Math.floor((width - label - 2 * valueWidth - 4 * gap) / 2);
  const barHeight = px(s.bar, k);
  const max = Math.max(row.left, row.right);
  const valueSize = Math.min(Math.round(height * 0.62), px(34, k));
  const value = (text: string, side: "LEFT" | "RIGHT", hex: string) => {
    return (
      <div tw="flex items-center" style={{ width: valueWidth, height, justifyContent: side === "LEFT" ? "flex-start" : "flex-end" }}>
        <StatValue text={text} size={valueSize} color={valueColor(row, side, hex)} percentScale={0.62} />
      </div>
    );
  };
  const barColor = (side: "LEFT" | "RIGHT", hex: string) => (row.winner === side ? hex : row.winner === "TIE" ? TIE_BAR : LOSER_BAR);
  const labelSize = fitFontSize(upperLabel(row.label), label - px(12, k), px(19, k), 0.72, px(13, k));
  return (
    <div tw="flex items-center" style={{ width, height }}>
      {value(row.leftText, "LEFT", card.left.hex)}
      <div tw="flex" style={{ width: gap }} />
      <Bar value={row.left} max={max} length={barLength} height={barHeight} color={barColor("LEFT", card.left.hex)} from="right" />
      <div tw="flex items-center justify-center" style={{ width: label + 2 * gap, height }}>
        <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: labelSize, lineHeight: 1, letterSpacing: labelSize * 0.1, color: "rgba(255,255,255,0.9)" }}>{upperLabel(row.label)}</span>
      </div>
      <Bar value={row.right} max={max} length={barLength} height={barHeight} color={barColor("RIGHT", card.right.hex)} from="left" />
      <div tw="flex" style={{ width: gap }} />
      {value(row.rightText, "RIGHT", card.right.hex)}
    </div>
  );
}

function Chart({ card, g, only }: { card: H2HCard; g: H2HCompareGeometry; only: BlockFilter }) {
  const { k } = g;
  const s = H2H_SIZES;
  const width = g.box.right - g.box.left;
  const groups = groupRows(card.rows);
  const rowHeight = chartRowHeight(g, card.rows.length, groups.length) ?? px(s.rowMin, k);
  const labelSize = px(s.groupLabel, k);
  const offset = Math.max(0, Math.floor((g.chart.height - chartContentHeight(g, card.rows.length, groups.length, rowHeight)) / 2));
  return (
    <div tw="absolute flex flex-col" style={{ left: g.box.left, top: g.chart.top + offset, width, opacity: blockOpacity(only, "chart") }}>
      {groups.map((group, index) => (
        <div key={group.group} tw="flex flex-col" style={{ marginTop: index === 0 ? 0 : px(s.groupGap, k) }}>
          <div tw="flex items-center justify-center" style={{ height: labelSize, marginBottom: px(s.groupLabelGap, k) }}>
            <div tw="flex" style={{ width: px(36, k), height: 2, backgroundColor: card.accentHex, marginRight: px(14, k) }} />
            <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: labelSize, lineHeight: 1, letterSpacing: labelSize * 0.3, color: card.accentHex }}>{group.group}</span>
            <div tw="flex" style={{ width: px(36, k), height: 2, backgroundColor: card.accentHex, marginLeft: px(14, k) }} />
          </div>
          {group.rows.map((row) => (
            <ButterflyRow key={row.key} row={row} card={card} width={width} height={rowHeight} k={k} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Footnote({ card, g, only }: { card: H2HCard; g: H2HCompareGeometry; only: BlockFilter }) {
  const width = g.box.right - g.box.left;
  const longest = card.footnotes.reduce((max, line) => Math.max(max, line.length), 0);
  const size = Math.min(px(17, g.k), fitFontSize("x".repeat(longest), width, px(17, g.k), 0.5, px(11, g.k)));
  return (
    <div tw="absolute flex flex-col justify-end" style={{ left: g.box.left, top: g.footnote.top, width, height: g.footnote.height, opacity: blockOpacity(only, "footnote") }}>
      {card.footnotes.map((line, index) => (
        <span key={line} style={{ fontFamily: BODY, fontWeight: 500, fontSize: size, lineHeight: 1, color: "rgba(255,255,255,0.62)", marginTop: index === 0 ? 0 : px(8, g.k) }}>
          {line}
        </span>
      ))}
    </div>
  );
}

export function H2HCompareTemplate({ card, g, only }: { card: H2HCard; g: H2HCompareGeometry; only?: BlockFilter }) {
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <SetHeader card={{ pageLabel: card.pageLabels[1], dateLabel: card.dateLabel, accentHex: card.accentHex }} box={g.box} k={g.k} only={only} />
      <Faces card={card} g={g} only={only} />
      <Chart card={card} g={g} only={only} />
      <Footnote card={card} g={g} only={only} />
      <SetFooter card={{ competitionLabel: card.scopeLabel, roundLabel: card.matchLabel, brandLogo: card.brandLogo }} box={g.box} size={px(H2H_SIZES.footerSize, g.k)} logoHeight={px(H2H_SIZES.logoHeight, g.k)} only={only} />
    </div>
  );
}
