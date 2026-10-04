import type { MatchDayCard, MatchDayTemplateId } from "@/types/match-day";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { DataDrivenTemplate } from "./match-day/data-driven";
import { EditorialPortraitTemplate } from "./match-day/editorial-portrait";
import { matchDayGeometry, type TemplateGeometry } from "./match-day/geometry";
import { PremiumBroadcastTemplate } from "./match-day/premium-broadcast";

/**
 * "Maç Günü" kartı — IG Feed (4:5) formatı, Satori (`@vercel/og`) ile PNG'ye çizilir.
 *
 * - `MatchDayTemplateCard`: üretim hattının kullandığı şeffaf tipografi katmanı; tasarım
 *   şablonu (PREMIUM_BROADCAST / DATA_DRIVEN / EDITORIAL_PORTRAIT) ve platform formatı (4:5, 1:1, 9:16, 16:9) `./match-day/` altındadır.
 * - `MatchDayFeedCard`: eski, kendi arka planını çizen saf HTML/CSS kart — yalnızca devre dışı
 *   `/api/og/match-day` route'u kullanır.
 * Satori yalnızca flexbox ve CSS alt kümesini destekler: çok çocuklu her `div` `flex`'tir,
 * `backdrop-filter` desteklenmediği için cam efekti yarı saydam zemin + kenar + gölgeyle verilir.
 */
export const MATCH_DAY_FEED_SIZE = { width: 1080, height: 1350 } as const;

const W = MATCH_DAY_FEED_SIZE.width;
const H = MATCH_DAY_FEED_SIZE.height;
const YELLOW = "#FACC15";
const LOGO_SIZE = 150;
const BRAND_LOGO_HEIGHT = 58;
const BRAND_LOGO_WIDTH = Math.round((BRAND_LOGO_HEIGHT * 1588) / 258);

/** Sağ kenardaki dikey filigranın kalınlığı (döndürülmeden önceki yüksekliği). */
const WATERMARK_THICKNESS = 120;

function PlayerHalf({ src, side }: { src: string | null; side: "left" | "right" }) {
  const fallback = side === "left" ? "#0B1B3F" : "#06122B";
  return (
    <div tw="flex h-full overflow-hidden" style={{ width: W / 2, backgroundColor: fallback }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
        <img src={src} alt="" width={W / 2} height={H} style={{ objectFit: "cover", objectPosition: "top" }} />
      ) : null}
    </div>
  );
}

function Watermark() {
  return (
    <div
      tw="absolute flex items-center justify-around"
      style={{
        left: W - WATERMARK_THICKNESS / 2 - H / 2,
        top: H / 2 - WATERMARK_THICKNESS / 2,
        width: H,
        height: WATERMARK_THICKNESS,
        transform: "rotate(90deg)",
        opacity: 0.2,
      }}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          tw="font-black"
          style={{
            fontSize: 62,
            flexShrink: 0,
            whiteSpace: "nowrap",
            letterSpacing: -1,
            backgroundImage: "linear-gradient(90deg, #22C55E, #3B82F6)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          MAÇ GÜNÜ
        </span>
      ))}
    </div>
  );
}

function TeamLogo({ src, name }: { src: string | null; name: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur.
    return <img src={src} alt="" width={LOGO_SIZE} height={LOGO_SIZE} style={{ objectFit: "contain" }} />;
  }
  return (
    <div
      tw="flex items-center justify-center rounded-full text-white font-black"
      style={{
        width: LOGO_SIZE,
        height: LOGO_SIZE,
        fontSize: 56,
        backgroundColor: "rgba(255,255,255,0.1)",
        border: "2px solid rgba(255,255,255,0.25)",
      }}
    >
      {name.slice(0, 2)}
    </div>
  );
}

function Team({ logo, name }: { logo: string | null; name: string }) {
  return (
    <div tw="flex flex-col items-center" style={{ width: 340 }}>
      <TeamLogo src={logo} name={name} />
      <span
        tw="mt-8 text-white font-black text-center"
        style={{ fontSize: 44, lineHeight: 1.1, textShadow: "0 4px 18px rgba(0,0,0,0.6)" }}
      >
        {name}
      </span>
    </div>
  );
}

function InfoCell({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      tw="flex flex-1 flex-col items-center px-3"
      style={{ borderRight: last ? "none" : "1px solid rgba(255,255,255,0.15)" }}
    >
      <span tw="font-bold" style={{ color: YELLOW, fontSize: 20, letterSpacing: 4 }}>
        {label}
      </span>
      <span
        tw="mt-3 text-white font-bold text-center"
        style={{ fontSize: value.length > 16 ? 24 : 30, lineHeight: 1.2 }}
      >
        {value}
      </span>
    </div>
  );
}

const LAYOUT = {
  full: { teamsTop: 170, infoTop: 120, glassBg: "rgba(255,255,255,0.08)" },
} as const;

type MatchDayCardVariant = keyof typeof LAYOUT;

const TEXT_SHADOW = "0 4px 24px rgba(0,0,0,0.75)";

export function MatchDayFeedCard({ card, variant = "full" }: { card: MatchDayCard; variant?: MatchDayCardVariant }) {
  const layout = LAYOUT[variant];
  return (
    <div
      tw="relative flex h-full w-full"
      style={{ fontFamily: "Geist", backgroundColor: variant === "full" ? "#020617" : "transparent" }}
    >
      {variant === "full" ? (
        <>
          {/* Arka plan: iki oyuncu yarısı + okunabilirlik için koyu lacivert gradyan örtü */}
          <div tw="absolute inset-0 flex">
            <PlayerHalf src={card.homePlayerImg} side="left" />
            <PlayerHalf src={card.awayPlayerImg} side="right" />
          </div>
          <div
            tw="absolute inset-0 flex"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(2,6,23,0.72) 0%, rgba(3,10,36,0.78) 45%, rgba(2,6,23,0.9) 75%, rgba(2,6,23,0.97) 100%)",
            }}
          />
        </>
      ) : null}

      <Watermark />

      {/* İçerik katmanı */}
      <div tw="absolute inset-0 flex flex-col items-center" style={{ paddingTop: 96, paddingBottom: 64 }}>
        {card.weekLabel ? (
          <span tw="font-black" style={{ color: YELLOW, fontSize: 40, letterSpacing: 8, textShadow: TEXT_SHADOW }}>
            {card.weekLabel}
          </span>
        ) : null}
        <span tw="mt-2 text-white font-black" style={{ fontSize: 64, letterSpacing: 2, textShadow: TEXT_SHADOW }}>
          {card.leagueLabel}
        </span>

        <div tw="flex items-start justify-center" style={{ marginTop: layout.teamsTop }}>
          <Team logo={card.homeLogo} name={card.homeTeam} />
          <div tw="flex items-center justify-center" style={{ width: 160, height: LOGO_SIZE }}>
            <span
              tw="font-black"
              style={{ color: YELLOW, fontSize: 88, fontStyle: "italic", textShadow: "0 6px 24px rgba(250,204,21,0.35)" }}
            >
              VS
            </span>
          </div>
          <Team logo={card.awayLogo} name={card.awayTeam} />
        </div>

        <div
          tw="flex items-start rounded-[32px] py-9 px-4"
          style={{
            marginTop: layout.infoTop,
            width: 900,
            backgroundColor: layout.glassBg,
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          <InfoCell label="TARİH" value={card.dateLabel} />
          <InfoCell label="SAAT" value={card.timeLabel} />
          <InfoCell label="STADYUM" value={card.stadiumLabel} />
          <InfoCell label="HAKEM" value={card.refereeLabel} last />
        </div>

        <div tw="flex flex-1" />
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori yalnızca düz <img> okur. */}
        <img src={card.brandLogo} alt="CheckMatch.net" width={BRAND_LOGO_WIDTH} height={BRAND_LOGO_HEIGHT} />
      </div>
    </div>
  );
}

const TEMPLATE_COMPONENTS: Record<
  MatchDayTemplateId,
  (props: { card: MatchDayCard; g: TemplateGeometry }) => React.ReactElement
> = {
  PREMIUM_BROADCAST: PremiumBroadcastTemplate,
  DATA_DRIVEN: DataDrivenTemplate,
  EDITORIAL_PORTRAIT: EditorialPortraitTemplate,
};

/** Seçili şablonun, seçili formattaki şeffaf tipografi/logo/marka katmanı — AI görselinin üstüne basılır. */
export function MatchDayTemplateCard({
  card,
  template,
  frame,
}: {
  card: MatchDayCard;
  template: MatchDayTemplateId;
  frame: MatchDayFrame;
}) {
  const Template = TEMPLATE_COMPONENTS[template];
  return <Template card={card} g={matchDayGeometry(template, frame)} />;
}
