import type { MatchDayCard } from "@/types/match-day";

/**
 * Maç Günü şablonlarının ortak yapı taşları (Satori). Satori yalnızca flexbox ve CSS alt
 * kümesini destekler: çok çocuklu her `div` `flex`'tir; `backdrop-filter` yoktur.
 * Görsel dil: yayın/ajans grafiği — tok renkler, ince ayraçlar, açık harf aralıklı küçük
 * başlıklar. Neon, parlama, gradyan metin yok.
 */
export const DISPLAY = "Anton";
export const SERIF = "DM Serif Display";
export const BODY = "Geist";
export const GOLD = "#F5C518";
export const TEXT_SHADOW = "0 2px 18px rgba(0,0,0,0.65)";

/** Bir karakterin yaklaşık genişliği (em): Anton ≈ 0.46, DM Serif ≈ 0.5, Geist kalın ≈ 0.62. */
export function fitFontSize(text: string, maxWidth: number, maxSize: number, emPerChar = 0.46, minSize = 24): number {
  const size = Math.floor(maxWidth / Math.max(1, text.length * emPerChar));
  return Math.max(minSize, Math.min(maxSize, size));
}

export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Kart verisindeki "bilinmiyor" yer tutucusu (`match-day-assets.ts`) — şablonlar bunu çizmez. */
const PLACEHOLDER = "—";

/** Değer gerçekten biliniyorsa onu, boş ya da yer tutucuysa `null` döner. */
export function known(value: string | null | undefined): string | null {
  return value && value !== PLACEHOLDER ? value : null;
}

export function px(value: number, k: number): number {
  return Math.round(value * k);
}

export function TeamLogo({ src, name, size }: { src: string | null; name: string; size: number }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
    return <img src={src} alt="" width={size} height={size} style={{ objectFit: "contain" }} />;
  }
  return (
    <div
      tw="flex items-center justify-center rounded-full text-white"
      style={{
        width: size,
        height: size,
        fontFamily: DISPLAY,
        fontSize: size * 0.4,
        backgroundColor: "rgba(255,255,255,0.08)",
        border: "2px solid rgba(255,255,255,0.3)",
      }}
    >
      {name.slice(0, 2)}
    </div>
  );
}

export function LeagueLogo({ card, size }: { card: MatchDayCard; size: number }) {
  if (!card.leagueLogo) return null;
  return (
    <div
      tw="flex items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.18, backgroundColor: "rgba(255,255,255,0.94)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
      <img src={card.leagueLogo} alt="" width={size * 0.74} height={size * 0.74} style={{ objectFit: "contain" }} />
    </div>
  );
}

const BRAND_RATIO = 1588 / 258;

export function BrandLogo({ card, height }: { card: MatchDayCard; height: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
    <img src={card.brandLogo} alt="CheckMatch.net" width={Math.round(height * BRAND_RATIO)} height={height} />
  );
}

/** Açık harf aralıklı küçük başlık — "4. HAFTA · UEFA ULUSLAR LİGİ" gibi künye satırları. */
export function Eyebrow({ children, size, color = "rgba(255,255,255,0.86)" }: { children: string; size: number; color?: string }) {
  return (
    <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, letterSpacing: size * 0.32, color }}>{children}</span>
  );
}

export function competitionLine(card: MatchDayCard): string {
  return [card.weekLabel, card.leagueLabel].filter(Boolean).join("  ·  ");
}

/** Şeffaf tuval — AI görselinin üstüne basılır; tüm katmanlar mutlak konumlu. */
export function Canvas({ children }: { children: React.ReactNode }) {
  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, backgroundColor: "transparent" }}>
      {children}
    </div>
  );
}
