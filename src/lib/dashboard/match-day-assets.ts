import { readFile } from "node:fs/promises";
import path from "node:path";
import { format, isValid, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { MAX_UPLOAD_BYTES } from "@/lib/dashboard/image-limits";
import { parseStoredFileUrl, readStoredFile } from "@/lib/dashboard/storage";
import { embedImageBytes } from "@/lib/dashboard/studio-images";
import type { MatchDayCard, MatchDayParams } from "@/types/match-day";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const BRAND_LOGO_FILE = "brand/checkmatch-logo-net.png";
const REMOTE_TIMEOUT_MS = 8000;
const PLACEHOLDER = "—";

/**
 * Satori için gömülü fontlar — hepsi Türkçe karakterleri (Ç, Ğ, İ, Ş, Ö, Ü) kapsar:
 * Geist (gövde metni), Anton (yayın başlıkları) ve DM Serif Display (editoryal serif); hepsi OFL.
 */
const FONT_FILES = [
  { name: "Geist", file: "Geist-Regular.ttf", weight: 400, style: "normal" },
  { name: "Geist", file: "Geist-Bold.ttf", weight: 700, style: "normal" },
  { name: "Geist", file: "Geist-Black.ttf", weight: 900, style: "normal" },
  { name: "Anton", file: "Anton-Regular.ttf", weight: 400, style: "normal" },
  { name: "DM Serif Display", file: "DMSerifDisplay-Regular.ttf", weight: 400, style: "normal" },
  { name: "DM Serif Display", file: "DMSerifDisplay-Italic.ttf", weight: 400, style: "italic" },
] as const;

export interface MatchDayFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700 | 900;
  style: "normal" | "italic";
}

let fontsPromise: Promise<MatchDayFont[]> | null = null;
let brandLogoPromise: Promise<string> | null = null;

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

/** Fontlar süreç başına bir kez okunur. */
export function loadMatchDayFonts(): Promise<MatchDayFont[]> {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async ({ name, file, weight, style }) => ({
      name,
      data: toArrayBuffer(await readFile(path.join(PUBLIC_ROOT, "fonts", file))),
      weight,
      style,
    })),
  ).catch((error: unknown) => {
    fontsPromise = null;
    throw error;
  });
  return fontsPromise;
}

/** CheckMatch.net logosu (data URL) — süreç başına bir kez okunur; diğer şablonlar da kullanır. */
export function loadBrandLogo(): Promise<string> {
  brandLogoPromise ??= readFile(path.join(PUBLIC_ROOT, BRAND_LOGO_FILE))
    .then((bytes) => `data:image/png;base64,${bytes.toString("base64")}`)
    .catch((error: unknown) => {
      brandLogoPromise = null;
      throw error;
    });
  return brandLogoPromise;
}

/** Yerel/özel ağ adreslerine istek atılmasını engeller (SSRF'e karşı temel koruma). */
function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    host === "0.0.0.0" ||
    /^(127|10)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^f[cd][0-9a-f]{2}:/.test(host)
  );
}

async function fetchRemoteImage(ref: string): Promise<Buffer | null> {
  let url: URL;
  try {
    url = new URL(ref);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || isPrivateHost(url.hostname)) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS),
      headers: { "User-Agent": "betrix-studio/1.0 (match-day card renderer)" },
    });
    if (!response.ok) return null;
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_UPLOAD_BYTES) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.byteLength > MAX_UPLOAD_BYTES ? null : bytes;
  } catch {
    return null;
  }
}

/**
 * Görsel referansını (`/api/files/...` veya `http(s)://`) Satori'nin okuyabileceği PNG/JPEG
 * `data:` URI'sine çevirir. WebP vb. biçimler sharp ile dönüştürülür. Başarısızlıkta `null`.
 */
export async function resolveImage(ref: string | undefined, maxSide: number): Promise<string | null> {
  if (!ref) return null;
  const stored = parseStoredFileUrl(ref);
  const bytes = stored ? await readStoredFile(stored.bucket, stored.fileName) : await fetchRemoteImage(ref);
  if (!bytes) return null;
  try {
    return await embedImageBytes(bytes, maxSide);
  } catch {
    return null;
  }
}

function upper(value: string): string {
  return value.toLocaleUpperCase("tr-TR");
}

/** "3" → "3. HAFTA"; serbest metin olduğu gibi (büyük harfle) kullanılır. */
function formatWeek(week: string | undefined): string | null {
  if (!week) return null;
  return /^\d{1,2}$/.test(week) ? `${week}. HAFTA` : upper(week);
}

/** `yyyy-MM-dd` → "Pazartesi"; tarih serbest metinse null. */
function formatWeekday(date: string | undefined): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = parseISO(date);
  return isValid(parsed) ? format(parsed, "EEEE", { locale: tr }) : null;
}

/** `yyyy-MM-dd` → "5 Ekim 2026"; serbest metin olduğu gibi kullanılır. */
function formatDate(date: string | undefined): string {
  if (!date) return PLACEHOLDER;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const parsed = parseISO(date);
    if (isValid(parsed)) return format(parsed, "d MMMM yyyy", { locale: tr });
  }
  return date;
}

const DEFAULT_COLORS = { homeColorHex: "#e11d48", awayColorHex: "#1d4ed8" };

export async function resolveMatchDayCard(
  params: MatchDayParams,
  colors: { homeColorHex: string; awayColorHex: string } = DEFAULT_COLORS,
): Promise<MatchDayCard> {
  const [homePlayerImg, awayPlayerImg, homeLogo, awayLogo, leagueLogo, brandLogo] = await Promise.all([
    resolveImage(params.homePlayerImg, 1350),
    resolveImage(params.awayPlayerImg, 1350),
    resolveImage(params.homeLogo, 300),
    resolveImage(params.awayLogo, 300),
    resolveImage(params.leagueLogo, 160),
    loadBrandLogo(),
  ]);

  return {
    homeTeam: upper(params.homeTeam),
    awayTeam: upper(params.awayTeam),
    homeTeamName: params.homeTeam,
    awayTeamName: params.awayTeam,
    weekdayLabel: formatWeekday(params.date),
    stats: null,
    leagueLabel: upper(params.league ?? "Süper Lig"),
    weekLabel: formatWeek(params.week),
    dateLabel: formatDate(params.date),
    timeLabel: params.time ?? PLACEHOLDER,
    stadiumLabel: params.stadium ?? PLACEHOLDER,
    refereeLabel: params.referee ?? PLACEHOLDER,
    homePlayerImg,
    awayPlayerImg,
    homeLogo,
    awayLogo,
    brandLogo,
    leagueLogo,
    ...colors,
  };
}
