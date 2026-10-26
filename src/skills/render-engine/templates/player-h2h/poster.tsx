import { STAT_META } from "@/lib/player-h2h/stats";
import type { H2HCard, H2HPlayerCard, H2HRow } from "@/types/player-h2h";
import { blockOpacity, type BlockFilter } from "../checkmatch-set/blocks";
import { SetFooter, SetHeader } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";
import { PosterShade } from "../vitrin/poster";
import { MUTED, TEXT_SHADOW } from "../vitrin/parts";
import { H2H_SIZES, heroRow, type H2HPosterGeometry } from "./geometry";
import { StatValue, upperLabel, valueColor } from "./parts";

/**
 * 01 KARŞILAŞTIRMA — vitrin posteriyle aynı dil: iki oyuncunun arşiv fotoğrafı çapraz bölünmüş
 * (sanat katmanı, motor), takım renginde ışık. Alttan yukarı: künye ← tek satır olgu ← 3 kahraman
 * (dev rakamlar karşılıklı; önde olan takım renginde, geride olan soluk; 90 dk modunda altında gerçek toplam) ← adalet etiketi ← adlar
 * (logo · küçük ilk ad · büyük soyad · takım · mevki). Hiyerarşi: kahraman > ad > etiket.
 */

function PlayerName({ player, width, k, align }: { player: H2HPlayerCard; width: number; k: number; align: "left" | "right" }) {
  const s = H2H_SIZES;
  const size = fitFontSize(player.name, width, px(s.name, k), 0.47, px(40, k));
  // Alt satır yarıya sığar (uzun takım adı: "BORUSSIA MÖNCHENGLADBACH · FORVET"); harf aralığı 0,2 em.
  const subtitleSize = fitFontSize(player.subtitle, width, px(s.subtitle, k), 0.82, px(11, k));
  const small = { fontFamily: BODY, fontWeight: 700, lineHeight: 1, color: MUTED, textShadow: TEXT_SHADOW };
  const items = align === "left" ? "items-start" : "items-end";
  return (
    <div tw={`flex flex-col ${items}`} style={{ width }}>
      <TeamLogo src={player.teamLogo} name={player.name} size={px(s.teamLogo, k)} />
      <span style={{ ...small, fontSize: px(s.firstName, k), letterSpacing: px(s.firstName, k) * 0.18, marginTop: px(14, k), color: "rgba(255,255,255,0.86)" }}>{player.firstName || " "}</span>
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff", letterSpacing: size * 0.01, marginTop: px(8, k) + px(s.name, k) - size, textShadow: TEXT_SHADOW }}>{player.name}</span>
      <span style={{ ...small, fontSize: subtitleSize, letterSpacing: subtitleSize * 0.2, marginTop: px(12, k) + px(s.subtitle, k) - subtitleSize }}>{player.subtitle}</span>
    </div>
  );
}

function Players({ card, g, only }: { card: H2HCard; g: H2HPosterGeometry; only: BlockFilter }) {
  const width = g.column.right - g.column.left;
  const half = Math.floor((width - px(32, g.k)) / 2);
  return (
    <div tw="absolute flex justify-between" style={{ left: g.column.left, top: g.players.top, width, height: g.players.height, opacity: blockOpacity(only, "players") }}>
      <PlayerName player={card.left} width={half} k={g.k} align="left" />
      <PlayerName player={card.right} width={half} k={g.k} align="right" />
    </div>
  );
}

function HeroRow({ row, card, width, height, k }: { row: H2HRow; card: H2HCard; width: number; height: number; k: number }) {
  const labelWidth = px(260, k);
  const valueWidth = Math.floor((width - labelWidth) / 2);
  const longest = Math.max(row.leftText.length, row.rightText.length);
  const size = Math.min(px(H2H_SIZES.hero, k), fitFontSize("0".repeat(longest), valueWidth - px(16, k), px(H2H_SIZES.hero, k), 0.5, px(48, k)));
  const captionSize = px(H2H_SIZES.heroCaption, k);
  const value = (text: string, total: string | null, color: string, align: "flex-start" | "flex-end") => (
    <div tw="flex flex-col" style={{ width: valueWidth, height, alignItems: align, justifyContent: "flex-start" }}>
      <div tw="flex items-center" style={{ height: px(H2H_SIZES.hero, k) }}>
        <StatValue text={text} size={size} color={color} shadow={TEXT_SHADOW} />
      </div>
      {/* 90 dk modunda gerçek sezon toplamı — skor gibi okunmasın diye her değerin kendi altında. */}
      {total ? <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: captionSize, lineHeight: 1, letterSpacing: captionSize * 0.16, color: MUTED, marginTop: px(H2H_SIZES.heroCaptionGap, k) }}>{`TOPLAM ${total}`}</span> : null}
    </div>
  );
  const labelSize = px(H2H_SIZES.heroLabel, k);
  return (
    <div tw="flex items-center" style={{ width, height }}>
      {value(row.leftText, row.totals?.left ?? null, valueColor(row, "LEFT", card.left.hex), "flex-start")}
      <div tw="flex flex-col items-center justify-center" style={{ width: labelWidth, height: px(H2H_SIZES.hero, k), alignSelf: "flex-start" }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: labelSize, lineHeight: 1, letterSpacing: labelSize * 0.16, color: "#fff" }}>{upperLabel(STAT_META[row.key].short)}</span>
      </div>
      {value(row.rightText, row.totals?.right ?? null, valueColor(row, "RIGHT", card.right.hex), "flex-end")}
    </div>
  );
}

function Hero({ card, g, only }: { card: H2HCard; g: H2HPosterGeometry; only: BlockFilter }) {
  const { k } = g;
  const s = H2H_SIZES;
  const width = g.column.right - g.column.left;
  const rowHeight = px(heroRow(), k);
  const labelSize = px(s.modeLabel, k);
  return (
    <div tw="absolute flex flex-col items-center" style={{ left: g.column.left, top: g.modeLabel.top, width, opacity: blockOpacity(only, "hero") }}>
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: labelSize, lineHeight: 1, letterSpacing: labelSize * 0.24, color: MUTED }}>{card.modeLabel}</span>
      <div tw="flex flex-col" style={{ marginTop: g.hero.top - g.modeLabel.top - g.modeLabel.height }}>
        {card.hero.map((row, index) => (
          <div key={row.key} tw="flex" style={{ marginTop: index === 0 ? 0 : px(s.heroGap, k) }}>
            <HeroRow row={row} card={card} width={width} height={rowHeight} k={k} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Fact({ card, g, only }: { card: H2HCard; g: H2HPosterGeometry; only: BlockFilter }) {
  if (!card.fact) return null;
  const width = g.column.right - g.column.left;
  const size = fitFontSize(card.fact, width, px(30, g.k), 0.5, px(18, g.k));
  return (
    <div tw="absolute flex items-center justify-center" style={{ left: g.column.left, top: g.fact.top, width, height: g.fact.height, opacity: blockOpacity(only, "fact") }}>
      <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: size, lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW }}>{card.fact}</span>
    </div>
  );
}

export function H2HPosterTemplate({ card, g, only }: { card: H2HCard; g: H2HPosterGeometry; only?: BlockFilter }) {
  const s = H2H_SIZES;
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <PosterShade g={g} only={only} />
      <SetHeader card={{ pageLabel: card.pageLabels[0], dateLabel: card.dateLabel, accentHex: card.accentHex }} box={g.box} k={g.k} only={only} />
      <Players card={card} g={g} only={only} />
      <Hero card={card} g={g} only={only} />
      <Fact card={card} g={g} only={only} />
      <SetFooter card={{ competitionLabel: card.scopeLabel, roundLabel: card.matchLabel, brandLogo: card.brandLogo }} box={g.box} size={px(s.footerSize, g.k)} logoHeight={px(s.logoHeight, g.k)} only={only} />
    </div>
  );
}

