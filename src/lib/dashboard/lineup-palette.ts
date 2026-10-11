import type { LineupPalette, LogoSwatches } from "@/types/lineup";

/**
 * Muhtemel 11 renk paleti — takım logosunun Vibrant swatch'larından (saf; sunucu bağımlılığı yok).
 *
 * Zemin baskın koyu rengin (DarkVibrant) geceye gömülmüş halidir; vurgu (saha çizgileri, "11")
 * LightVibrant'tır. Her adım WCAG kontrastıyla denetlenir: zemin beyaz metne ≥ 12:1 (AAA'nın çok
 * üstü), vurgu zemine ≥ 7:1, numara kendi dairesine ≥ 4.5:1 — logo ne olursa olsun kart okunur.
 * Logo okunamazsa API-Football forma rengi, o da yoksa nötr antrasit kullanılır.
 */

const NIGHT = "#06070a";
const WHITE = "#ffffff";
const CREAM = "#f4efe4";
const MUTED_TEXT = "#cdc6b6";
const NEUTRAL_BASE = "#2b2f36";
const NEUTRAL_ACCENT = "#e6e1d6";
const MIN_TEXT_ON_BACKGROUND = 12;
const MIN_ACCENT_CONTRAST = 7;
const MIN_NUMBER_CONTRAST = 4.5;
/** Zeminin altı üstünden belirgin biçimde koyudur — derinlik hissi. */
const BOTTOM_BASE_SHARE = 0.14;
const STEP = 0.04;

const HEX = /^#[0-9a-f]{6}$/i;

function channels(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (rgb: number[]) => `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

/** İki rengi karıştırır (`amount` = ilk rengin payı). */
export function mixHex(a: string, b: string, amount: number): string {
  const [ca, cb] = [channels(a), channels(b)];
  return toHex(ca.map((c, i) => c * amount + (cb[i] ?? 0) * (1 - amount)));
}

/** WCAG göreli parlaklık (0..1). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `color`'ı `toward`'a doğru adım adım kaydırır; `ok` sağlanınca durur (en kötü ihtimalle `toward`). */
function shiftUntil(color: string, toward: string, ok: (candidate: string) => boolean): string {
  for (let share = 1; share > 0; share -= STEP) {
    const candidate = mixHex(color, toward, share);
    if (ok(candidate)) return candidate;
  }
  return toward;
}

/** Numara/isim rengi: dairenin üstünde beyaz mı gece mi daha okunur. */
function textOn(fill: string): string {
  return contrastRatio(fill, WHITE) >= contrastRatio(fill, NIGHT) ? WHITE : NIGHT;
}

const valid = (value: string | null | undefined): string | null => (value && HEX.test(value) ? value.toLowerCase() : null);

/** Bu oranın altında renkli piksel taşıyan logo siyah-beyaz sayılır (küçük renkli detay paleti ele geçirmez). */
export const MONOCHROME_SHARE = 0.25;
const MONOCHROME_KIT = "#f4efe4";

export function lineupPalette(swatches: LogoSwatches | null, kitHex: string): LineupPalette {
  const kitFallback = valid(kitHex);
  const monochrome = swatches !== null && swatches.chromaticShare < MONOCHROME_SHARE;
  // Siyah-beyaz armada canlı swatch'lar küçük detaydan gelir — yok sayılır; zemin antrasit, vurgu gümüş.
  const s: LogoSwatches =
    swatches && !monochrome
      ? swatches
      : { vibrant: null, darkVibrant: null, lightVibrant: null, muted: null, darkMuted: null, lightMuted: null, chromaticShare: 0 };
  const base = monochrome ? NEUTRAL_BASE : (valid(s.darkVibrant) ?? valid(s.vibrant) ?? valid(s.darkMuted) ?? kitFallback ?? NEUTRAL_BASE);

  const backgroundTop = shiftUntil(base, NIGHT, (c) => contrastRatio(c, WHITE) >= MIN_TEXT_ON_BACKGROUND);
  const backgroundBottom = mixHex(base, NIGHT, BOTTOM_BASE_SHARE);
  // Parıltı zeminin kendi tonundan: sarı ışık laciverte düşünce yeşile döner — canlı renk kullanılmaz.
  const glow = mixHex(base, WHITE, 0.72);

  const accentSeed = valid(s.lightVibrant) ?? valid(s.vibrant) ?? valid(s.lightMuted) ?? NEUTRAL_ACCENT;
  const accent = shiftUntil(accentSeed, WHITE, (c) => contrastRatio(c, backgroundTop) >= MIN_ACCENT_CONTRAST);

  // Numara dairesi: logonun canlı rengi (forma rengi değil — API-Football'unki çoğu zaman yanlış/soluk).
  const kitSeed = monochrome ? MONOCHROME_KIT : (valid(s.vibrant) ?? kitFallback ?? valid(s.lightVibrant) ?? accent);
  const kit = contrastRatio(kitSeed, textOn(kitSeed)) >= MIN_NUMBER_CONTRAST ? kitSeed : shiftUntil(kitSeed, NIGHT, (c) => contrastRatio(c, WHITE) >= MIN_NUMBER_CONTRAST);
  // Kaleci kadrodan ayrışmalı: açık kadroya koyu daire, koyu kadroya krem daire.
  const keeper = relativeLuminance(kit) > 0.4 ? mixHex(base, NIGHT, 0.55) : CREAM;

  return {
    backgroundTop,
    backgroundBottom,
    glow,
    accent,
    kit,
    kitText: textOn(kit),
    keeper,
    keeperText: textOn(keeper),
    text: WHITE,
    muted: MUTED_TEXT,
  };
}
