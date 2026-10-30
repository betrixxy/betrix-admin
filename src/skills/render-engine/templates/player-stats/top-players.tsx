import type { TopPlayerRow, TopPlayersCard } from "@/types/player-match-stats";
import { blockOpacity, layerOpacity, stackLayer, STACK_LAYERS, unlayered, type BlockFilter } from "../checkmatch-set/blocks";
import { BODY, DISPLAY, DISPLAY_DESCENT_EM, TeamLogo, fitFontSize, px } from "../match-day/shared";
import { MUTED, TEXT_SHADOW } from "../vitrin/parts";
import { PLAYER_SIZES, type TopPlayersGeometry } from "./geometry";
import { PlayerFooter, PlayerFootnote, PlayerHeader } from "./parts";

/**
 * B · MAÇIN EN İYİLERİ — iki takımdan en yüksek puanlı 3 ya da 5 oyuncu (≥ 30 dk). Satır: sıra (vurgu) ·
 * vesikalık portre (yoksa takım logosu) · ad / "TAKIM · 3 gol · 1 asist" · puan; altında takım renginde puan
 * çubuğu (puan / 10). Zemin motorda: carousel'de 01'in bulanık hâli, tek başına programatik. Satırlar
 * sabit yükseklikte (`rowHeight`), alt alta satırların ad ve alt satırı mürekkep katmanıdır.
 */

const TRACK = "rgba(255,255,255,0.12)";

function Row({ row, card, g, index, only }: { row: TopPlayerRow; card: TopPlayersCard; g: TopPlayersGeometry; index: number; only: BlockFilter }) {
  const { k, panel, rowHeight: h } = g;
  const width = panel.right - panel.left;
  const rankWidth = Math.round(h * 0.38);
  const portrait = Math.min(Math.round(h * 0.7), px(150, k));
  const ratingSize = Math.min(Math.round(h * 0.42), px(84, k));
  const ratingWidth = Math.round(ratingSize * 0.5 * 3) + px(8, k);
  const gap = Math.round(h * 0.12);
  const textWidth = width - rankWidth - portrait - ratingWidth - gap * 3;
  const nameSize = fitFontSize(row.name, textWidth, Math.min(Math.round(h * 0.32), px(56, k)), 0.47, 16);
  const sub = [row.teamName, row.highlight].filter(Boolean).join(" · ");
  // Alt satır en az 12 px (16:9 beşli listede satır ≈ 67 px).
  const subSize = fitFontSize(sub, textWidth, Math.max(12, Math.min(Math.round(h * 0.16), px(22, k))), 0.74, 10);
  const bar = Math.max(4, Math.round(h * 0.035));
  const fill = Math.round(textWidth * Math.min(1, Math.max(0, row.rating / 10)));
  return (
    <div tw="flex items-center" style={{ width, height: h }}>
      <span style={{ fontFamily: DISPLAY, fontSize: Math.round(h * 0.34), lineHeight: 1, color: card.accentHex, width: rankWidth, opacity: unlayered(only) }}>{String(row.rank)}</span>
      <div tw="flex items-center justify-center" style={{ width: portrait, height: portrait, borderRadius: portrait / 2, overflow: "hidden", border: `2px solid ${row.teamHex}`, backgroundColor: "rgba(255,255,255,0.06)", opacity: unlayered(only) }}>
        {row.portrait ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
          <img src={row.portrait} alt="" width={portrait} height={portrait} style={{ objectFit: "cover" }} />
        ) : (
          <TeamLogo src={row.teamLogo} name={row.teamName} size={Math.round(portrait * 0.62)} />
        )}
      </div>
      <div tw="flex flex-col justify-center" style={{ width: textWidth, marginLeft: gap, marginRight: gap }}>
        <span style={{ fontFamily: DISPLAY, fontSize: nameSize, lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW, opacity: layerOpacity(only, stackLayer(index * 2)) }}>{row.name}</span>
        <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: subSize, lineHeight: 1, letterSpacing: subSize * 0.1, color: MUTED, marginTop: Math.round(nameSize * DISPLAY_DESCENT_EM) + px(8, k), opacity: layerOpacity(only, stackLayer(index * 2 + 1)) }}>{sub}</span>
        <div tw="flex" style={{ width: textWidth, height: bar, marginTop: Math.round(h * 0.07), backgroundColor: TRACK, borderRadius: bar / 2, opacity: unlayered(only) }}>
          <div tw="flex" style={{ width: fill, height: bar, backgroundColor: row.teamHex, borderRadius: bar / 2 }} />
        </div>
      </div>
      <span style={{ fontFamily: DISPLAY, fontSize: ratingSize, lineHeight: 1, color: "#fff", width: ratingWidth, textAlign: "right", marginLeft: gap, textShadow: TEXT_SHADOW, opacity: unlayered(only) }}>{row.ratingText}</span>
    </div>
  );
}

function Title({ card, g, only }: { card: TopPlayersCard; g: TopPlayersGeometry; only: BlockFilter }) {
  const width = g.panel.right - g.panel.left;
  const size = fitFontSize(card.title, width, px(PLAYER_SIZES.title, g.k), 0.47, px(36, g.k));
  return (
    <div tw="absolute flex items-start" style={{ left: g.panel.left, top: g.title.top, width, height: g.title.height, opacity: blockOpacity(only, "title") }}>
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff", letterSpacing: size * 0.01, textShadow: TEXT_SHADOW }}>{card.title}</span>
    </div>
  );
}

export function TopPlayersTemplate({ card, g, only }: { card: TopPlayersCard; g: TopPlayersGeometry; only?: BlockFilter }) {
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <PlayerHeader card={card} g={g} only={only} />
      <Title card={card} g={g} only={only} />
      <div tw="absolute flex flex-col" style={{ left: g.panel.left, top: g.rowsArea.top, width: g.panel.right - g.panel.left, height: g.rowsArea.height, opacity: blockOpacity(only, "card-body", STACK_LAYERS) }}>
        {card.rows.map((row, index) => (
          <Row key={row.playerId} row={row} card={card} g={g} index={index} only={only} />
        ))}
      </div>
      <PlayerFootnote card={card} g={g} only={only} />
      <PlayerFooter card={card} g={g} only={only} />
    </div>
  );
}
