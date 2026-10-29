import type { PlayerStatRow, SpotlightCard } from "@/types/player-match-stats";
import { blockOpacity, layerOpacity, stackLayer, STACK_LAYERS, unlayered, type BlockFilter } from "../checkmatch-set/blocks";
import { BODY, DISPLAY, DISPLAY_DESCENT_EM, fitFontSize, px } from "../match-day/shared";
import { Shade } from "../match-result/shared";
import { StatValue } from "../player-h2h/parts";
import { MUTED, TEXT_SHADOW } from "../vitrin/parts";
import { PLAYER_SIZES, spotlightRowLines, type SpotlightGeometry } from "./geometry";
import { PlayerFooter, PlayerFootnote, PlayerHeader } from "./parts";

/**
 * A · MAÇIN OYUNCUSU — tam kadraj arşiv fotoğrafı (sanat katmanı motorda: kırpma + tonlama) ya da fotoğraf
 * yoksa TİPOGRAFİK YEDEK (takım renginde zemin + dev ad, zemin motorda). Alttan yukarı: künye ← dipnot ←
 * kompakt satırlar (iki sütun) ← 2–3 kahraman rakam ← tek satır olgu ← dev puan + ad + "TAKIM · MEVKİ · 90 DK".
 * Hiyerarşi: puan > kahraman > ad > satırlar. Tek vurgu rengi (set kuralı): puan, olgu, sayfa numarası.
 */

const DIVIDER = "rgba(255,255,255,0.16)";

function NameBlock({ card, g, only }: { card: SpotlightCard; g: SpotlightGeometry; only: BlockFilter }) {
  const s = PLAYER_SIZES;
  const { k, panel } = g;
  const ratingSize = px(s.rating, k);
  const ratingWidth = Math.round(card.player.ratingText.length * ratingSize * 0.5);
  const gap = px(28, k);
  const width = panel.right - panel.left - ratingWidth - gap;
  const nameSize = fitFontSize(card.player.name, width, px(s.nameMax, k), 0.47, px(s.nameMin, k));
  const metaSize = fitFontSize(card.metaRow, width, px(s.meta, k), 0.78, px(11, k));
  return (
    <div tw="absolute flex items-center" style={{ left: panel.left, top: g.name.top, width: panel.right - panel.left, height: g.name.height, opacity: blockOpacity(only, "players", STACK_LAYERS) }}>
      <span style={{ fontFamily: DISPLAY, fontSize: ratingSize, lineHeight: 1, color: card.accentHex, width: ratingWidth, textShadow: TEXT_SHADOW, opacity: unlayered(only) }}>{card.player.ratingText}</span>
      <div tw="flex flex-col justify-center" style={{ marginLeft: gap, width, height: g.name.height }}>
        {card.typographic ? null : (
          <span style={{ fontFamily: DISPLAY, fontSize: nameSize, lineHeight: 1, color: "#fff", letterSpacing: nameSize * 0.01, textShadow: TEXT_SHADOW, opacity: layerOpacity(only, stackLayer(0)) }}>{card.player.name}</span>
        )}
        {/* Adın Ç/Ş/Ğ kuyruğu (≈0,25 em) alt satıra binmez. */}
        <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: metaSize, lineHeight: 1, letterSpacing: metaSize * 0.16, color: MUTED, marginTop: card.typographic ? 0 : Math.round(nameSize * DISPLAY_DESCENT_EM) + px(s.nameGap, k), textShadow: TEXT_SHADOW, opacity: layerOpacity(only, stackLayer(1)) }}>
          {card.metaRow}
        </span>
      </div>
    </div>
  );
}

function Fact({ card, g, only }: { card: SpotlightCard; g: SpotlightGeometry; only: BlockFilter }) {
  if (!card.fact || !g.fact) return null;
  const width = g.panel.right - g.panel.left;
  const size = fitFontSize(card.fact, width, px(PLAYER_SIZES.fact, g.k), 0.6, px(13, g.k));
  return (
    <div tw="absolute flex items-center" style={{ left: g.panel.left, top: g.fact.top, width, height: g.fact.height, opacity: blockOpacity(only, "fact") }}>
      <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: size * 0.04, color: card.accentHex, textShadow: TEXT_SHADOW }}>{card.fact}</span>
    </div>
  );
}

function Hero({ card, g, only }: { card: SpotlightCard; g: SpotlightGeometry; only: BlockFilter }) {
  if (!g.hero || card.hero.length === 0) return null;
  const s = PLAYER_SIZES;
  const { k, panel } = g;
  const width = panel.right - panel.left;
  const column = Math.floor(width / card.hero.length);
  return (
    <div tw="absolute flex" style={{ left: panel.left, top: g.hero.top, width, height: g.hero.height, opacity: blockOpacity(only, "hero", STACK_LAYERS) }}>
      {card.hero.map((row) => {
        const valueSize = fitFontSize(row.value, column - px(24, k), px(s.heroValue, k), 0.5, px(40, k));
        const labelSize = fitFontSize(row.label, column - px(16, k), px(s.heroLabel, k), 0.78, px(10, k));
        return (
          <div key={row.key} tw="flex flex-col" style={{ width: column }}>
            <div tw="flex items-end" style={{ height: px(s.heroValue, k) }}>
              {/* Yüzdede "%" küçük Geist — Anton'un yüzde glifi "0/o" gibi okunur. */}
              <div tw="flex" style={{ opacity: layerOpacity(only, stackLayer(0)) }}>
                <StatValue text={row.value} size={valueSize} color="#fff" shadow={TEXT_SHADOW} />
              </div>
            </div>
            <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: labelSize, lineHeight: 1, letterSpacing: labelSize * 0.16, color: MUTED, marginTop: px(s.heroLabelGap, k), opacity: layerOpacity(only, stackLayer(1)) }}>{row.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function CompactRow({ row, width, k, layer, only }: { row: PlayerStatRow; width: number; k: number; layer: number; only: BlockFilter }) {
  const s = PLAYER_SIZES;
  const valueSize = px(s.rowValue, k);
  const valueWidth = Math.round(row.value.length * valueSize * 0.62) + px(8, k);
  const labelSize = fitFontSize(row.label, width - valueWidth - px(12, k), px(s.rowLabel, k), 0.74, px(9, k));
  return (
    <div tw="flex flex-col" style={{ width, height: px(s.rowHeight, k) }}>
      <div tw="flex items-center justify-between" style={{ height: px(s.rowHeight, k) - 1, opacity: layerOpacity(only, stackLayer(layer)) }}>
        <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: labelSize, lineHeight: 1, letterSpacing: labelSize * 0.12, color: MUTED }}>{row.label}</span>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: valueSize, lineHeight: 1, color: "#fff" }}>{row.value}</span>
      </div>
      <div tw="flex" style={{ height: 1, width, backgroundColor: DIVIDER, opacity: unlayered(only) }} />
    </div>
  );
}

function Rows({ card, g, only }: { card: SpotlightCard; g: SpotlightGeometry; only: BlockFilter }) {
  if (!g.rows || card.rows.length === 0) return null;
  const { k, panel } = g;
  const gap = px(44, k);
  const width = panel.right - panel.left;
  const column = Math.floor((width - gap) / 2);
  const lines = spotlightRowLines(card.rows.length);
  return (
    <div tw="absolute flex flex-col" style={{ left: panel.left, top: g.rows.top, width, height: g.rows.height, opacity: blockOpacity(only, "panel", STACK_LAYERS) }}>
      {Array.from({ length: lines }, (_, line) => (
        <div key={line} tw="flex justify-between" style={{ width }}>
          {[card.rows[line * 2], card.rows[line * 2 + 1]].map((row, index) =>
            row ? <CompactRow key={row.key} row={row} width={column} k={k} layer={line} only={only} /> : <div key={`empty-${index}`} tw="flex" style={{ width: column }} />,
          )}
        </div>
      ))}
    </div>
  );
}

/** Tipografik yedek: fotoğrafın yerinde dev ad (ilk ad küçük, soyad büyük), alttan hizalı. */
function HeroName({ card, g, only }: { card: SpotlightCard; g: SpotlightGeometry; only: BlockFilter }) {
  if (!card.typographic || card.heroName.length === 0) return null;
  const { k, panel } = g;
  const width = panel.right - panel.left;
  const last = card.heroName[card.heroName.length - 1] ?? "";
  const first = card.heroName.length > 1 ? (card.heroName[0] ?? "") : null;
  const room = g.title.height / (first ? 1.75 : 1.3);
  const size = Math.min(fitFontSize(last, width, px(250, k), 0.53, px(60, k)), Math.floor(room));
  const firstSize = first ? Math.min(Math.round(size * 0.42), fitFontSize(first, width, size, 0.53, px(28, k))) : 0;
  return (
    <div tw="absolute flex flex-col justify-end" style={{ left: panel.left, top: g.title.top, width, height: g.title.height, paddingBottom: Math.round(size * DISPLAY_DESCENT_EM), opacity: blockOpacity(only, "title", STACK_LAYERS) }}>
      {first ? <span style={{ fontFamily: DISPLAY, fontSize: firstSize, lineHeight: 1, color: "rgba(255,255,255,0.86)", letterSpacing: firstSize * 0.04, opacity: layerOpacity(only, stackLayer(0)) }}>{first}</span> : null}
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff", letterSpacing: size * 0.005, marginTop: first ? Math.round(firstSize * DISPLAY_DESCENT_EM) + px(10, k) : 0, opacity: layerOpacity(only, stackLayer(1)) }}>{last}</span>
    </div>
  );
}

export function SpotlightTemplate({ card, g, shadeStrength, only }: { card: SpotlightCard; g: SpotlightGeometry; shadeStrength: number; only?: BlockFilter }) {
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      {card.typographic ? null : <Shade g={g.photo} strength={shadeStrength} only={only} />}
      <PlayerHeader card={card} g={g} only={only} />
      <HeroName card={card} g={g} only={only} />
      <NameBlock card={card} g={g} only={only} />
      <Fact card={card} g={g} only={only} />
      <Hero card={card} g={g} only={only} />
      <Rows card={card} g={g} only={only} />
      <PlayerFootnote card={card} g={g} only={only} />
      <PlayerFooter card={card} g={g} only={only} />
    </div>
  );
}
