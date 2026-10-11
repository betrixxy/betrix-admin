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
  const headlineSize = lead.length > 5 ? 88 : 108;
  return (
    <div tw="flex items-start justify-between" style={{ position: "absolute", left: PAD, top: PAD - 8, width: W - PAD * 2 }}>
      <div tw="flex flex-col" style={{ maxWidth: 760 }}>
        <div tw="flex items-end" style={{ gap: 18 }}>
          {lead ? <span style={{ fontFamily: SCORE, fontSize: headlineSize, lineHeight: 0.95, color: palette.text, letterSpacing: 1, textShadow: "0 4px 24px rgba(0,0,0,0.55)" }}>{lead}</span> : null}
          {accent ? (
            <span style={{ fontFamily: SCORE, fontSize: headlineSize, lineHeight: 0.95, color: palette.accent, textShadow: `0 0 34px ${rgba(palette.accent, 0.35)}` }}>{accent}</span>
          ) : null}
        </div>
        <div tw="flex items-center" style={{ gap: 14, marginTop: 20 }}>
          <div style={{ width: 6, height: 40, borderRadius: 3, backgroundColor: palette.accent }} />
          <span style={{ fontFamily: TEAM, fontWeight: 800, fontSize: teamName.length > 18 ? 36 : 44, color: palette.text, lineHeight: 1, letterSpacing: 0.4 }}>{upper(teamName)}</span>
        </div>
        {opponentName ? (
          <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 20, color: palette.muted, marginTop: 12, marginLeft: 20, letterSpacing: 2 }}>{`VS ${upper(opponentName)}`}</span>
        ) : null}
      </div>
      <div tw="flex flex-col items-center" style={{ gap: 12 }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
          <img src={logoUrl} alt="" width={140} height={140} style={{ objectFit: "contain" }} />
        ) : null}
        {opponentLogoUrl ? (
          <div tw="flex items-center" style={{ gap: 10 }}>
            <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 16, letterSpacing: 3, color: palette.muted }}>VS</span>
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
      <div tw="flex flex-col items-end" style={{ gap: 10 }}>
        <div tw="flex items-center" style={{ gap: 12 }}>
          <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 15, letterSpacing: 4, color: palette.muted }}>DİZİLİŞ</span>
          <div tw="flex" style={{ padding: "3px 14px", borderRadius: 10, backgroundColor: rgba(palette.accent, 0.12), border: `1px solid ${rgba(palette.accent, 0.6)}` }}>
            <span style={{ fontFamily: SCORE, fontSize: 28, color: palette.accent, letterSpacing: 1 }}>{formation}</span>
          </div>
        </div>
        {matchLabel ? <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 17, letterSpacing: 1.5, color: palette.text, opacity: 0.88 }}>{upper(matchLabel)}</span> : null}
        {coach.trim() ? <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 18, color: palette.muted }}>{`Teknik Direktör: ${coach.trim()}`}</span> : null}
      </div>
    </div>
  );
}
