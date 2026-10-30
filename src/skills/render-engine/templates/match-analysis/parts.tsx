import type { AnalysisCardBase } from "@/types/match-analysis";
import { blockOpacity, type BlockFilter, type LayoutBlockId } from "../checkmatch-set/blocks";
import { SetFooter, SetHeader } from "../checkmatch-set/set-parts";
import { BODY, DISPLAY, TeamLogo, fitFontSize, px } from "../match-day/shared";
import { MUTED, TEXT_SHADOW } from "../vitrin/parts";
import { footnoteWidth, type AnalysisGeometry } from "./geometry";

/**
 * Maç Analizi ortak parçaları (Satori): sayfa etiketi + tarih (set ile aynı `SetHeader`), "MAÇ ANALİZİ"
 * başlığı, takımlar + skor satırı, veri kaynağı dipnotu, künye + CheckMatch logosu (set ile aynı `SetFooter`).
 * Her öğe bir yerleşim bloğuna aittir (kapı logo dahil hepsini ölçer).
 */

/** 01 ve 02'nin blokları (yerleşim kapısı yalnızca bunları çizer + sonda bloğu). */
export const ANALYSIS_BLOCKS: readonly LayoutBlockId[] = ["header-label", "header-date", "title", "teams", "chart", "panel", "fact", "footnote", "footer-text", "footer-logo", "stack-a", "stack-b"];

export function AnalysisHeader({ card, g, only }: { card: AnalysisCardBase; g: AnalysisGeometry; only: BlockFilter }) {
  return <SetHeader card={card} box={g.box} k={g.headerK} only={only} />;
}

export function AnalysisTitle({ card, g, only }: { card: AnalysisCardBase; g: AnalysisGeometry; only: BlockFilter }) {
  const size = fitFontSize(card.title, g.title.width, g.title.height, 0.47, 24);
  return (
    <div tw="absolute flex items-start" style={{ left: g.title.left, top: g.title.top, width: g.title.width, height: g.title.height, opacity: blockOpacity(only, "title") }}>
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1, color: "#fff", letterSpacing: size * 0.01, textShadow: TEXT_SHADOW }}>{card.title}</span>
    </div>
  );
}

/** Takımlar + skor: logo · AD · 0–4 · AD · logo (16:9'da başlığın sağında, sağa yaslı). */
export function TeamsRow({ card, g, only }: { card: AnalysisCardBase; g: AnalysisGeometry; only: BlockFilter }) {
  const { teams } = g;
  const height = g.landscape ? Math.round(teams.height * 0.8) : teams.height;
  const logo = Math.round(height * 0.9);
  const scoreSize = Math.round(height * 0.92);
  const scoreText = `${card.homeGoals}–${card.awayGoals}`;
  const scoreWidth = Math.ceil(scoreText.length * scoreSize * 0.5) + px(24, g.k);
  const gap = px(16, g.k);
  const nameWidth = Math.floor((teams.width - 2 * logo - scoreWidth - 4 * gap) / 2);
  const nameSize = Math.min(fitFontSize(card.homeTeam, nameWidth, Math.round(height * 0.62), 0.47, 14), fitFontSize(card.awayTeam, nameWidth, Math.round(height * 0.62), 0.47, 14));
  const name = { fontFamily: DISPLAY, fontSize: nameSize, lineHeight: 1, color: "#fff", letterSpacing: nameSize * 0.02, textShadow: TEXT_SHADOW };
  return (
    <div tw="absolute flex items-center justify-center" style={{ left: teams.left, top: teams.top + Math.round((teams.height - height) / 2), width: teams.width, height, opacity: blockOpacity(only, "teams") }}>
      <TeamLogo src={card.homeLogo} name={card.homeTeam} size={logo} />
      <div tw="flex justify-end" style={{ width: nameWidth, marginLeft: gap, marginRight: gap }}>
        <span style={name}>{card.homeTeam}</span>
      </div>
      <div tw="flex justify-center" style={{ width: scoreWidth }}>
        <span style={{ fontFamily: DISPLAY, fontSize: scoreSize, lineHeight: 1, color: "#fff", textShadow: TEXT_SHADOW }}>{scoreText}</span>
      </div>
      <div tw="flex justify-start" style={{ width: nameWidth, marginLeft: gap, marginRight: gap }}>
        <span style={name}>{card.awayTeam}</span>
      </div>
      <TeamLogo src={card.awayLogo} name={card.awayTeam} size={logo} />
    </div>
  );
}

export function AnalysisFootnote({ card, g, only }: { card: AnalysisCardBase; g: AnalysisGeometry; only: BlockFilter }) {
  const width = footnoteWidth(g);
  const size = fitFontSize(card.footnote, width, g.footnote.height, 0.55, 9);
  return (
    <div tw="absolute flex items-center" style={{ left: g.box.left, top: g.footnote.top, width, height: g.footnote.height, opacity: blockOpacity(only, "footnote") }}>
      <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: size, lineHeight: 1, letterSpacing: size * 0.03, color: MUTED }}>{card.footnote}</span>
    </div>
  );
}

export function AnalysisFooter({ card, g, only }: { card: AnalysisCardBase; g: AnalysisGeometry; only: BlockFilter }) {
  return <SetFooter card={card} box={g.box} size={g.footerSize} logoHeight={g.logoHeight} only={only} />;
}

