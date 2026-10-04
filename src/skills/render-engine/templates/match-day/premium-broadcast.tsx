import type { MatchDayCard } from "@/types/match-day";
import type { TemplateGeometry } from "./geometry";
import {
  BODY,
  BrandLogo,
  Canvas,
  DISPLAY,
  Eyebrow,
  GOLD,
  LeagueLogo,
  TEXT_SHADOW,
  TeamLogo,
  clip,
  competitionLine,
  fitFontSize,
  px,
} from "./shared";

/**
 * PREMIUM BROADCAST — ana akım yayın kuruluşlarının maç önü grafiği: üstte ortalı lig logosu
 * ve künye; oyuncular üst yarıda büyük; belleri hizasında kalın, sıkışık "MAÇ GÜNÜ"; altında
 * ince ayraçlı logo çifti, takım adları ve tek satırlık künye. Tok renkler, süs yok.
 */

function InfoLine({ card, size }: { card: MatchDayCard; size: number }) {
  const items = [card.dateLabel, card.timeLabel, clip(card.stadiumLabel, 30)].filter((item) => item && item !== "—");
  return (
    <div tw="flex items-center">
      {items.map((item, index) => (
        <div key={item} tw="flex items-center">
          {index > 0 ? (
            <div tw="flex" style={{ width: 1, height: size * 0.9, backgroundColor: "rgba(255,255,255,0.4)", margin: `0 ${size * 0.9}px` }} />
          ) : null}
          <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size, letterSpacing: size * 0.1, color: "white" }}>
            {item.toLocaleUpperCase("tr-TR")}
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
  return <Eyebrow size={size} color="rgba(255,255,255,0.6)">{`HAKEM  ·  ${card.refereeLabel.toLocaleUpperCase("tr-TR")}`}</Eyebrow>;
}

function Vertical({ card, g }: { card: MatchDayCard; g: TemplateGeometry }) {
  const { k } = g;
  return (
    <Canvas>
      <div tw="absolute flex flex-col items-center" style={{ left: 0, right: 0, top: g.top }}>
        <LeagueLogo card={card} size={px(72, k)} />
        <div tw="flex" style={{ marginTop: px(14, k) }}>
          <Eyebrow size={px(17, k)}>{competitionLine(card)}</Eyebrow>
        </div>
      </div>

      <div tw="absolute flex flex-col items-center" style={{ left: 0, right: 0, top: g.blockTop }}>
        <span style={{ fontFamily: DISPLAY, fontSize: px(172, k), lineHeight: 0.95, color: "white", textShadow: TEXT_SHADOW }}>
          MAÇ GÜNÜ
        </span>
        <div tw="flex" style={{ width: px(90, k), height: px(4, k), backgroundColor: GOLD, margin: `${px(30, k)}px 0 ${px(22, k)}px` }} />
        <Matchup card={card} logo={px(104, k)} nameSize={px(22, k)} columnWidth={px(320, k)} gap={px(34, k)} />
        <div tw="flex" style={{ marginTop: px(26, k) }}>
          <InfoLine card={card} size={px(19, k)} />
        </div>
        <div tw="flex" style={{ marginTop: px(10, k) }}>
          <Referee card={card} size={px(13, k)} />
        </div>
        <div tw="flex" style={{ marginTop: px(22, k) }}>
          <BrandLogo card={card} height={px(34, k)} />
        </div>
      </div>
    </Canvas>
  );
}

function Landscape({ card, g }: { card: MatchDayCard; g: TemplateGeometry }) {
  return (
    <Canvas>
      <div tw="absolute flex flex-col" style={{ left: g.left, top: g.top, width: 520 }}>
        <div tw="flex items-center">
          <LeagueLogo card={card} size={54} />
          <div tw="flex" style={{ marginLeft: card.leagueLogo ? 16 : 0 }}>
            <Eyebrow size={14}>{competitionLine(card)}</Eyebrow>
          </div>
        </div>
        <span style={{ fontFamily: DISPLAY, fontSize: 124, lineHeight: 0.95, color: "white", marginTop: 34, textShadow: TEXT_SHADOW }}>
          MAÇ GÜNÜ
        </span>
        <div tw="flex" style={{ width: 70, height: 4, backgroundColor: GOLD, margin: "24px 0 26px" }} />
        <Matchup card={card} logo={78} nameSize={17} columnWidth={210} gap={22} />
        <div tw="flex" style={{ marginTop: 26 }}>
          <InfoLine card={card} size={15} />
        </div>
        <div tw="flex" style={{ marginTop: 8 }}>
          <Referee card={card} size={11} />
        </div>
      </div>
      <div tw="absolute flex" style={{ left: g.left, bottom: 34 }}>
        <BrandLogo card={card} height={28} />
      </div>
    </Canvas>
  );
}

export function PremiumBroadcastTemplate({ card, g }: { card: MatchDayCard; g: TemplateGeometry }) {
  return g.frame.orientation === "landscape" ? <Landscape card={card} g={g} /> : <Vertical card={card} g={g} />;
}
