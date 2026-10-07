import type { LineupCardInput } from "@/types/lineup";
import { BODY, EYEBROW, GRAY, GREEN, GREEN_BR, NAVY_800, SCORE, TEAM, rgba, upper } from "../deep-analysis/deep-analysis-tokens";
import { LineupBoard } from "./lineup-pitch";

/**
 * MUHTEMEL 11 / İLK 11 — premium ajans kartı (Satori, 1080×1350 / IG 4:5).
 *
 * Katmanlar (alttan üste, bkz. CLAUDE.md 3.4): takım renginden türetilen derin degrade zemin
 * (açık formalarda lacivert) → kapak oyuncusunun şeffaf kesimi (sol yarı, alttan taşar) → okunabilirlik
 * perdesi → sağda minimalist taktik tahtası (yalnızca numara + isim, saha çizgisi yok) →
 * üstte büyük başlık + logolar, altta CheckMatch imzası ve maç künyesi. Kapak yoksa tahta tüm
 * genişliğe yayılır. Beyaz metin daima koyu zemin/perde üzerinde ve gölgelidir (kontrast).
 */

export const LINEUP_CARD_SIZE = { width: 1080, height: 1350 } as const;

const W = LINEUP_CARD_SIZE.width;
const H = LINEUP_CARD_SIZE.height;
const PAD = 56;
const DEEP = "#050b15";
const LIGHT_KIT_LUMINANCE = 0.62;
const LIGHT_KIT_TINT = "#1f4277";
const BOARD_TOP = 340;
const BOARD_HEIGHT = 780;
const WITH_HERO = { left: 448, width: 592, layout: { spreadStep: 0.235, maxSpread: 0.9 } } as const;
const WITHOUT_HERO = { left: 70, width: 940, layout: { spreadStep: 0.205, maxSpread: 0.8 } } as const;

export interface LineupHeroImage {
  /** Kırpılmış (boş kenarları atılmış) şeffaf PNG, data URL. */
  src: string;
  width: number;
  height: number;
}

export interface LineupCardData extends LineupCardInput {
  /** CheckMatch.net logosu (data URL). */
  brandLogo: string;
  hero: LineupHeroImage | null;
}

/** İki rengi karıştırır (`amount` = ilk rengin payı) — takım rengini laciverte gömmek için. */
function mix(hex: string, base: string, amount: number): string {
  const parse = (value: string) => {
    const n = Number.parseInt(value.replace("#", ""), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [a, b] = [parse(hex), parse(base)];
  const channel = (i: number) => Math.round((a[i] ?? 0) * amount + (b[i] ?? 0) * (1 - amount));
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
}

/** "MUHTEMEL 11" → ["MUHTEMEL", "11"]: sondaki "11" neon yeşil vurgulanır. */
function splitHeadline(headline: string): [string, string] {
  const text = upper(headline.trim());
  const match = /^(.*?)\s*(11)$/.exec(text);
  return match ? [match[1] ?? "", match[2] ?? ""] : [text, ""];
}

function Header({ headline, teamName, opponentName, logoUrl, opponentLogoUrl }: { headline: string; teamName: string; opponentName: string; logoUrl: string; opponentLogoUrl: string }) {
  const [lead, accent] = splitHeadline(headline);
  const headlineSize = lead.length > 5 ? 84 : 104;
  return (
    <div tw="flex items-start justify-between" style={{ position: "absolute", left: PAD, top: PAD - 8, width: W - PAD * 2 }}>
      <div tw="flex flex-col" style={{ maxWidth: 760 }}>
        <div tw="flex items-end" style={{ gap: 18 }}>
          {lead ? <span style={{ fontFamily: SCORE, fontSize: headlineSize, lineHeight: 0.95, color: "white", letterSpacing: 1 }}>{lead}</span> : null}
          {accent ? (
            <span style={{ fontFamily: SCORE, fontSize: headlineSize, lineHeight: 0.95, color: GREEN_BR, textShadow: `0 0 34px ${rgba(GREEN_BR, 0.45)}` }}>{accent}</span>
          ) : null}
        </div>
        <div tw="flex items-center" style={{ gap: 14, marginTop: 18 }}>
          <div style={{ width: 6, height: 40, borderRadius: 3, backgroundColor: GREEN_BR }} />
          <span style={{ fontFamily: TEAM, fontWeight: 800, fontSize: teamName.length > 18 ? 36 : 44, color: "white", lineHeight: 1, letterSpacing: 0.4 }}>{upper(teamName)}</span>
        </div>
        {opponentName ? (
          <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 22, color: GRAY, marginTop: 10, marginLeft: 20, letterSpacing: 0.6 }}>
            {`vs ${upper(opponentName)}`}
          </span>
        ) : null}
      </div>
      <div tw="flex flex-col items-center" style={{ gap: 10 }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
          <img src={logoUrl} alt="" width={136} height={136} style={{ objectFit: "contain" }} />
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

function Footer({ brandLogo, formation, matchLabel, coach }: { brandLogo: string; formation: string; matchLabel: string; coach: string }) {
  return (
    <div
      tw="flex items-end justify-between"
      style={{ position: "absolute", left: 0, bottom: 0, width: W, height: 220, padding: `0 ${PAD}px 50px`, backgroundImage: `linear-gradient(180deg, ${rgba(DEEP, 0)} 0%, ${rgba(DEEP, 0.92)} 62%, ${DEEP} 100%)` }}
    >
      <div tw="flex flex-col" style={{ gap: 12 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
        <img src={brandLogo} alt="CheckMatch.net" width={282} height={55} />
        <div style={{ width: 282, height: 3, backgroundImage: `linear-gradient(90deg, ${GREEN_BR} 0%, ${rgba(GREEN_BR, 0)} 100%)` }} />
      </div>
      <div tw="flex flex-col items-end" style={{ gap: 10 }}>
        <div tw="flex items-center" style={{ gap: 12 }}>
          <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 15, letterSpacing: 4, color: GRAY }}>DİZİLİŞ</span>
          <div tw="flex" style={{ padding: "3px 14px", borderRadius: 10, backgroundColor: rgba(GREEN_BR, 0.14), border: `1px solid ${rgba(GREEN_BR, 0.6)}` }}>
            <span style={{ fontFamily: SCORE, fontSize: 28, color: GREEN_BR, letterSpacing: 1 }}>{formation}</span>
          </div>
        </div>
        {matchLabel ? <span style={{ fontFamily: EYEBROW, fontWeight: 700, fontSize: 17, letterSpacing: 1.5, color: "white", opacity: 0.85 }}>{upper(matchLabel)}</span> : null}
        {coach.trim() ? <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 18, color: GRAY }}>{`Teknik Direktör: ${coach.trim()}`}</span> : null}
      </div>
    </div>
  );
}

/** Açık formalar (beyaz/krem) zemine gri pus olarak düşer ve beyaz metnin kontrastını öldürür — zeminde laciverte dönülür. */
function backgroundTint(hex: string): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > LIGHT_KIT_LUMINANCE ? LIGHT_KIT_TINT : hex;
}

export function LineupCard({ team, opponentName, opponentLogoUrl, headline, matchLabel, brandLogo, hero }: LineupCardData) {
  const colorHex = /^#[0-9a-f]{6}$/i.test(team.colorHex) ? team.colorHex : GREEN;
  const tint = backgroundTint(colorHex);
  const board = hero ? WITH_HERO : WITHOUT_HERO;
  // Kapak sol yarıda, alttan taşacak şekilde ortalanır.
  const heroLeft = hero ? Math.round(Math.max(-40, (500 - hero.width) / 2)) : 0;

  return (
    <div tw="relative flex h-full w-full" style={{ fontFamily: BODY, color: "white", backgroundColor: DEEP, overflow: "hidden" }}>
      {/* Zemin: takım rengi laciverte gömülü derin degrade + kapak arkasında renk parıltısı. */}
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, backgroundImage: `linear-gradient(155deg, ${mix(tint, NAVY_800, 0.46)} 0%, ${NAVY_800} 50%, ${DEEP} 100%)` }} />
      <div style={{ position: "absolute", left: -420, top: 180, width: 1300, height: 1300, backgroundImage: `radial-gradient(${rgba(tint, 0.42)} 0%, ${rgba(tint, 0)} 70.7%)` }} />

      {hero ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
          <img src={hero.src} alt="" width={hero.width} height={hero.height} style={{ position: "absolute", left: heroLeft, bottom: 0 }} />
          {/* Okunabilirlik perdesi: tahtanın altında zemin koyulaşır, kapağın sağ kenarı yumuşar. */}
          <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, backgroundImage: `linear-gradient(90deg, ${rgba(DEEP, 0)} 34%, ${rgba(DEEP, 0.55)} 48%, ${rgba(DEEP, 0.72)} 100%)` }} />
        </>
      ) : null}

      {/* Tahta paneli */}
      <div
        style={{
          position: "absolute",
          left: board.left - 16,
          top: BOARD_TOP - 26,
          width: board.width + 32,
          height: BOARD_HEIGHT + 30,
          borderRadius: 32,
          backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 100%)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      />
      <div tw="flex" style={{ position: "absolute", left: board.left, top: BOARD_TOP }}>
        <LineupBoard formation={team.formation} slots={team.slots} colorHex={colorHex} width={board.width} height={BOARD_HEIGHT} layout={board.layout} />
      </div>

      <Header headline={headline} teamName={team.teamName} opponentName={opponentName} logoUrl={team.logoUrl} opponentLogoUrl={opponentLogoUrl} />
      <Footer brandLogo={brandLogo} formation={team.formation} matchLabel={matchLabel} coach={team.coach} />
    </div>
  );
}
