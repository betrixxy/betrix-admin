import type { MatchStatsCard } from "@/types/match-stats";
import type { BlockFilter } from "../checkmatch-set/blocks";
import { LandscapeSetColumn, LANDSCAPE_GUTTER } from "../checkmatch-set/landscape";
import { SetHeader, SET_VERTICAL, SetFooter, SetScoreBlock } from "../checkmatch-set/set-parts";
import { BODY, px } from "../match-day/shared";
import { PAGE_LABEL_SPACE, setBlockTop, type StatsGeometry } from "./geometry";
import { Highlight, rgba } from "./parts";
import { CONNECTOR, layout, PAD_X, SPINE_ALPHA, StatsPanel, type Layout } from "./stats-layout";

/**
 * MAÇ İSTATİSTİKLERİ — "CheckMatch set" kartı (02).
 *
 * Dikey (4:5, 1:1, 9:16): üstte sayfa etiketi + tarih, altta Maç Sonucu ile AYNI set bloğu (öne
 * çıkan satır · skor şeridi · golcüler) ve künye. Arada satır paneli: Özet'te en üstte kahraman
 * satır (top hakimiyeti), altında en fazla 7 kompakt satır; xG satırı varsa panelin altında
 * dipnot. Vurgu renginde ince omurga panelden rozete iner.
 *
 * 16:9: satır paneli bir yanda (~%55), Maç Sonucu ile AYNI set sütunu (`LandscapeSetColumn`) öbür
 * yanda — skor ve golcüler sütunda dikey dizilir, panelin üstüne binmez. Panel ölçeği (`k`) tüm
 * satırlar ve dipnot sığana kadar küçültülür; etiketler kesilmez.
 */

/** 16:9 panel ölçeği arama aralığı — en büyükten başlanır, satırlar sığınca durulur. */
const LANDSCAPE_K_MAX = 0.8;
const LANDSCAPE_K_MIN = 0.42;

function Vertical({ card, g, only }: { card: MatchStatsCard; g: StatsGeometry; only: BlockFilter }) {
  const { k, frame } = g;
  const width = g.right - g.left;
  const inner = width - 2 * px(PAD_X, k);
  // Öne çıkan satır varsa omurga yazının üstünde kesilir; yoksa başlık yuvasından kesintisiz geçer.
  const blockTop = setBlockTop(g, card.homeScorers, card.awayScorers);
  const spineEnd = blockTop - px(10, k);
  const spineTo = card.highlight ? spineEnd : blockTop + px(SET_VERTICAL.headlineSlot, k);
  const areaTop = g.top + px(PAGE_LABEL_SPACE, k);
  const areaBottom = spineEnd - px(CONNECTOR, k);
  const placed = layout(card, g, areaTop, areaBottom, inner);
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <SetHeader card={card} box={g} k={k} only={only} />
      <StatsPanel card={card} placed={placed} left={g.left} width={width} k={k} spineTo={spineTo} only={only} />
      <SetScoreBlock card={card} box={g} frameHeight={frame.height} k={k} headline={<Highlight card={card} k={k} />} spineHex={rgba(card.accentHex, SPINE_ALPHA)} only={only} />
      <SetFooter card={card} box={g} size={px(SET_VERTICAL.footerSize, k)} logoHeight={px(SET_VERTICAL.logoHeight, k)} only={only} />
    </div>
  );
}

/** 16:9 paneli: alana sığan en büyük ölçek (satır aralığı en az değerdeyken bile taşıyorsa en küçük). */
function fitLandscapePanel(card: MatchStatsCard, g: StatsGeometry, top: number, bottom: number, width: number): { k: number; placed: Layout } {
  let fitted = { k: LANDSCAPE_K_MIN, placed: layout(card, { ...g, k: LANDSCAPE_K_MIN }, top, bottom, width - 2 * px(PAD_X, LANDSCAPE_K_MIN)) };
  for (let step = 0; LANDSCAPE_K_MAX - step * 0.02 >= LANDSCAPE_K_MIN - 1e-9; step++) {
    const k = LANDSCAPE_K_MAX - step * 0.02;
    const placed = layout(card, { ...g, k }, top, bottom, width - 2 * px(PAD_X, k));
    if (placed.panelHeight <= bottom - top) {
      fitted = { k, placed };
      break;
    }
  }
  return fitted;
}

function Landscape({ card, g, only }: { card: MatchStatsCard; g: StatsGeometry; only: BlockFilter }) {
  const column = g.column ?? { left: g.left, right: g.right, top: g.top, bottom: g.bottom };
  const panelLeft = g.side === "right" ? g.left : column.right + LANDSCAPE_GUTTER;
  const panelRight = g.side === "right" ? column.left - LANDSCAPE_GUTTER : g.right;
  const width = panelRight - panelLeft;
  const { k, placed } = fitLandscapePanel(card, g, column.top, column.bottom, width);
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY }}>
      <SetHeader card={card} box={g} k={0.8} only={only} />
      <StatsPanel card={card} placed={placed} left={panelLeft} width={width} k={k} spineTo={placed.panelTop + placed.panelHeight - px(24, k)} only={only} />
      <LandscapeSetColumn card={card} box={column} headline={<Highlight card={card} k={0.62} />} only={only} />
      <SetFooter card={card} box={g} size={17} logoHeight={26} only={only} />
    </div>
  );
}

export function MatchStatsTemplate({ card, g, only }: { card: MatchStatsCard; g: StatsGeometry; only?: BlockFilter }) {
  return g.frame.orientation === "landscape" ? <Landscape card={card} g={g} only={only} /> : <Vertical card={card} g={g} only={only} />;
}
