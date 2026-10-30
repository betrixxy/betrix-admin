import type { MatchScorecardCard, MatchScorecardCardRow } from "@/types/prediction-scorecard-card";
import { blockOpacity, layerOpacity, stackLayer, STACK_LAYERS, unlayered, type BlockFilter } from "../checkmatch-set/blocks";
import { BODY, DISPLAY, fitFontSize, px } from "../match-day/shared";
import { MUTED, TEXT_SHADOW } from "../vitrin/parts";
import type { ScorecardGeometry } from "./geometry";
import { ScorecardFooter, ScorecardHead, ScorecardHero, ScorecardStrip, StatusIcon, statusHex } from "./parts";

/**
 * A · MAÇ KARNESİ — maçın yayınlanmış BÜTÜN tahminleri, satır satır: ✅/❌ · soru / "Model: Galatasaray · %52"
 * / "Gerçekleşen: Galatasaray · 1–2" · TUTTU / TUTMADI. Satırın üç metin satırı mürekkep katmanıdır (alt alta
 * satırlar piksel düzeyinde denetlenir), işaret ve durum sözcüğü katmansız.
 */

function Row({ row, g, index, only }: { row: MatchScorecardCardRow; g: ScorecardGeometry; index: number; only: BlockFilter }) {
  const { k, rowHeight: h } = g;
  const width = g.body.right - g.body.left;
  const pad = Math.round(h * 0.12);
  const icon = Math.min(Math.round(h * 0.42), px(72, k));
  const statusSize = Math.min(Math.round(h * 0.26), px(46, k));
  const statusWidth = Math.round(statusSize * 0.5 * 7);
  const textWidth = width - pad * 2 - icon - statusWidth - pad * 2;
  const question = fitFontSize(row.question, textWidth, Math.min(Math.round(h * 0.2), px(34, k)), 0.56, 12);
  const detail = Math.min(Math.round(h * 0.15), px(26, k));
  const detailStyle = { fontFamily: BODY, fontWeight: 600, lineHeight: 1, color: MUTED };
  const color = statusHex(row.status);
  const bar = Math.max(3, px(6, k));
  const line = (n: number) => layerOpacity(only, stackLayer(index * 3 + n));
  return (
    <div tw="flex items-center" style={{ width, height: h - px(10, k), marginBottom: px(10, k), paddingRight: pad, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: px(10, k) }}>
      {/* Durum rengindeki kenar çizgisi — katmansız (mürekkep katmanı ölçülürken gizli). */}
      <div tw="flex" style={{ width: bar, height: "100%", marginRight: pad - bar, backgroundColor: color, borderRadius: px(10, k), opacity: unlayered(only) }} />
      <div tw="flex" style={{ width: icon, height: icon, opacity: unlayered(only) }}>
        <StatusIcon status={row.status} size={icon} />
      </div>
      <div tw="flex flex-col justify-center" style={{ width: textWidth, marginLeft: pad, marginRight: pad }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: question, lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW, opacity: line(0) }}>{row.question}</span>
        <span style={{ ...detailStyle, fontSize: fitFontSize(row.model, textWidth, detail, 0.55, 10), marginTop: Math.round(question * 0.45), opacity: line(1) }}>{row.model}</span>
        <span style={{ ...detailStyle, fontSize: fitFontSize(row.actual, textWidth, detail, 0.55, 10), color: "rgba(255,255,255,0.86)", marginTop: Math.round(detail * 0.4), opacity: line(2) }}>{row.actual}</span>
      </div>
      <div tw="flex justify-end" style={{ width: statusWidth, opacity: unlayered(only) }}>
        <span style={{ fontFamily: DISPLAY, fontSize: statusSize, lineHeight: 1, color, letterSpacing: statusSize * 0.02 }}>{row.statusLabel}</span>
      </div>
    </div>
  );
}

export function MatchScorecardTemplate({ card, g, only }: { card: MatchScorecardCard; g: ScorecardGeometry; only?: BlockFilter }) {
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <ScorecardHead card={card} g={g} only={only} />
      <ScorecardHero card={card} g={g} only={only} />
      <ScorecardStrip card={card} g={g} only={only} />
      <div tw="absolute flex flex-col" style={{ left: g.body.left, top: g.rowsTop, width: g.body.right - g.body.left, height: g.rowHeight * card.rows.length, opacity: blockOpacity(only, "karne-rows", STACK_LAYERS) }}>
        {card.rows.map((row, index) => (
          <Row key={`${row.scenarioId}-${index}`} row={row} g={g} index={index} only={only} />
        ))}
      </div>
      <ScorecardFooter card={card} g={g} only={only} />
    </div>
  );
}
