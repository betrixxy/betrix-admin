import type { DrawAllCard, DrawCard, DrawTeamCard } from "@/types/draw";
import { STACK_LAYERS, blockOpacity, layerOpacity, stackLayer, unlayered, type BlockFilter } from "../checkmatch-set/blocks";
import { SetFooter, SetHeader } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";
import { DRAW_SIZES, type DrawListGeometry } from "./geometry";
import { alpha, ListTitle, MUTED } from "./parts";

/**
 * C · TÜM EŞLEŞMELER (eleme turu) — liste: "logo AD — AD logo", ilk yazılan ilk maçın ev sahibi. Dikeyde
 * tek sütun (16'ya kadar), 16:9'da 8'den fazlaysa iki sütun. Türk takımının satırı vurgu renginde ince
 * bant + sol çizgi (tek çerçeve istisnası).
 */

function Side({ team, width, size, logo, align }: { team: DrawTeamCard; width: number; size: number; logo: number; align: "left" | "right" }) {
  const nameSize = fitFontSize(team.name, width - logo - 12, size, 0.47, Math.round(size * 0.5));
  return (
    <div tw="flex items-center" style={{ width, flexDirection: align === "left" ? "row-reverse" : "row", justifyContent: "flex-start" }}>
      <TeamLogo src={team.logo} name={team.name} size={logo} />
      <span style={{ fontFamily: DISPLAY, fontSize: nameSize, lineHeight: 1, color: "#fff", margin: align === "left" ? "0 12px 0 0" : "0 0 0 12px" }}>{team.name}</span>
    </div>
  );
}

export function DrawAllTemplate({ card, body, g, only }: { card: DrawCard; body: DrawAllCard; g: DrawListGeometry; only?: BlockFilter }) {
  const { k } = g;
  const s = DRAW_SIZES;
  const width = g.box.right - g.box.left;
  const columns = g.frame.orientation === "landscape" && body.ties.length > 8 ? 2 : 1;
  const perColumn = Math.ceil(body.ties.length / columns);
  const columnGap = px(40, k);
  const columnWidth = Math.floor((width - (columns - 1) * columnGap) / columns);
  const rowHeight = Math.min(Math.floor(g.body.height / Math.max(1, perColumn)), px(84, k));
  const center = px(56, k);
  const sideWidth = Math.floor((columnWidth - center - px(24, k)) / 2);
  const logo = Math.min(px(48, k), Math.round(rowHeight * 0.62));
  const nameSize = Math.min(px(38, k), Math.round(rowHeight * 0.5));
  // Satırlar sırayla iki mürekkep katmanında: alt alta adların kuyruk/nokta yakınlığı kapıda denetlenir.
  const column = (ties: DrawAllCard["ties"]) => (
    <div tw="flex flex-col" style={{ width: columnWidth }}>
      {ties.map((tie, index) => (
        <div key={`${tie.first.id}-${tie.second.id}`} tw="relative flex items-center" style={{ height: rowHeight, paddingLeft: px(12, k) + 4, paddingRight: px(12, k), backgroundColor: tie.highlight ? alpha(card.accentHex, 0.14) : "transparent" }}>
          {/* Türk takımı satırının sol çizgisi süstür: katman ölçülürken gizli (bitişik vurgulu satırların çizgileri değmesin). */}
          {tie.highlight ? <div tw="absolute flex" style={{ left: 0, top: 0, width: px(4, k), height: rowHeight, backgroundColor: card.accentHex, opacity: unlayered(only) }} /> : null}
          <div tw="flex items-center" style={{ opacity: layerOpacity(only, stackLayer(index)) }}>
            <Side team={tie.first} width={sideWidth} size={nameSize} logo={logo} align="left" />
            <div tw="flex justify-center" style={{ width: center }}>
              <span style={{ fontFamily: BODY, fontWeight: 300, fontSize: Math.round(nameSize * 0.8), lineHeight: 1, color: card.accentHex }}>–</span>
            </div>
            <Side team={tie.second} width={sideWidth} size={nameSize} logo={logo} align="right" />
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: MUTED }}>
      <SetHeader card={{ pageLabel: card.pageLabels[0], dateLabel: card.dateLabel, accentHex: card.accentHex }} box={g.box} k={k} only={only} />
      <ListTitle title={body.title} subtitle="İLK YAZILAN İLK MAÇIN EV SAHİBİ" accent={card.accentHex} g={g} only={only} />
      <div tw="absolute flex" style={{ left: g.box.left, top: g.body.top, width, opacity: blockOpacity(only, "draw-list", STACK_LAYERS) }}>
        {column(body.ties.slice(0, perColumn))}
        {columns === 2 ? <div tw="flex" style={{ width: columnGap }} /> : null}
        {columns === 2 ? column(body.ties.slice(perColumn)) : null}
      </div>
      <SetFooter card={{ competitionLabel: card.footerLine, roundLabel: "", brandLogo: card.brandLogo }} box={g.box} size={px(s.footerSize, k)} logoHeight={px(s.logoHeight, k)} only={only} />
    </div>
  );
}
