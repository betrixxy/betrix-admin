import type { MatchDayCard } from "@/types/match-day";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { wrapLines } from "../../satori-text";
import { upperName } from "@/lib/dashboard/name-case";

/**
 * Maç Günü şablonlarının ortak yapı taşları (Satori). Satori yalnızca flexbox ve CSS alt
 * kümesini destekler: çok çocuklu her `div` `flex`'tir; `backdrop-filter` yoktur.
 * Görsel dil: yayın/ajans grafiği — tok renkler, ince ayraçlar, açık harf aralıklı küçük
 * başlıklar. Neon, parlama, gradyan metin yok.
 */
export const DISPLAY = "Anton";
/**
 * Anton `lineHeight: 1` satır kutusunun dışına taşan mürekkep (ölçüm, Satori, 2026-10-27): Ç/Ş/Ę kuyruğu
 * altta ≈ 0,23 em; üstte İ 0,13 · Ö/Ü 0,14 · Ğ 0,16 · É/Á/Č/Ž 0,18 em (Å 0,31 — kapsam dışı, nadir). Altına/üstüne
 * satır gelen Anton metinde boşluk bundan büyük olur.
 */
export const DISPLAY_DESCENT_EM = 0.25;
export const DISPLAY_ACCENT_EM = 0.2;
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


export function BrandLogo({ card, height }: { card: MatchDayCard; height: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
    <img src={card.brandLogo} alt={BRAND_LOGO_ALT} width={brandLogoWidth(height)} height={height} />
  );
}

/**
 * Harf aralıklı büyük harf Geist Bold'un tahmini genişliği, em/karakter: glif ≈ 0,64 + aralık 0,32;
 * boşluk ≈ 0,10 + 0,32 (mevcut baseline'lardaki satır kırılımlarıyla ayarlandı). `maxWidth` verilirse
 * künye bu genişliğe göre satırlara bölünür (kutudan taşmaz, bkz. satori-text).
 */
const EYEBROW_EM_PER_CHAR = 0.96;
const EYEBROW_SPACE_EM = 0.42;

/** Açık harf aralıklı küçük başlık — "4. HAFTA · UEFA ULUSLAR LİGİ" gibi künye satırları. */
export function Eyebrow({ children, size, color = "rgba(255,255,255,0.86)", maxWidth }: { children: string; size: number; color?: string; maxWidth?: number }) {
  const style = { fontFamily: BODY, fontWeight: 700, fontSize: size, letterSpacing: size * 0.32, color };
  if (maxWidth === undefined) return <span style={style}>{children}</span>;
  return (
    <div tw="flex flex-col">
      {wrapLines(children, maxWidth, size, EYEBROW_EM_PER_CHAR, EYEBROW_SPACE_EM).map((line) => (
        <span key={line} style={style}>
          {line}
        </span>
      ))}
    </div>
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

/** Stadyum adı büyük harfle: kendi harfleri, belirsizse ev sahibinin ülkesi (stadyum ev sahibinde). */
export const upperStadium = (card: Pick<MatchDayCard, "stadiumLabel" | "origins">, stadium = card.stadiumLabel): string => upperName(stadium, card.origins?.home.people);

/** Hakem adı büyük harfle: iki takım aynı ülkedense (yurt içi maç) o ülke, değilse yalnızca kendi harfleri. */
export function upperReferee(card: Pick<MatchDayCard, "refereeLabel" | "origins">): string {
  const home = card.origins?.home.people;
  return upperName(card.refereeLabel, home && home === card.origins?.away.people ? home : null);
}
