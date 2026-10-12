import type { LineupPalette } from "@/types/lineup";
import { BRAND_LOGO_ALT, brandLogoWidth } from "../brand";
import { BODY, EYEBROW, SCORE, TEAM, rgba, upper } from "../deep-analysis/deep-analysis-tokens";
import type { LineupGeometry } from "./lineup-geometry";

/**
 * Muhtemel 11 kartlarının ortak çerçevesi (iki şablon da kullanır): logodan türetilen derin zemin,
 * büyük "İLK 11 / MUHTEMEL 11" başlığı + takım/rakip logoları (üst), CheckMatch imzası + diziliş +
 * maç künyesi (alt). Tüm renkler `LineupPalette`'ten gelir — sabit yeşil/lacivert yoktur. Konum ve ölçüler
 * formata göre `LineupGeometry`den gelir (yatay formatta başlık ve künye sol sütunda dikilir).
 */

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
/** Archivo Black büyük harf ≈ 0.76 em/karakter — başlık kutusuna sığacak en büyük punto. */
const HEADLINE_CHAR_RATIO = 0.76;

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
export function LineupBackground({ g, palette, glow }: { g: LineupGeometry; palette: LineupPalette; glow: { left: number; top: number; size: number } }) {
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: g.width, height: g.height, backgroundImage: `linear-gradient(160deg, ${palette.backgroundTop} 0%, ${palette.backgroundBottom} 100%)` }} />
      <div style={{ position: "absolute", left: glow.left, top: glow.top, width: glow.size, height: glow.size, backgroundImage: `radial-gradient(${rgba(palette.glow, 0.3)} 0%, ${rgba(palette.glow, 0)} 70.7%)` }} />
    </>
  );
}

export function LineupHeader({
  g,
  headline,
  teamName,
  opponentName,
  logoUrl,
  opponentLogoUrl,
  palette,
}: {
  g: LineupGeometry;
  headline: string;
  teamName: string;
  opponentName: string;
  logoUrl: string;
  opponentLogoUrl: string;
  palette: LineupPalette;
}) {
  const { k } = g;
  const [lead, accent] = splitHeadline(headline);
  // Dikeyde başlığın yanında logo sütunu (140px) durur; yatayda logolar başlığın üstüne çıkar, başlık sütunun tamamını kullanır.
  const headlineRoom = g.landscape ? g.header.width : 780 * k;
  const headlineFit = Math.floor(headlineRoom / ((lead.length + accent.length) * HEADLINE_CHAR_RATIO + 0.22));
  const headlineSize = Math.min(Math.round((lead.length > 5 ? 96 : 120) * k), headlineFit);
  // Dev başlık sıkı (negatif aralık), takım adı ve künye geniş aralıklı — dergi kapağı kontrastı.
  const headlineStyle = { fontFamily: TYPE.DISPLAY, fontSize: headlineSize, lineHeight: 0.84, letterSpacing: -headlineSize * 0.025 };
  const teamSize = Math.round((teamName.length > 18 ? 34 : 42) * k);
  const logoSize = Math.round((g.landscape ? 120 : 140) * k);
  const opponentLogoSize = Math.round(52 * k);

  const titles = (
    <div tw="flex flex-col" style={{ maxWidth: g.landscape ? g.header.width : Math.round(780 * k) }}>
      <div tw="flex items-end" style={{ gap: headlineSize * 0.22 }}>
        {lead ? <span style={{ ...headlineStyle, color: palette.text, textShadow: "0 6px 28px rgba(0,0,0,0.5)" }}>{lead}</span> : null}
        {accent ? <span style={{ ...headlineStyle, color: palette.accent, textShadow: `0 0 36px ${rgba(palette.accent, 0.32)}` }}>{accent}</span> : null}
      </div>
      <div tw="flex items-center" style={{ gap: Math.round(16 * k), marginTop: Math.round(26 * k) }}>
        <div style={{ width: 5, height: Math.round(38 * k), backgroundColor: palette.accent }} />
        <span style={{ fontFamily: TYPE.TEAM, fontWeight: 800, fontSize: teamSize, color: palette.text, lineHeight: 1, letterSpacing: 1.6 }}>{upper(teamName)}</span>
      </div>
      {opponentName ? (
        <div tw="flex items-center" style={{ gap: 12, marginTop: Math.round(14 * k), marginLeft: 21 }}>
          <span style={labelStyle(Math.round(14 * k), palette.accent)}>VS</span>
          <span style={labelStyle(Math.round(17 * k), palette.muted)}>{upper(opponentName)}</span>
        </div>
      ) : null}
    </div>
  );
  const opponentLogo = opponentLogoUrl ? (
    <div tw="flex items-center" style={{ gap: 10 }}>
      <span style={labelStyle(Math.round(13 * k), palette.muted)}>VS</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
      <img src={opponentLogoUrl} alt="" width={opponentLogoSize} height={opponentLogoSize} style={{ objectFit: "contain", opacity: 0.9 }} />
    </div>
  ) : null;
  const teamLogo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
    <img src={logoUrl} alt="" width={logoSize} height={logoSize} style={{ objectFit: "contain" }} />
  ) : null;

  if (g.landscape) {
    return (
      <div tw="flex flex-col" style={{ position: "absolute", left: g.header.left, top: g.header.top, width: g.header.width, gap: 34 }}>
        <div tw="flex items-center" style={{ gap: 22 }}>
          {teamLogo}
          {opponentLogo}
        </div>
        {titles}
      </div>
    );
  }
  return (
    <div tw="flex items-start justify-between" style={{ position: "absolute", left: g.header.left, top: g.header.top, width: g.header.width }}>
      {titles}
      <div tw="flex flex-col items-center" style={{ gap: 12 }}>
        {teamLogo}
        {opponentLogo}
      </div>
    </div>
  );
}

/**
 * Alt imza: CheckMatch logosu (".net"siz, en üst katman) + diziliş, künye, teknik direktör. Dikeyde kanvas
 * altında perdeli bant (logo solda, künye sağda); yatayda sol sütunun altında, sola hizalı blok.
 */
export function LineupFooter({ g, brandLogo, formation, matchLabel, coach, palette }: { g: LineupGeometry; brandLogo: string; formation: string; matchLabel: string; coach: string; palette: LineupPalette }) {
  const { k } = g;
  const logoHeight = Math.round(BRAND_LOGO_HEIGHT * k);
  const logoWidth = brandLogoWidth(logoHeight);
  const night = palette.backgroundBottom;
  const brand = (
    <div tw="flex flex-col" style={{ gap: Math.round(12 * k) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
      <img src={brandLogo} alt={BRAND_LOGO_ALT} width={logoWidth} height={logoHeight} />
      <div style={{ width: logoWidth, height: 3, backgroundImage: `linear-gradient(90deg, ${palette.accent} 0%, ${rgba(palette.accent, 0)} 100%)` }} />
    </div>
  );
  const info = (
    <div tw={g.landscape ? "flex flex-col items-start" : "flex flex-col items-end"} style={{ gap: Math.round(12 * k) }}>
      <div tw="flex items-center" style={{ gap: 14 }}>
        <span style={labelStyle(Math.round(13 * k), palette.muted)}>DİZİLİŞ</span>
        <span style={{ fontFamily: TYPE.DISPLAY, fontSize: Math.round(34 * k), color: palette.accent, letterSpacing: 0.5, lineHeight: 1 }}>{formation}</span>
      </div>
      {matchLabel ? <span style={labelStyle(Math.round(15 * k), palette.text)}>{upper(matchLabel)}</span> : null}
      {coach.trim() ? (
        <div tw="flex items-center" style={{ gap: 10 }}>
          <span style={labelStyle(Math.round(12 * k), palette.muted)}>TEKNİK DİREKTÖR</span>
          <span style={nameStyle(Math.round(19 * k), palette.text)}>{coach.trim()}</span>
        </div>
      ) : null}
    </div>
  );

  if (g.landscape) {
    return (
      <div tw="flex flex-col" style={{ position: "absolute", left: g.header.left, bottom: g.footerInset, width: g.header.width, gap: 40 }}>
        {info}
        {brand}
      </div>
    );
  }
  return (
    <div
      tw="flex items-end justify-between"
      style={{
        position: "absolute",
        left: 0,
        bottom: 0,
        width: g.width,
        height: g.height - g.footerTop,
        padding: `0 ${g.pad}px ${g.footerInset}px`,
        backgroundImage: `linear-gradient(180deg, ${rgba(night, 0)} 0%, ${rgba(night, 0.9)} ${Math.round((230 * 0.58 * 100) / (g.height - g.footerTop))}%, ${night} 100%)`,
      }}
    >
      {brand}
      {info}
    </div>
  );
}
