import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { ScorecardCard, ScorecardHero } from "@/types/prediction-scorecard-card";
import { DISPLAY_DESCENT_EM, px } from "../match-day/shared";
import { SAFE_MARGIN, type FrameBox } from "../match-result/geometry";
import type { Band } from "../player-stats/geometry";

/**
 * Tahmin Karnesi geometrisi — TEK KAYNAK (Satori blokları + yerleşim kapısı aynı sayıları okur). Dikeyde
 * (4:5, 1:1, 9:16 güvenli bantlı) yukarıdan aşağı: üst satır → başlık → alt başlık → isabet özeti → ✅/❌
 * şeridi → satırlar (kalan alan; A'da ortalı) → dipnot → künye + logo (alttan sabit). 16:9'da sol sütun başlık + özet +
 * şerit, sağ sütun satırlar; künye ve logo altta tam genişlik. Satırlar sabit yükseklikte (`rowHeight`).
 */

export const SCORECARD_SIZES = {
  kicker: 20,
  kickerGap: 16,
  title: 104,
  titleGap: 18,
  subtitle: 32,
  heroGap: 44,
  ratePercent: 200,
  smallText: 84,
  heroLineGap: 22,
  heroLine: 22,
  stripGap: 30,
  strip: 52,
  bodyGap: 44,
  rowMax: 180,
  periodRowMax: 92,
  versionRow: 46,
  versionsGap: 24,
  footnote: 16,
  footnoteGap: 22,
  footer: 22,
  logo: 34,
  footerGap: 20,
} as const;

const LANDSCAPE_K = 0.56;
const LANDSCAPE_LEFT = 470;
const LANDSCAPE_COLUMN_GAP = 48;

export interface ScorecardGeometry {
  frame: MatchDayFrame;
  k: number;
  box: FrameBox;
  /** Başlık + özet + şerit sütunu (dikeyde tam genişlik). */
  head: { left: number; right: number };
  kicker: Band;
  title: Band;
  subtitle: Band;
  hero: Band;
  strip: Band;
  /** Satırların alanı (sağ sütun ya da kalan alan). */
  body: FrameBox;
  rowHeight: number;
  /** Satırların başladığı y: A'da az satır alanın ortasında, B'de üstte (sürüm satırları altta). */
  rowsTop: number;
  versions: Band | null;
  footnote: Band;
  footer: Band;
}

/** Özet bandının yüksekliği: dev yüzde + satır ya da dev metin + (varsa) etiket. */
export function heroHeight(hero: ScorecardHero, k: number): number {
  const s = SCORECARD_SIZES;
  if (hero.kind === "RATE") return px(s.ratePercent + s.heroLineGap + s.heroLine, k);
  // Anton dev metnin Ç/Ş kuyruğu satır kutusunun altına taşar — etiket kuyruğun altından başlar.
  return px(s.smallText * (1 + DISPLAY_DESCENT_EM), k) + (hero.badge ? px(s.heroLineGap + s.heroLine * 1.6, k) : 0);
}

const rowCount = (card: ScorecardCard) => (card.kind === "MATCH" ? card.rows.length : card.breakdown.length);

export function scorecardGeometry(frame: MatchDayFrame, card: ScorecardCard): ScorecardGeometry {
  const s = SCORECARD_SIZES;
  const landscape = frame.orientation === "landscape";
  const k = landscape ? LANDSCAPE_K : Math.min(1, frame.height / 1350, (frame.height - frame.safeTop - frame.safeBottom) / 1350);
  const box = { left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, top: frame.safeTop + SAFE_MARGIN, bottom: frame.height - frame.safeBottom - SAFE_MARGIN };
  const head = landscape ? { left: box.left, right: box.left + LANDSCAPE_LEFT } : { left: box.left, right: box.right };

  // Üstten: üst satır → başlık → alt başlık → özet → şerit.
  const kicker = { top: box.top, height: px(s.kicker, k) };
  const title = { top: kicker.top + kicker.height + px(s.kickerGap, k), height: px(s.title, k) };
  const subtitle = { top: title.top + title.height + px(s.title * DISPLAY_DESCENT_EM + s.titleGap, k), height: px(s.subtitle, k) };
  const hero = { top: subtitle.top + subtitle.height + px(s.heroGap, k), height: heroHeight(card.hero, k) };
  const strip = { top: hero.top + hero.height + px(s.stripGap, k), height: px(s.strip, k) };

  // Alttan: künye + logo → dipnot.
  const footer = { top: box.bottom - px(s.logo, k), height: px(s.logo, k) };
  const footnote = { top: footer.top - px(s.footerGap + s.footnote, k), height: px(s.footnote, k) };

  const versionsHeight = card.kind === "PERIOD" && card.versions ? card.versions.length * px(s.versionRow, k) : 0;
  const bodyTop = landscape ? box.top : strip.top + strip.height + px(s.bodyGap, k);
  const bodyBottom = (landscape ? footer.top : footnote.top) - px(s.footnoteGap, k) - (versionsHeight ? versionsHeight + px(s.versionsGap, k) : 0);
  const body = landscape ? { left: head.right + LANDSCAPE_COLUMN_GAP, right: box.right, top: bodyTop, bottom: bodyBottom } : { left: box.left, right: box.right, top: bodyTop, bottom: bodyBottom };
  const rowHeight = Math.min(px(card.kind === "MATCH" ? s.rowMax : s.periodRowMax, k * (landscape ? 1.25 : 1)), Math.floor((body.bottom - body.top) / Math.max(1, rowCount(card))));
  const rowsTop = card.kind === "MATCH" ? body.top + Math.floor((body.bottom - body.top - rowHeight * rowCount(card)) / 2) : body.top;
  const versions = versionsHeight ? { top: body.bottom + px(s.versionsGap, k), height: versionsHeight } : null;
  return { frame, k, box, head, kicker, title, subtitle, hero, strip, body, rowHeight, rowsTop, versions, footnote, footer };
}
