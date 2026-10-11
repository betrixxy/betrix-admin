import type { LineupPalette } from "@/types/lineup";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { BODY, EYEBROW, SCORE, TEAM, rgba, upper } from "../deep-analysis/deep-analysis-tokens";

/**
 * Muhtemel 11 kartlarının ortak çerçevesi (iki şablon da kullanır): logodan türetilen derin zemin,
 * büyük "İLK 11 / MUHTEMEL 11" başlığı + takım/rakip logoları (üst), CheckMatch imzası + diziliş +
 * maç künyesi (alt). Tüm renkler `LineupPalette`'ten gelir — sabit yeşil/lacivert yoktur.
 */

export const LINEUP_CARD_SIZE = { width: 1080, height: 1350 } as const;
export const W = LINEUP_CARD_SIZE.width;
export const H = LINEUP_CARD_SIZE.height;
export const PAD = 56;
/** Başlık bloğunun altı — şablonların içerik alanı buradan başlar. */
export const CONTENT_TOP = 330;
/** Alt imza perdesinin üstü — içerik alanı burada biter. */
export const CONTENT_BOTTOM = 1120;

/**
 * Tipografi rolleri (spor dergisi kapağı hiyerarşisi). KURAL: insan adları (oyuncu, teknik direktör)
 * yalnızca `NAME` ile ve ince (500/600) yazılır; başlık, numara ve diziliş kalın display (`DISPLAY`), takım adı
 * `TEAM`, künye/etiketler geniş aralıklı mono (`INFO`) — isimler hiçbir zaman çevresindeki metinle aynı fontu paylaşmaz.
 */
export const TYPE = {
  /** Archivo Black — dev başlık, forma numaraları, diziliş: kalın, sıkı, karakterli. */
  DISPLAY: SCORE,
  /** Bricolage Grotesque ExtraBold — yalnızca takım adı. */
  TEAM,
  /** Space Mono — üst/alt künye ve etiketler (VS, DİZİLİŞ, maç bilgisi, mevki): küçük, geniş aralıklı. */
  INFO: EYEBROW,
  /** Manrope Medium/SemiBold — oyuncu/teknik direktör adları: temiz, zarif, yüksek okunurluk (asla ExtraBold). */
  NAME: BODY,
} as const;

/** Künye/etiket stili: küçük punto, 2-4px harf aralığı, mono (dergi künyesi). */
export const labelStyle = (fontSize: number, color: string) => ({ fontFamily: TYPE.INFO, fontWeight: 700, fontSize, letterSpacing: Math.min(4, Math.max(2, Math.round(fontSize * 0.2))), color, lineHeight: 1 });

/** İsim stili: Manrope, ince ağırlık, hafif açık harf aralığı. */
export const nameStyle = (fontSize: number, color: string, weight: 500 | 600 = 600) => ({ fontFamily: TYPE.NAME, fontWeight: weight, fontSize, letterSpacing: 0.5, color, lineHeight: 1.1 });

const BRAND_LOGO_HEIGHT = 54;
const FOOTER_HEIGHT = 230;

/** Kartta görünen ad: uzun tam addan soyadı; admin formda kısa ad yazarsa olduğu gibi kalır. */
export function displayName(name: string, maxChars: number): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.split(/\s+/).at(-1) ?? trimmed;
}

/** "MUHTEMEL 11" → ["MUHTEMEL", "11"]: sondaki "11" vurgu rengiyle yazılır. */
function splitHeadline(headline: string): [string, string] {
  const text = upper(headline.trim());
  const match = /^(.*?)\s*(11)$/.exec(text);
  return match ? [match[1] ?? "", match[2] ?? ""] : [text, ""];
}

/**
 * Zemin: baskın koyu renkten geceye inen degrade + zeminin açık tonunda yumuşak ışık. Işık kutusu kanvasın
 * içinde kalmalı: Satori negatif `left`li kutunun degradesini kanvas genişliğinde keser (sert dikey kenar).
 */
export function LineupBackground({ palette, glow }: { palette: LineupPalette; glow: { left: number; top: number; size: number } }) {
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, backgroundImage: `linear-gradient(160deg, ${palette.backgroundTop} 0%, ${palette.backgroundBottom} 100%)` }} />
      <div style={{ position: "absolute", left: glow.left, top: glow.top, width: glow.size, height: glow.size, backgroundImage: `radial-gradient(${rgba(palette.glow, 0.3)} 0%, ${rgba(palette.glow, 0)} 70.7%)` }} />
    </>
  );
}

export function LineupHeader({
  headline,
  teamName,
  opponentName,
  logoUrl,
  opponentLogoUrl,
  palette,
}: {
  headline: string;
  teamName: string;
  opponentName: string;
  logoUrl: string;
  opponentLogoUrl: string;
  palette: LineupPalette;
}) {
  const [lead, accent] = splitHeadline(headline);
  const headlineSize = lead.length > 5 ? 96 : 120;
  // Dev başlık sıkı (negatif aralık), takım adı ve künye geniş aralıklı — dergi kapağı kontrastı.
  const headlineStyle = { fontFamily: TYPE.DISPLAY, fontSize: headlineSize, lineHeight: 0.84, letterSpacing: -headlineSize * 0.025 };
  return (
    <div tw="flex items-start justify-between" style={{ position: "absolute", left: PAD, top: PAD - 4, width: W - PAD * 2 }}>
      <div tw="flex flex-col" style={{ maxWidth: 780 }}>
        <div tw="flex items-end" style={{ gap: headlineSize * 0.22 }}>
          {lead ? <span style={{ ...headlineStyle, color: palette.text, textShadow: "0 6px 28px rgba(0,0,0,0.5)" }}>{lead}</span> : null}
          {accent ? <span style={{ ...headlineStyle, color: palette.accent, textShadow: `0 0 36px ${rgba(palette.accent, 0.32)}` }}>{accent}</span> : null}
        </div>
        <div tw="flex items-center" style={{ gap: 16, marginTop: 26 }}>
          <div style={{ width: 5, height: 38, backgroundColor: palette.accent }} />
          <span style={{ fontFamily: TYPE.TEAM, fontWeight: 800, fontSize: teamName.length > 18 ? 34 : 42, color: palette.text, lineHeight: 1, letterSpacing: 1.6 }}>{upper(teamName)}</span>
        </div>
        {opponentName ? (
          <div tw="flex items-center" style={{ gap: 12, marginTop: 14, marginLeft: 21 }}>
            <span style={labelStyle(14, palette.accent)}>VS</span>
            <span style={labelStyle(17, palette.muted)}>{upper(opponentName)}</span>
          </div>
        ) : null}
      </div>
      <div tw="flex flex-col items-center" style={{ gap: 12 }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
          <img src={logoUrl} alt="" width={140} height={140} style={{ objectFit: "contain" }} />
        ) : null}
        {opponentLogoUrl ? (
          <div tw="flex items-center" style={{ gap: 10 }}>
            <span style={labelStyle(13, palette.muted)}>VS</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
            <img src={opponentLogoUrl} alt="" width={52} height={52} style={{ objectFit: "contain", opacity: 0.9 }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Alt imza: soldaki CheckMatch logosu (".net"siz, en üst katman) + sağda diziliş, künye, teknik direktör. */
export function LineupFooter({ brandLogo, formation, matchLabel, coach, palette }: { brandLogo: string; formation: string; matchLabel: string; coach: string; palette: LineupPalette }) {
  const logoWidth = brandLogoWidth(BRAND_LOGO_HEIGHT);
  const night = palette.backgroundBottom;
  return (
    <div
      tw="flex items-end justify-between"
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        width: W,
        height: FOOTER_HEIGHT,
        padding: `0 ${PAD}px 50px`,
        backgroundImage: `linear-gradient(180deg, ${rgba(night, 0)} 0%, ${rgba(night, 0.9)} 58%, ${night} 100%)`,
      }}
    >
      <div tw="flex flex-col" style={{ gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
        <img src={brandLogo} alt={BRAND_LOGO_ALT} width={logoWidth} height={BRAND_LOGO_HEIGHT} />
        <div style={{ width: logoWidth, height: 3, backgroundImage: `linear-gradient(90deg, ${palette.accent} 0%, ${rgba(palette.accent, 0)} 100%)` }} />
      </div>
      <div tw="flex flex-col items-end" style={{ gap: 12 }}>
        <div tw="flex items-center" style={{ gap: 14 }}>
          <span style={labelStyle(13, palette.muted)}>DİZİLİŞ</span>
          <span style={{ fontFamily: TYPE.DISPLAY, fontSize: 34, color: palette.accent, letterSpacing: 0.5, lineHeight: 1 }}>{formation}</span>
        </div>
        {matchLabel ? <span style={labelStyle(15, palette.text)}>{upper(matchLabel)}</span> : null}
        {coach.trim() ? (
          <div tw="flex items-center" style={{ gap: 10 }}>
            <span style={labelStyle(12, palette.muted)}>TEKNİK DİREKTÖR</span>
            <span style={nameStyle(19, palette.text)}>{coach.trim()}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
