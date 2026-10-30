import sharp from "sharp";
import { createElement } from "react";
import { logoSilhouette } from "@/lib/dashboard/logo-silhouette";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import { renderSatori } from "@/skills/render-engine/satori-text";
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
  type?: boolean | undefined;
  crest?: boolean | undefined;
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
  const [team, fonts] = await Promise.all([fallbackTeam(source), loadMatchDayFonts()]);
  const element = createElement(TeamFallback, { team, width, height, side: options.side, mode: options.mode ?? "panel", focus: options.focus, ...(options.type === undefined ? {} : { type: options.type }), ...(options.crest === undefined ? {} : { crest: options.crest }) });
  const response = renderSatori(element, { width, height, fonts });
  const png = await sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
  return options.mode === "emblem" ? softEdges(png, width, height, options.focus) : png;
}
