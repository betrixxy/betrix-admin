import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { brandLogoWidth } from "../brand";
import { px } from "../match-day/shared";
import { tight } from "../../satori-text";
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
  /** Çizilecek olgular, satırlarına bölünmüş (sığmayan düşmüş). */
  factTexts: string[][];
  factSize: number;
  /** Dikey dengede gövdenin ek ölçeği (`shared/vertical-balance.ts`; 16:9'da 1). Şablon `g.k × fill` ile çizer. */
  fill: number;
}

/** Devre panelleri dikeyde en çok bu kadar büyür (alan boş kalmasın; olgu düşürülerek büyütülmez). */
const MAX_HALVES_FILL = 1.3;

/**
 * Olgu satırları ELLE bölünür: `renderSatori` tek satırlık metnin boşluklarını bölünmez yapar, bölünmemiş olgu satırı
 * kendiliğinden sarılmaz ve sağ kenardan taşar (canlı test 2026-10-31, Fiorentina–Atalanta 4:5: "olgu satırı güvenli
 * kenarı 18px aşıyor" — eski tahmin 0,47 em/karakter iki satır sanıyordu, çizim tek satırdı ve ≈ 0,49 em çıktı). Genişlik
 * Geist 600'ün Satori'de ÖLÇÜLEN karakter sınıfı genişliklerinden (em, 2026-10-31): küçük harf 0,58, dar (i j l ı t ş f) 0,36,
 * m/w 0,82, büyük harf 0,66, rakam 0,61, "%" 0,82, "→" 0,79, noktalama 0,27, boşluk 0,25. Bir olgu en fazla
 * `MAX_FACT_LINES` satır; daha uzunu ya da sığmayanı (satırlar asgari yüksekliğin altına inecekse) sondan düşer — olgu
 * cümlesi kırpılmaz (doğrulanmış cümle yarım yazılmaz).
 */
export const MAX_FACT_LINES = 2;

const charEm = (char: string): number =>
  /\s/u.test(char) ? 0.25 : /[0-9]/u.test(char) ? 0.61 : char === "%" ? 0.82 : char === "→" ? 0.79 : /[ijlıtşf]/u.test(char) ? 0.36 : /[mw]/u.test(char) ? 0.82 : /\p{Lu}/u.test(char) ? 0.66 : /\p{Ll}/u.test(char) ? 0.58 : 0.27;

/** Olgu metninin genişliği (em). */
export const factEm = (text: string): number => [...text].reduce((sum, char) => sum + charEm(char), 0);

/** Açgözlü sözcük sarma (ölçülen genişliklerle); satırlar `tight`. */
export function wrapFact(text: string, width: number, size: number): string[] {
  const limit = width / size;
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/u)) {
    const next = line ? `${line} ${word}` : word;
    if (line && factEm(next) > limit) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.map(tight);
}

export function factLineCount(text: string, width: number, size: number): number {
  return wrapFact(text, width, size).length;
}

export function halvesGeometry(frame: MatchDayFrame, rows: number, facts: readonly string[]): HalvesGeometry {
  const natural = halvesAt(frame, rows, facts, 1);
  if (natural.landscape) return natural;
  // Dikey denge: satırlar üst sınırında ve gövde hâlâ boşsa panel + olgular büyür (aynı olgu sayısıyla sığdığı sürece),
  // kalan boşluk grubun üstü/altına eşit (grup gövdenin ortasında).
  for (let fill = MAX_HALVES_FILL; fill > 1; fill = Math.round((fill - 0.05) * 100) / 100) {
    const grown = halvesAt(frame, rows, facts, fill);
    if (grown.factTexts.length === natural.factTexts.length && grown.rowHeight >= px(grown.sizes.row, grown.k * fill) && grown.panel.top + grown.panel.height + (grown.factTexts.length ? grown.facts.height + px(grown.sizes.factsGap, grown.k * fill) : 0) <= grown.body.top + grown.body.height) return grown;
  }
  return natural;
}

function halvesAt(frame: MatchDayFrame, rows: number, facts: readonly string[], fill: number): HalvesGeometry {
  const g = analysisGeometry(frame);
  const sizes = g.landscape ? HALVES_SIZES.landscape : HALVES_SIZES.vertical;
  const scale = (value: number) => (g.landscape ? value : px(value, g.k * fill));
  const width = g.box.right - g.box.left;
  const factSize = scale(sizes.fact);
  const bulletSpace = Math.round(factSize * 0.42) + Math.round(factSize * 0.68);
  const headerHeight = scale(sizes.header) + scale(sizes.headerGap);
  const factsHeightOf = (lines: string[][]) => lines.reduce((sum, text) => sum + Math.ceil(text.length * factSize * sizes.factLine), 0) + Math.max(0, lines.length - 1) * scale(sizes.factGap);
  const availableFor = (lines: string[][]) => g.body.height - (lines.length > 0 ? factsHeightOf(lines) + scale(sizes.factsGap) : 0) - headerHeight;
  let factTexts = facts.map((fact) => wrapFact(fact, width - bulletSpace, factSize)).filter((lines) => lines.length <= MAX_FACT_LINES);
  while (factTexts.length > 0 && Math.floor(availableFor(factTexts) / Math.max(1, rows)) < scale(sizes.rowMin)) factTexts = factTexts.slice(0, -1);
  const factsHeight = factsHeightOf(factTexts);
  const rowHeight = Math.max(scale(sizes.rowMin), Math.min(scale(sizes.row), Math.floor(availableFor(factTexts) / Math.max(1, rows))));
  const panelHeight = headerHeight + rowHeight * rows;
  const total = panelHeight + (factTexts.length > 0 ? scale(sizes.factsGap) + factsHeight : 0);
  // Boşluk kalırsa grup gövdenin ortasında (altta boşluk birikmesin).
  const top = g.body.top + Math.max(0, Math.floor((g.body.height - total) / 2));
  const columnWidth = Math.floor((width - scale(sizes.columnGap)) / 2);
  const columns: HalvesGeometry["columns"] = [
    { left: g.box.left, width: columnWidth },
    { left: g.box.right - columnWidth, width: columnWidth },
  ];
  const panel = { top, height: panelHeight };
  return { ...g, sizes, panel, columns, rowHeight, facts: { top: top + panelHeight + scale(sizes.factsGap), height: factsHeight }, factTexts, factSize, fill: g.landscape ? 1 : fill };
}
