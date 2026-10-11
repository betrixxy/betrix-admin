import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { BODY, EYEBROW, GRAY, GREEN, GREEN_BR, NAVY_800, SCORE, TEAM, rgba, upper } from "../deep-analysis/deep-analysis-tokens";

/**
 * Muhtemel 11 kartlarının ortak çerçevesi (iki şablon da kullanır): büyük "İLK 11 / MUHTEMEL 11"
 * başlığı + takım/rakip logoları (üst), CheckMatch imzası + diziliş + maç künyesi (alt) ve renk yardımcıları.
 */

export const LINEUP_CARD_SIZE = { width: 1080, height: 1350 } as const;
export const W = LINEUP_CARD_SIZE.width;
export const H = LINEUP_CARD_SIZE.height;
export const PAD = 56;
export const DEEP = "#050b15";
/** Başlık bloğunun altı — şablonların içerik alanı buradan başlar. */
export const CONTENT_TOP = 330;
/** Alt imza perdesinin üstü — içerik alanı burada biter. */
export const CONTENT_BOTTOM = 1120;

const LIGHT_KIT_LUMINANCE = 0.62;
const LIGHT_KIT_TINT = "#1f4277";
const BRAND_LOGO_HEIGHT = 54;
const FOOTER_HEIGHT = 230;

/** Formdan gelen renk geçersizse marka yeşili. */
export function kitColor(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex : GREEN;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return 0;
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/** İki rengi karıştırır (`amount` = ilk rengin payı) — takım rengini laciverte gömmek için. */
export function mix(hex: string, base: string, amount: number): string {
  const parse = (value: string) => {
    const n = Number.parseInt(value.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [a, b] = [parse(hex), parse(base)];
  const channel = (i: number) => Math.round((a[i] ?? 0) * amount + (b[i] ?? 0) * (1 - amount));
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
}

/** Açık formalar (beyaz/krem) zemine gri pus olarak düşer ve beyaz metnin kontrastını öldürür — zeminde laciverte dönülür. */
export function backgroundTint(hex: string): string {
  return luminance(hex) > LIGHT_KIT_LUMINANCE ? LIGHT_KIT_TINT : hex;
}

/** Forma rengi açıksa lacivert, koyuysa beyaz numara (okunabilirlik). */
export function numberColor(hex: string): string {
  return luminance(hex) > 160 / 255 ? NAVY_800 : "white";
}

/** Kartta görünen ad: uzun tam addan soyadı; admin formda kısa ad yazarsa olduğu gibi kalır. */
export function displayName(name: string, maxChars: number): string {
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.split(/\s+/).at(-1) ?? trimmed;
}

/** "MUHTEMEL 11" → ["MUHTEMEL", "11"]: sondaki "11" neon yeşil vurgulanır. */
function splitHeadline(headline: string): [string, string] {
  const text = upper(headline.trim());
  const match = /^(.*?)\s*(11)$/.exec(text);
  return match ? [match[1] ?? "", match[2] ?? ""] : [text, ""];
}

export function LineupHeader({ headline, teamName, opponentName, logoUrl, opponentLogoUrl }: { headline: string; teamName: string; opponentName: string; logoUrl: string; opponentLogoUrl: string }) {
  const [lead, accent] = splitHeadline(headline);
  const headlineSize = lead.length > 5 ? 88 : 108;
  return (
    <div tw="flex items-start justify-between" style={{ position: "absolute", left: PAD, top: PAD - 8, width: W - PAD * 2 }}>
      <div tw="flex flex-col" style={{ maxWidth: 760 }}>
        <div tw="flex items-end" style={{ gap: 18 }}>
          {lead ? <span style={{ fontFamily: SCORE, fontSize: headlineSize, lineHeight: 0.95, color: "white", letterSpacing: 1, textShadow: "0 4px 24px rgba(0,0,0,0.55)" }}>{lead}</span> : null}
          {accent ? (
            <span style={{ fontFamily: SCORE, fontSize: headlineSize, lineHeight: 0.95, color: GREEN_BR, textShadow: `0 0 34px ${rgba(GREEN_BR, 0.45)}` }}>{accent}</span>
          ) : null}
        </div>
        <div tw="flex items-center" style={{ gap: 14, marginTop: 20 }}>
          <div style={{ width: 6, height: 40, borderRadius: 3, backgroundColor: GREEN_BR }} />
          <span style={{ fontFamily: TEAM, fontWeight: 800, fontSize: teamName.length > 18 ? 36 : 44, color: "white", lineHeight: 1, letterSpacing: 0.4 }}>{upper(teamName)}</span>
        </div>
        {opponentName ? (
          <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 20, color: GRAY, marginTop: 12, marginLeft: 20, letterSpacing: 2 }}>{`VS ${upper(opponentName)}`}</span>
        ) : null}
      </div>
      <div tw="flex flex-col items-center" style={{ gap: 12 }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
          <img src={logoUrl} alt="" width={140} height={140} style={{ objectFit: "contain" }} />
        ) : null}
        {opponentLogoUrl ? (
          <div tw="flex items-center" style={{ gap: 10 }}>
            <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 16, letterSpacing: 3, color: GRAY }}>VS</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
            <img src={opponentLogoUrl} alt="" width={52} height={52} style={{ objectFit: "contain", opacity: 0.9 }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Alt imza: soldaki CheckMatch logosu (".net"siz, en üst katman) + sağda diziliş, künye, teknik direktör. */
export function LineupFooter({ brandLogo, formation, matchLabel, coach }: { brandLogo: string; formation: string; matchLabel: string; coach: string }) {
  const logoWidth = brandLogoWidth(BRAND_LOGO_HEIGHT);
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
        backgroundImage: `linear-gradient(180deg, ${rgba(DEEP, 0)} 0%, ${rgba(DEEP, 0.9)} 58%, ${DEEP} 100%)`,
      }}
    >
      <div tw="flex flex-col" style={{ gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
        <img src={brandLogo} alt={BRAND_LOGO_ALT} width={logoWidth} height={BRAND_LOGO_HEIGHT} />
        <div style={{ width: logoWidth, height: 3, backgroundImage: `linear-gradient(90deg, ${GREEN_BR} 0%, ${rgba(GREEN_BR, 0)} 100%)` }} />
      </div>
      <div tw="flex flex-col items-end" style={{ gap: 10 }}>
        <div tw="flex items-center" style={{ gap: 12 }}>
          <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 15, letterSpacing: 4, color: GRAY }}>DİZİLİŞ</span>
          <div tw="flex" style={{ padding: "3px 14px", borderRadius: 10, backgroundColor: rgba(GREEN_BR, 0.14), border: `1px solid ${rgba(GREEN_BR, 0.6)}` }}>
            <span style={{ fontFamily: SCORE, fontSize: 28, color: GREEN_BR, letterSpacing: 1 }}>{formation}</span>
          </div>
        </div>
        {matchLabel ? <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 17, letterSpacing: 1.5, color: "white", opacity: 0.88 }}>{upper(matchLabel)}</span> : null}
        {coach.trim() ? <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 18, color: GRAY }}>{`Teknik Direktör: ${coach.trim()}`}</span> : null}
      </div>
    </div>
  );
}
