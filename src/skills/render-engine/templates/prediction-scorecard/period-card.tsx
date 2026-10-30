import type { PeriodScorecardCard, PeriodScorecardCardRow } from "@/types/prediction-scorecard-card";
import { blockOpacity, layerOpacity, stackLayer, STACK_LAYERS, type BlockFilter } from "../checkmatch-set/blocks";
import { BODY, fitFontSize, px } from "../match-day/shared";
import { MUTED, TEXT_SHADOW } from "../vitrin/parts";
import { SCORECARD_SIZES, type ScorecardGeometry } from "./geometry";
import { HIT_HEX, ScorecardFooter, ScorecardHead, ScorecardHero, ScorecardStrip } from "./parts";

/**
 * B · DÖNEM KARNESİ — hafta / ay / sezon: dev isabet özeti, son N ✅/❌ şeridi, senaryo türüne göre kırılım
 * (ad · "7/12 · %58" + doluluk çubuğu), istenirse model sürümüne göre ayrım. Kırılım satırının yazısı ve
 * çubuğu alt alta iki mürekkep katmanıdır.
 */

const TRACK = "rgba(255,255,255,0.12)";

function Row({ row, g, index, only }: { row: PeriodScorecardCardRow; g: ScorecardGeometry; index: number; only: BlockFilter }) {
  const { k, rowHeight: h } = g;
  const width = g.body.right - g.body.left;
  const size = Math.min(Math.round(h * 0.3), px(30, k));
  const bar = Math.max(4, Math.round(h * 0.07));
  const valueWidth = Math.round(width * 0.4);
  const labelSize = fitFontSize(row.label, width - valueWidth, size, 0.56, 12);
  return (
    <div tw="flex flex-col justify-center" style={{ width, height: h }}>
      <div tw="flex items-end justify-between" style={{ width, opacity: layerOpacity(only, stackLayer(index * 2)) }}>
        <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: labelSize, lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW }}>{row.label}</span>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: fitFontSize(row.value, valueWidth, size, 0.58, 12), lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW }}>{row.value}</span>
      </div>
      <div tw="flex" style={{ width, height: bar, marginTop: Math.round(h * 0.16), backgroundColor: TRACK, borderRadius: bar / 2, opacity: layerOpacity(only, stackLayer(index * 2 + 1)) }}>
        <div tw="flex" style={{ width: Math.round(width * Math.min(1, Math.max(0, row.ratio))), height: bar, backgroundColor: HIT_HEX, borderRadius: bar / 2 }} />
      </div>
    </div>
  );
}

function Versions({ card, g, only }: { card: PeriodScorecardCard; g: ScorecardGeometry; only: BlockFilter }) {
  if (!card.versions || !g.versions) return null;
  const width = g.body.right - g.body.left;
  const row = px(SCORECARD_SIZES.versionRow, g.k);
  const size = Math.round(row * 0.46);
  return (
    <div tw="absolute flex flex-col" style={{ left: g.body.left, top: g.versions.top, width, height: g.versions.height, opacity: blockOpacity(only, "karne-versions", STACK_LAYERS) }}>
      {card.versions.map((version, index) => (
        <div key={version.label} tw="flex items-center justify-between" style={{ width, height: row, opacity: layerOpacity(only, stackLayer(index)) }}>
          <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: size * 0.14, color: MUTED }}>{version.label}</span>
          <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: fitFontSize(version.value, width * 0.6, size, 0.56, 10), lineHeight: 1, color: "#fff" }}>{version.value}</span>
        </div>
      ))}
    </div>
  );
}

export function PeriodScorecardTemplate({ card, g, only }: { card: PeriodScorecardCard; g: ScorecardGeometry; only?: BlockFilter }) {
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <ScorecardHead card={card} g={g} only={only} />
      <ScorecardHero card={card} g={g} only={only} />
      <ScorecardStrip card={card} g={g} only={only} />
      <div tw="absolute flex flex-col" style={{ left: g.body.left, top: g.rowsTop, width: g.body.right - g.body.left, height: g.rowHeight * card.breakdown.length, opacity: blockOpacity(only, "karne-rows", STACK_LAYERS) }}>
        {card.breakdown.map((row, index) => (
          <Row key={row.label} row={row} g={g} index={index} only={only} />
        ))}
      </div>
      <Versions card={card} g={g} only={only} />
      <ScorecardFooter card={card} g={g} only={only} />
    </div>
  );
}
