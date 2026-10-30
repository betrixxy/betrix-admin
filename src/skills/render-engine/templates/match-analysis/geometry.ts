import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { brandLogoWidth } from "../brand";
import { px } from "../match-day/shared";
import { SAFE_MARGIN, type FrameBox } from "../match-result/geometry";

/**
 * Maç Analizi geometrisi — TEK KAYNAK (Satori blokları, yoğunluk kuralının "sığar mı" sorusu ve görsel test
 * aynı sayıları okur; Satori ölçüm vermediği için her şey deterministik hesaplanır). İçerik kutusu set
 * kartlarının güvenli alanı (64px + 9:16 bantları). Dikey: sayfa etiketi · MAÇ ANALİZİ · takımlar/skor ·
 * gövde (01 zaman çizelgesi / 02 devre panelleri + olgular) · dipnot · künye + CheckMatch logosu. 16:9:
 * başlık ile takımlar aynı bantta (solda başlık, sağda takımlar), gövde tam genişlik.
 */

export const ANALYSIS_SIZES = {
  header: 18,
  headerGap: 34,
  title: 86,
  /** Anton "MAÇ" Ç kuyruğu ≈ 0,23 em alta taşar — takımlar satırı ayrı blok, arada pay. */
  titleGap: 34,
  teams: 60,
  teamsGap: 34,
  footnote: 15,
  footnoteGap: 16,
  logo: 34,
  bodyGap: 24,
} as const;

/** Dikey ailenin referans içerik yüksekliği (4:5 ve 9:16) — 1:1 bununla ölçeklenir. */
const REFERENCE_HEIGHT = 1222;
/** 16:9 tipografi ölçeği ve başlık bandı. */
export const LANDSCAPE_K = 0.62;
const LANDSCAPE_HEADER_K = 0.8;

export interface Band {
  top: number;
  height: number;
}

export interface AnalysisGeometry {
  frame: MatchDayFrame;
  landscape: boolean;
  k: number;
  /** Sayfa etiketi ölçeği (16:9'da set kartlarıyla aynı 0,8). */
  headerK: number;
  box: FrameBox;
  title: Band & { left: number; width: number };
  teams: Band & { left: number; width: number };
  body: Band;
  footnote: Band;
  /** Künye satırı + logo (`SetFooter` kutunun altına çizer). */
  logoHeight: number;
  footerSize: number;
}

export function analysisGeometry(frame: MatchDayFrame): AnalysisGeometry {
  const s = ANALYSIS_SIZES;
  const landscape = frame.orientation === "landscape";
  const box = { left: SAFE_MARGIN, right: frame.width - SAFE_MARGIN, top: frame.safeTop + SAFE_MARGIN, bottom: frame.height - frame.safeBottom - SAFE_MARGIN };
  const k = landscape ? LANDSCAPE_K : Math.min(1, (box.bottom - box.top) / REFERENCE_HEIGHT);
  const headerK = landscape ? LANDSCAPE_HEADER_K : k;
  const width = box.right - box.left;
  const logoHeight = landscape ? 26 : px(s.logo, k);
  const footerSize = landscape ? 17 : px(23, k);
  const footnote = { top: box.bottom - logoHeight - px(s.footnoteGap, k) - px(s.footnote, k), height: px(s.footnote, k) };
  const titleTop = box.top + px(s.header, headerK) + px(s.headerGap, k);
  const titleHeight = px(s.title, k);
  if (landscape) {
    // Başlık solda, takımlar sağda — aynı bant; başlığın genişliği "MAÇ ANALİZİ" (11 harf, Anton ≈ 0,47 em).
    const titleWidth = Math.ceil(titleHeight * 0.47 * 11) + 8;
    const gap = 40;
    const title = { top: titleTop, height: titleHeight, left: box.left, width: titleWidth };
    const teams = { top: titleTop, height: titleHeight, left: box.left + titleWidth + gap, width: width - titleWidth - gap };
    const bodyTop = titleTop + titleHeight + px(s.titleGap, k);
    return { frame, landscape, k, headerK, box, title, teams, body: { top: bodyTop, height: footnote.top - px(s.bodyGap, k) - bodyTop }, footnote, logoHeight, footerSize };
  }
  const title = { top: titleTop, height: titleHeight, left: box.left, width };
  const teamsTop = titleTop + titleHeight + px(s.titleGap, k);
  const teams = { top: teamsTop, height: px(s.teams, k), left: box.left, width };
  const bodyTop = teamsTop + teams.height + px(s.teamsGap, k);
  return { frame, landscape, k, headerK, box, title, teams, body: { top: bodyTop, height: footnote.top - px(s.bodyGap, k) - bodyTop }, footnote, logoHeight, footerSize };
}

/** Dipnot genişliği: logoya çarpmasın (künye satırının üstünde, logo sağ altta). */
export const footnoteWidth = (g: AnalysisGeometry) => g.box.right - g.box.left - brandLogoWidth(g.logoHeight) - 24;

/* ---------- 02 · Devre devre ---------- */

export const HALVES_SIZES = {
  vertical: { header: 24, headerGap: 22, value: 46, label: 16, bar: 6, barGap: 12, row: 96, rowMin: 70, columnGap: 36, fact: 25, factLine: 1.3, factGap: 14, factsGap: 40 },
  landscape: { header: 15, headerGap: 12, value: 26, label: 12, bar: 4, barGap: 7, row: 50, rowMin: 40, columnGap: 32, fact: 16, factLine: 1.3, factGap: 6, factsGap: 18 },
} as const;

export interface HalvesGeometry extends AnalysisGeometry {
  sizes: (typeof HALVES_SIZES)["vertical" | "landscape"];
  panel: Band;
  columns: [{ left: number; width: number }, { left: number; width: number }];
  rowHeight: number;
  facts: Band;
  /** Olgu başına satır sayısı tahmini (sarma). */
  factLines: number[];
  factSize: number;
}

/** Geist yarı kalın Türkçe metinde ortalama glif genişliği (em) — satır sarma tahmini, cömert. */
const FACT_EM_PER_CHAR = 0.47;

export function factLineCount(text: string, width: number, size: number): number {
  const perLine = Math.max(1, Math.floor(width / (size * FACT_EM_PER_CHAR)));
  // Sözcük sınırında sarma: kelimeleri satırlara yerleştir.
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/u)) {
    const length = word.length + (used > 0 ? 1 : 0);
    if (used + length > perLine && used > 0) {
      lines += 1;
      used = word.length;
    } else used += length;
  }
  return lines;
}

export function halvesGeometry(frame: MatchDayFrame, rows: number, facts: readonly string[]): HalvesGeometry {
  const g = analysisGeometry(frame);
  const sizes = g.landscape ? HALVES_SIZES.landscape : HALVES_SIZES.vertical;
  const scale = (value: number) => (g.landscape ? value : px(value, g.k));
  const width = g.box.right - g.box.left;
  const factSize = scale(sizes.fact);
  const bulletSpace = Math.round(factSize * 1.1);
  const factLines = facts.map((fact) => factLineCount(fact, width - bulletSpace, factSize));
  const factsHeight = factLines.reduce((sum, lines) => sum + Math.ceil(lines * factSize * sizes.factLine), 0) + Math.max(0, facts.length - 1) * scale(sizes.factGap);
  const headerHeight = scale(sizes.header) + scale(sizes.headerGap);
  const available = g.body.height - (facts.length > 0 ? factsHeight + scale(sizes.factsGap) : 0) - headerHeight;
  const rowHeight = Math.max(scale(sizes.rowMin), Math.min(scale(sizes.row), Math.floor(available / Math.max(1, rows))));
  const panelHeight = headerHeight + rowHeight * rows;
  const total = panelHeight + (facts.length > 0 ? scale(sizes.factsGap) + factsHeight : 0);
  // Boşluk kalırsa grup gövdenin ortasında (altta boşluk birikmesin).
  const top = g.body.top + Math.max(0, Math.floor((g.body.height - total) / 2));
  const columnWidth = Math.floor((width - scale(sizes.columnGap)) / 2);
  const columns: HalvesGeometry["columns"] = [
    { left: g.box.left, width: columnWidth },
    { left: g.box.right - columnWidth, width: columnWidth },
  ];
  const panel = { top, height: panelHeight };
  return { ...g, sizes, panel, columns, rowHeight, facts: { top: top + panelHeight + scale(sizes.factsGap), height: factsHeight }, factLines, factSize };
}
