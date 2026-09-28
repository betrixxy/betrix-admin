import type { CalendarFixture } from "@/types/calendar";
import type { StudioFormatDef } from "@/types/ai-content";

export interface StatRow {
  label: string;
  home: string;
  away: string;
}

export interface RenderInput {
  format: StudioFormatDef;
  fixture: CalendarFixture;
  statRows: StatRow[];
  /** Fal.ai `flux` çıktısı, küçültülmüş `data:` URI — yoksa takım renklerinden gradyan kullanılır. */
  backgroundDataUri?: string | undefined;
  /** Fal.ai `birefnet` çıktısı (arka planı temizlenmiş), küçültülmüş `data:` URI. */
  playerDataUri?: string | undefined;
  logoDataUri?: string | undefined;
}

const FONT = "Inter, 'Segoe UI', Arial, sans-serif";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Renk değeri SVG'ye yalnızca güvenli bir `#RRGGBB` ise girer. */
function safeColor(hex: string, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : fallback;
}

function fitFontSize(text: string, maxWidth: number, maxSize: number): number {
  return Math.min(maxSize, maxWidth / Math.max(1, text.length * 0.58));
}

function text(
  content: string,
  x: number,
  y: number,
  size: number,
  options: { anchor?: "start" | "middle" | "end"; weight?: number; fill?: string; opacity?: number } = {},
): string {
  const { anchor = "middle", weight = 700, fill = "#ffffff", opacity = 1 } = options;
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size.toFixed(1)}" font-weight="${weight}" fill="${fill}" fill-opacity="${opacity}" text-anchor="${anchor}">${escapeXml(content)}</text>`;
}

function statPanel(rows: StatRow[], x: number, y: number, width: number, rowHeight: number): string {
  if (rows.length === 0) return "";
  const height = rows.length * rowHeight + rowHeight * 0.4;
  const size = rowHeight * 0.42;
  const cells = rows
    .map((row, index) => {
      const cy = y + rowHeight * 0.75 + index * rowHeight;
      return [
        text(row.home, x + width * 0.14, cy, size, { weight: 700 }),
        text(row.label, x + width / 2, cy, size * 0.8, { weight: 500, opacity: 0.65 }),
        text(row.away, x + width * 0.86, cy, size, { weight: 700 }),
      ].join("");
    })
    .join("");

  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rowHeight * 0.3}" fill="#000000" fill-opacity="0.55" stroke="#ffffff" stroke-opacity="0.12"/>${cells}`;
}

function image(dataUri: string, x: number, y: number, width: number, height: number, align: string): string {
  return `<image xlink:href="${dataUri}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${align} meet"/>`;
}

/** Tam kanvası kaplayan arka plan görseli — `slice` ile kırpılır, boşluk kalmaz. */
function backgroundImage(dataUri: string, width: number, height: number): string {
  return `<image xlink:href="${dataUri}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`;
}

function portraitLayout({ format, fixture, statRows, playerDataUri, logoDataUri }: RenderInput): string {
  const { width: W, height: H } = format;
  const isStory = format.id === "STORY";
  const safeTop = isStory ? 250 : H * 0.08;
  const safeBottom = isStory ? 320 : H * 0.1;
  const rowHeight = 78;
  const panelHeight = statRows.length ? statRows.length * rowHeight + rowHeight * 0.4 : 0;
  const panelY = H - safeBottom - panelHeight;
  const titleY = safeTop + 150;
  const home = fixture.homeTeam.name;
  const away = fixture.awayTeam.name;
  const playerTop = titleY + 250;
  const playerHeight = Math.max(200, panelY - 30 - playerTop);

  return [
    playerDataUri ? image(playerDataUri, W * 0.15, playerTop, W * 0.7, playerHeight, "xMidYMax") : "",
    text(fixture.competition.name.toUpperCase(), W / 2, safeTop + 90, 30, { weight: 600, opacity: 0.7 }),
    text(home, W / 2, titleY + 40, fitFontSize(home, W * 0.86, 96)),
    text("VS", W / 2, titleY + 130, 40, { weight: 600, opacity: 0.6 }),
    text(away, W / 2, titleY + 220, fitFontSize(away, W * 0.86, 96)),
    statPanel(statRows, W * 0.07, panelY, W * 0.86, rowHeight),
    text("CheckMatch.net", 64, safeTop + 30, 34, { anchor: "start", weight: 800 }),
    logoDataUri ? image(logoDataUri, W - 64 - 110, safeTop - 10, 110, 110, "xMaxYMin") : "",
  ].join("");
}

function landscapeLayout({ format, fixture, statRows, playerDataUri, logoDataUri }: RenderInput): string {
  const { width: W, height: H } = format;
  const margin = W * 0.05;
  const leftWidth = W * 0.52;
  const home = fixture.homeTeam.name;
  const away = fixture.awayTeam.name;
  const rowHeight = 46;
  const panelHeight = statRows.length ? statRows.length * rowHeight + rowHeight * 0.4 : 0;

  return [
    playerDataUri ? image(playerDataUri, W * 0.56, H * 0.06, W * 0.4, H * 0.88, "xMidYMax") : "",
    text("CheckMatch.net", margin, H * 0.12, 26, { anchor: "start", weight: 800 }),
    text(fixture.competition.name.toUpperCase(), margin, H * 0.2, 20, { anchor: "start", weight: 600, opacity: 0.7 }),
    text(home, margin, H * 0.36, fitFontSize(home, leftWidth, 58), { anchor: "start" }),
    text("VS", margin, H * 0.44, 24, { anchor: "start", weight: 600, opacity: 0.6 }),
    text(away, margin, H * 0.54, fitFontSize(away, leftWidth, 58), { anchor: "start" }),
    statPanel(statRows, margin, H * 0.95 - panelHeight, leftWidth, rowHeight),
    logoDataUri ? image(logoDataUri, W - margin - 72, H * 0.06, 72, 72, "xMaxYMin") : "",
  ].join("");
}

/**
 * Stüdyo önizleme görselini SVG olarak üretir (bkz. CLAUDE.md 3.4 katman sırası:
 * arka plan → ışık süzmesi → oyuncu → veri katmanı → marka). Arka plan ve oyuncu katmanları
 * Fal.ai (`flux` + `birefnet`, bkz. `lib/services/fal`) çıktılarıdır; veri/marka katmanı
 * (istatistikler, logo, CheckMatch.net başlığı) her zaman burada, programatik olarak çizilir.
 */
export function buildRenderSvg(input: RenderInput): string {
  const { format, fixture, backgroundDataUri } = input;
  const { width: W, height: H } = format;
  const homeColor = safeColor(fixture.homeTeam.primaryColorHex, "#1f6f4a");
  const awayColor = safeColor(fixture.awayTeam.primaryColorHex, "#2a4d9b");
  const layers = format.id === "X_CARD" ? landscapeLayout(input) : portraitLayout(input);

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${homeColor}"/><stop offset="1" stop-color="${awayColor}"/></linearGradient>
<radialGradient id="bloom" cx="0.5" cy="0.32" r="0.55"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#0a0a0a"/>
<rect width="${W}" height="${H}" fill="url(#bg)" fill-opacity="0.6"/>
${backgroundDataUri ? backgroundImage(backgroundDataUri, W, H) : ""}
<rect width="${W}" height="${H}" fill="url(#bloom)" style="mix-blend-mode:screen"/>
<rect width="${W}" height="${H}" fill="#000000" fill-opacity="0.35"/>
${layers}
</svg>`;
}
