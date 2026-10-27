import type { DrawCard, DrawLeagueCarousel } from "@/types/draw";
import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { SetFooter, SetHeader } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";
import { DRAW_SIZES, type DrawListGeometry } from "./geometry";
import { Caps, ListTitle, MUTED } from "./parts";

/**
 * A · lig aşaması 02 RAKİPLER — N rakip ızgarası (dikeyde 2 sütun, 16:9'da 4 sütun): logo, ad, İÇ SAHA /
 * DEPLASMAN (iç saha vurgu renginde), torba (biliniyorsa), tarih (biliniyorsa). Zemin posterin bulanık hâli.
 */

export function DrawGridTemplate({ card, body, g, only }: { card: DrawCard; body: DrawLeagueCarousel; g: DrawListGeometry; only?: BlockFilter }) {
  const { k } = g;
  const s = DRAW_SIZES;
  const width = g.box.right - g.box.left;
  const columns = g.frame.orientation === "landscape" ? 4 : 2;
  const rows = Math.max(1, Math.ceil(body.cells.length / columns));
  const gap = px(28, k);
  const cellWidth = Math.floor((width - (columns - 1) * gap) / columns);
  const cellHeight = Math.min(Math.floor((g.body.height - (rows - 1) * px(18, k)) / rows), px(190, k));
  const logo = Math.min(px(88, k), Math.round(cellHeight * 0.6));
  const nameWidth = cellWidth - logo - px(20, k);
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: MUTED }}>
      <SetHeader card={{ pageLabel: card.pageLabels[1] ?? "02 · RAKİPLER", dateLabel: card.dateLabel, accentHex: card.accentHex }} box={g.box} k={k} only={only} />
      <ListTitle title={body.team.name} subtitle={body.summary} accent={card.accentHex} g={g} only={only} />
      <div tw="absolute flex flex-wrap" style={{ left: g.box.left, top: g.body.top, width, height: g.body.height, alignContent: "flex-start", opacity: blockOpacity(only, "draw-list") }}>
        {body.cells.map((cell, index) => {
          const size = fitFontSize(cell.opponent.name, nameWidth, px(40, k), 0.47, px(16, k));
          const meta = [cell.potLabel, cell.dateLabel].filter(Boolean);
          // Yer · torba · tarih satırı hücreye sığar (iki parça aynı boyutta).
          const metaSize = fitFontSize([cell.venueLabel, ...meta].join("  ·  "), nameWidth, px(17, k), 0.9, px(10, k));
          return (
            <div key={cell.opponent.id} tw="flex items-center" style={{ width: cellWidth, height: cellHeight, marginLeft: index % columns === 0 ? 0 : gap, marginTop: index < columns ? 0 : px(18, k) }}>
              <TeamLogo src={cell.opponent.logo} name={cell.opponent.name} size={logo} />
              <div tw="flex flex-col" style={{ marginLeft: px(20, k), width: nameWidth }}>
                <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff" }}>{cell.opponent.name}</span>
                <div tw="flex items-center" style={{ marginTop: px(10, k) }}>
                  <Caps text={cell.venueLabel} size={metaSize} color={cell.venue === "HOME" ? card.accentHex : "rgba(255,255,255,0.8)"} weight={900} />
                  {meta.length ? <Caps text={`  ·  ${meta.join("  ·  ")}`} size={metaSize} /> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <SetFooter card={{ competitionLabel: card.footerLine, roundLabel: "", brandLogo: card.brandLogo }} box={g.box} size={px(s.footerSize, k)} logoHeight={px(s.logoHeight, k)} only={only} />
    </div>
  );
}
