import type { MatchDayCard } from "@/types/match-day";
import { blockOpacity, type BlockFilter, type LayoutBlockId } from "../checkmatch-set/blocks";
import type { TemplateGeometry } from "./geometry";
import {
  BODY,
  BrandLogo,
  Canvas,
  DISPLAY,
  DISPLAY_DESCENT_EM,
  Eyebrow,
  GOLD,
  TEXT_SHADOW,
  TeamLogo,
  clip,
  competitionLine,
  fitFontSize,
  px,
  upperReferee,
  upperStadium,
} from "./shared";

/**
 * PREMIUM BROADCAST — ana akım yayın kuruluşlarının maç önü grafiği: üstte ortalı lig logosu
 * ve künye; oyuncular üst yarıda büyük; belleri hizasında kalın, sıkışık "MAÇ GÜNÜ"; altında
 * ince ayraçlı logo çifti, takım adları ve tek satırlık künye. Tok renkler, süs yok.
 */

/** Kartın blokları (yerleşim kapısı) — logo dahil her öğe birine aittir. */
export const PREMIUM_BROADCAST_BLOCKS = ["header-label", "headline", "teams", "md-date", "footer-text", "footer-logo"] as const satisfies readonly LayoutBlockId[];

const shown = (only: BlockFilter, id: LayoutBlockId) => ({ opacity: blockOpacity(only, id) });

function InfoLine({ card, size }: { card: MatchDayCard; size: number }) {
  // Tarih/saat Türkçe büyük harf; stadyum AD (köken kuralı).
  const items = [card.dateLabel, card.timeLabel].filter((item) => item && item !== "—").map((item) => item.toLocaleUpperCase("tr-TR"));
  if (card.stadiumLabel && card.stadiumLabel !== "—") items.push(upperStadium(card, clip(card.stadiumLabel, 30)));
  return (
    <div tw="flex items-center">
      {items.map((item, index) => (
        <div key={item} tw="flex items-center">
          {index > 0 ? (
            <div tw="flex" style={{ width: 1, height: size * 0.9, backgroundColor: "rgba(255,255,255,0.4)", margin: `0 ${size * 0.9}px` }} />
          ) : null}
          <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, letterSpacing: size * 0.1, color: "white" }}>
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}

function Matchup({ card, logo, nameSize, columnWidth, gap }: { card: MatchDayCard; logo: number; nameSize: number; columnWidth: number; gap: number }) {
  const column = (name: string, src: string | null) => (
    <div tw="flex flex-col items-center" style={{ width: columnWidth }}>
      <TeamLogo src={src} name={name} size={logo} />
      <span
        data-wrap
        style={{
          fontFamily: BODY,
          fontWeight: 900,
          fontSize: fitFontSize(name, columnWidth, nameSize, 0.66, 14),
          letterSpacing: nameSize * 0.12,
          color: "white",
          marginTop: nameSize * 0.6,
          textShadow: TEXT_SHADOW,
        }}
      >
        {name}
      </span>
    </div>
  );
  return (
    <div tw="flex items-start">
      {column(card.homeTeam, card.homeLogo)}
      <div tw="flex flex-col items-center" style={{ margin: `0 ${gap}px`, height: logo, justifyContent: "center" }}>
        <div tw="flex" style={{ width: 2, height: logo * 0.78, backgroundColor: "rgba(255,255,255,0.45)" }} />
      </div>
      {column(card.awayTeam, card.awayLogo)}
    </div>
  );
}

function Referee({ card, size }: { card: MatchDayCard; size: number }) {
  if (!card.refereeLabel || card.refereeLabel === "—") return null;
  return <Eyebrow size={size} color="rgba(255,255,255,0.6)">{`HAKEM  ·  ${upperReferee(card)}`}</Eyebrow>;
}

function Vertical({ card, g, only }: { card: MatchDayCard; g: TemplateGeometry; only: BlockFilter }) {
  const { k } = g;
  // Altın çizgi "MAÇ GÜNÜ"nün Ç kuyruğunun (≈ 0,25 em) altında.
  const underlineGap = Math.ceil(px(172, k) * DISPLAY_DESCENT_EM) + px(14, k);
  return (
    <Canvas>
      <div tw="absolute flex flex-col items-center" style={{ left: 0, right: 0, top: g.top }}>
        <div tw="flex" style={{ marginTop: px(14, k), ...shown(only, "header-label") }}>
          <Eyebrow size={px(17, k)}>{competitionLine(card)}</Eyebrow>
        </div>
      </div>

      {/*
        Blok, çizginin kuyruk payı (eski 30 px'ten fazlası) kadar yukarı alınır; ayrıca 16 px — hakemli künyede
        CheckMatch logosu alt kenara 17 px'e iniyordu (yerleşim kapısı, güvenli alan: bant + 24 px).
      */}
      <div tw="absolute flex flex-col items-center" style={{ left: 0, right: 0, top: g.blockTop - (underlineGap - px(30, k)) - px(16, k) }}>
        <div tw="flex flex-col items-center" style={shown(only, "headline")}>
          <span style={{ fontFamily: DISPLAY, fontSize: px(172, k), lineHeight: 0.95, color: "white", textShadow: TEXT_SHADOW }}>
            MAÇ GÜNÜ
          </span>
          {/* Altın çizgi "MAÇ GÜNÜ"nün Ç kuyruğunun (≈ 0,25 em) altında. */}
          <div tw="flex" style={{ width: px(90, k), height: px(4, k), backgroundColor: GOLD, marginTop: underlineGap }} />
        </div>
        <div tw="flex" style={{ marginTop: px(22, k), ...shown(only, "teams") }}>
          <Matchup card={card} logo={px(104, k)} nameSize={px(22, k)} columnWidth={px(320, k)} gap={px(34, k)} />
        </div>
        <div tw="flex" style={{ marginTop: px(26, k), ...shown(only, "md-date") }}>
          <InfoLine card={card} size={px(19, k)} />
        </div>
        <div tw="flex" style={{ marginTop: px(10, k), ...shown(only, "footer-text") }}>
          <Referee card={card} size={px(13, k)} />
        </div>
        <div tw="flex" style={{ marginTop: px(22, k), ...shown(only, "footer-logo") }}>
          <BrandLogo card={card} height={px(34, k)} />
        </div>
      </div>
    </Canvas>
  );
}

function Landscape({ card, g, only }: { card: MatchDayCard; g: TemplateGeometry; only: BlockFilter }) {
  return (
    <Canvas>
      <div tw="absolute flex flex-col" style={{ left: g.left, top: g.top, width: 520 }}>
        <div tw="flex items-center" style={shown(only, "header-label")}>
          <Eyebrow size={14}>{competitionLine(card)}</Eyebrow>
        </div>
        <div tw="flex flex-col" style={{ marginTop: 34, ...shown(only, "headline") }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 124, lineHeight: 0.95, color: "white", textShadow: TEXT_SHADOW }}>MAÇ GÜNÜ</span>
          <div tw="flex" style={{ width: 70, height: 4, backgroundColor: GOLD, marginTop: Math.ceil(124 * DISPLAY_DESCENT_EM) + 12 }} />
        </div>
        <div tw="flex" style={{ marginTop: 26, ...shown(only, "teams") }}>
          <Matchup card={card} logo={78} nameSize={17} columnWidth={210} gap={22} />
        </div>
        <div tw="flex" style={{ marginTop: 26, ...shown(only, "md-date") }}>
          <InfoLine card={card} size={15} />
        </div>
        <div tw="flex" style={{ marginTop: 8, ...shown(only, "footer-text") }}>
          <Referee card={card} size={11} />
        </div>
      </div>
      <div tw="absolute flex" style={{ left: g.left, bottom: 34, ...shown(only, "footer-logo") }}>
        <BrandLogo card={card} height={28} />
      </div>
    </Canvas>
  );
}

export function PremiumBroadcastTemplate({ card, g, only }: { card: MatchDayCard; g: TemplateGeometry; only?: BlockFilter }) {
  return g.frame.orientation === "landscape" ? <Landscape card={card} g={g} only={only} /> : <Vertical card={card} g={g} only={only} />;
}
