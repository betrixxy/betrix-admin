import sharp from "sharp";
import { createElement } from "react";
import { planFallbackType, TYPE_LETTER_SPACING, type FallbackTypePlan, type TypeBounds } from "@/lib/dashboard/fallback-type";
import { logoSilhouette } from "@/lib/dashboard/logo-silhouette";
import { shortTeamName } from "@/lib/names/team-short-names";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import { renderSatori } from "@/skills/render-engine/satori-text";
import { DISPLAY } from "@/skills/render-engine/templates/match-day/shared";
import { TeamFallback, type FallbackSide, type FallbackTeam } from "@/skills/render-engine/templates/shared/team-fallback";

/**
 * Fotoğrafsız yedek tasarımın sanat katmanı (bkz. `templates/shared/team-fallback.tsx`): Satori ile çizilir, PNG
 * döner; çağıran sharp ile zemine/panele basar. DB'siz ve ağsız (logo zaten `data:` URI) — motor, önizleme, görsel
 * test ve offline araç ortak kullanır. Filigran logonun beyaz silueti (`logoSilhouette`: kendi alfası ya da düz
 * zemin temizliği); temizlenemeyen logoda filigran logonun kendisidir, çok düşük opaklıkla.
 */

/** Yedek tasarımın takım girdisi — kartın kendi alanlarından (ad, ortak renk kuralından hex, logo `data:` URI). */
export interface FallbackTeamSource {
  name: string;
  hex: string;
  logo: string | null;
}

export interface FallbackArtOptions {
  side: FallbackSide;
  mode?: "panel" | "emblem" | undefined;
  focus?: { x: number; y: number } | undefined;
  /** Dev soluk ad (varsayılan: `panel` kipinde açık). */
  type?: boolean | undefined;
  crest?: boolean | undefined;
  /** Adın yatay izinli aralığı (panel koordinatı) — çapraz posterde çizginin kendi tarafı (`posterTypeBounds`). */
  typeBounds?: TypeBounds | undefined;
  /** `emblem` kipinde takım rengi ışığın opaklığı. */
  glowAlpha?: number | undefined;
}

/** Ölçüm puntosu (px) — Anton mürekkep genişliği bu puntoda ölçülüp 1 px'e bölünür. */
const MEASURE_SIZE = 200;
const measured = new Map<string, number>();

/**
 * Metnin Anton'da (yedek tasarımın harf aralığıyla) 1 px puntodaki mürekkep genişliği — Satori ile GERÇEK çizim +
 * sharp kırpma. Süreç içi önbellekli. Tahmini karakter oranı kullanılmaz (canlı test v2: "GÖZTEPE S" kesiği).
 */
export async function measureDisplayEm(text: string): Promise<number> {
  const cached = measured.get(text);
  if (cached !== undefined) return cached;
  const fonts = await loadMatchDayFonts();
  const width = Math.max(400, Math.ceil([...text].length * MEASURE_SIZE * 1.2));
  const height = Math.round(MEASURE_SIZE * 1.6);
  const element = createElement("div", { style: { display: "flex", width, height, alignItems: "center", paddingLeft: 20 } }, createElement("span", { style: { fontFamily: DISPLAY, fontSize: MEASURE_SIZE, lineHeight: 1, color: "#ffffff", letterSpacing: MEASURE_SIZE * TYPE_LETTER_SPACING, whiteSpace: "nowrap" } }, text));
  const png = Buffer.from(await renderSatori(element, { width, height, fonts }).arrayBuffer());
  const { info } = await sharp(png).ensureAlpha().trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  // Kırpma payı: harf aralığının son harften sonraki kısmı mürekkepte görünmez, kutuya eklenir.
  const em = (info.width + MEASURE_SIZE * TYPE_LETTER_SPACING) / MEASURE_SIZE;
  if (measured.size > 256) measured.clear();
  measured.set(text, em);
  return em;
}

/** Ad adayları (uzun → kısa, büyük harf) için yerleşim planı; sığmazsa null (ad yazılmaz). */
export async function fallbackTypePlan(name: string, size: { width: number; height: number }, bounds?: TypeBounds): Promise<FallbackTypePlan | null> {
  const candidates = [name, shortTeamName(name)].map((value) => value.trim().toLocaleUpperCase("tr-TR")).filter((value, index, all) => value !== "" && all.indexOf(value) === index);
  const ems = new Map<string, number>();
  for (const text of candidates) ems.set(text, await measureDisplayEm(text));
  return planFallbackType(candidates, size, (text) => ems.get(text) ?? 0, bounds);
}

const DATA_URI = /^data:image\/[a-z+]+;base64,(.+)$/u;
const silhouettes = new Map<string, Promise<string | null>>();

/** Logo `data:` URI → beyaz siluet (`data:` URI) — süreç içi önbellekli; çözülemezse null. */
export function watermarkOf(logo: string | null): Promise<string | null> {
  if (!logo) return Promise.resolve(null);
  const cached = silhouettes.get(logo);
  if (cached) return cached;
  const match = DATA_URI.exec(logo);
  const pending = match?.[1] ? logoSilhouette(Buffer.from(match[1], "base64")).catch(() => null) : Promise.resolve(null);
  if (silhouettes.size > 64) silhouettes.clear();
  silhouettes.set(logo, pending);
  return pending;
}

export async function fallbackTeam(source: FallbackTeamSource): Promise<FallbackTeam> {
  return { name: source.name.toLocaleUpperCase("tr-TR"), hex: source.hex, logo: source.logo, watermark: await watermarkOf(source.logo) };
}

/** Şeffaf arma kipinin kenarı: odaktan dışa sönen eliptik maske — sahnede dikdörtgen kenar görünmez. */
function softEdges(png: Buffer, width: number, height: number, focus: FallbackArtOptions["focus"]): Promise<Buffer> {
  const cx = Math.round((focus?.x ?? 0.5) * width);
  const cy = Math.round((focus?.y ?? 0.4) * height);
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><radialGradient id="m" cx="${cx}" cy="${cy}" r="${Math.max(1, Math.min(cx, width - cx, cy, height - cy))}" gradientUnits="userSpaceOnUse"><stop offset="0.5" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#m)"/></svg>`);
  return sharp(png).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

/** Yedek tasarım → PNG (`panel`: opak, `emblem`: şeffaf zeminli). */
export async function renderTeamFallback(source: FallbackTeamSource, size: { width: number; height: number }, options: FallbackArtOptions): Promise<Buffer> {
  const width = Math.max(1, Math.round(size.width));
  const height = Math.max(1, Math.round(size.height));
  const mode = options.mode ?? "panel";
  const wantsType = options.type ?? mode === "panel";
  const [team, fonts, typePlan] = await Promise.all([fallbackTeam(source), loadMatchDayFonts(), wantsType ? fallbackTypePlan(source.name, { width, height }, options.typeBounds) : Promise.resolve(null)]);
  const element = createElement(TeamFallback, { team, width, height, side: options.side, mode, focus: options.focus, typePlan, glowAlpha: options.glowAlpha, ...(options.crest === undefined ? {} : { crest: options.crest }) });
  const response = renderSatori(element, { width, height, fonts });
  const png = await sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
  return options.mode === "emblem" ? softEdges(png, width, height, options.focus) : png;
}
