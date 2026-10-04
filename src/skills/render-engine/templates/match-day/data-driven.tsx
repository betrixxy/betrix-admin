import type { MatchDayCard, MatchDayStats } from "@/types/match-day";
import type { TemplateGeometry } from "./geometry";
import { BODY, BrandLogo, Canvas, DISPLAY, Eyebrow, GOLD, LeagueLogo, TeamLogo, clip, competitionLine, fitFontSize, px } from "./shared";

/**
 * DATA DRIVEN — spor veri ajansı (AA/Opta) infografiği: koyu düz zemin, tek vurgu rengi,
 * sol kolonda başlık + büyük tarih bloğu, altta çerçeveli veri kutuları (son 5 maç formu,
 * gol ortalaması, aralarındaki maçlar). Tüm sayılar API-Football'dan gelir; veri yoksa
 * kutular künyeye döner — uydurma sayı asla çizilmez.
 */

const FORM_STYLE = {
  W: { letter: "G", bg: "#15803d" },
  D: { letter: "B", bg: "#52525b" },
  L: { letter: "M", bg: "#b91c1c" },
} as const;

/** Koyu zeminde okunmayan takım rengi (lacivert, siyah…) yerine altın vurgu kullanılır. */
function accentFor(card: MatchDayCard): string {
  const value = Number.parseInt(card.homeColorHex.replace("#", ""), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.35 ? card.homeColorHex : GOLD;
}

function avg(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

function FormRow({ logo, name, form, size }: { logo: string | null; name: string; form: MatchDayStats["homeForm"]; size: number }) {
  return (
    <div tw="flex items-center" style={{ marginBottom: size * 0.3 }}>
      <TeamLogo src={logo} name={name} size={size * 1.1} />
      <div tw="flex" style={{ marginLeft: size * 0.45 }}>
        {form.map((result, index) => (
          <div
            key={index}
            tw="flex items-center justify-center"
            style={{ width: size, height: size, marginRight: size * 0.16, borderRadius: size * 0.14, backgroundColor: FORM_STYLE[result].bg }}
          >
            <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: size * 0.5, color: "white" }}>{FORM_STYLE[result].letter}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent, size, width }: { label: string; value: string; accent: string; size: number; width: number }) {
  return (
    <div
      tw="flex flex-col"
      style={{ width, padding: `${size * 0.35}px ${size * 0.4}px`, border: `2px solid ${accent}`, borderRadius: size * 0.22, marginRight: size * 0.3 }}
    >
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size * 0.3, letterSpacing: size * 0.06, color: "rgba(255,255,255,0.75)" }}>
        {label}
      </span>
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1.05, color: accent, marginTop: size * 0.1 }}>{value}</span>
    </div>
  );
}

function statBoxes(card: MatchDayCard): { label: string; value: string }[] {
  const stats = card.stats;
  if (!stats) {
    return [
      { label: "STADYUM", value: clip(card.stadiumLabel, 16) },
      { label: "HAKEM", value: clip(card.refereeLabel, 16) },
    ];
  }
  const boxes = [
    { label: `${clip(card.homeTeam, 12)} GOL ORT.`, value: avg(stats.homeGoalsForAvg) },
    { label: `${clip(card.awayTeam, 12)} GOL ORT.`, value: avg(stats.awayGoalsForAvg) },
  ];
  if (stats.h2h.played > 0) {
    boxes.push(
      { label: `SON ${stats.h2h.played} MAÇ · ${clip(card.homeTeam, 8)}`, value: String(stats.h2h.homeWins) },
      { label: "BERABERLİK", value: String(stats.h2h.draws) },
      { label: `SON ${stats.h2h.played} MAÇ · ${clip(card.awayTeam, 8)}`, value: String(stats.h2h.awayWins) },
    );
  }
  return boxes;
}

function Headline({ card, width, k }: { card: MatchDayCard; width: number; k: number }) {
  const line = (name: string, logo: string | null) => (
    <div tw="flex items-center" style={{ marginTop: px(6, k) }}>
      <TeamLogo src={logo} name={name} size={px(52, k)} />
      <span style={{ fontFamily: DISPLAY, fontSize: fitFontSize(name, width - px(70, k), px(74, k)), lineHeight: 1.05, color: "white", marginLeft: px(16, k) }}>
        {name}
      </span>
    </div>
  );
  return (
    <div tw="flex flex-col">
      {line(card.homeTeam, card.homeLogo)}
      {line(card.awayTeam, card.awayLogo)}
    </div>
  );
}

function DateBlock({ card, accent, k }: { card: MatchDayCard; accent: string; k: number }) {
  const [day, ...rest] = card.dateLabel.split(" ");
  const isDay = day !== undefined && /^\d{1,2}$/.test(day);
  return (
    <div tw="flex flex-col">
      <div tw="flex items-center">
        <span style={{ fontFamily: DISPLAY, fontSize: px(isDay ? 150 : 56, k), lineHeight: 1, color: accent }}>
          {isDay ? day : card.dateLabel}
        </span>
        {isDay ? (
          <div tw="flex flex-col" style={{ marginLeft: px(18, k) }}>
            <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: px(30, k), color: "white" }}>{rest.join(" ")}</span>
            {card.weekdayLabel ? (
              <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: px(24, k), color: "rgba(255,255,255,0.7)" }}>{card.weekdayLabel}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <span style={{ fontFamily: DISPLAY, fontSize: px(60, k), lineHeight: 1.1, color: "white" }}>{card.timeLabel}</span>
      <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: px(20, k), color: "rgba(255,255,255,0.72)", marginTop: px(6, k), maxWidth: px(440, k) }}>
        {card.stadiumLabel}
      </span>
    </div>
  );
}

function Vertical({ card, g }: { card: MatchDayCard; g: TemplateGeometry }) {
  const { k } = g;
  const accent = accentFor(card);
  const boxes = statBoxes(card);
  const boxWidth = Math.floor((g.right - g.left - px(12, k) * boxes.length) / boxes.length) - px(8, k);
  return (
    <Canvas>
      {/* Kolon, sağdaki lig logosuna kadar uzanır: uzun künye satırı ("…ULUSLAR LİGİ") kırılmaz. */}
      <div tw="absolute flex flex-col" style={{ left: g.left, top: g.top, width: g.right - g.left - px(90, k) }}>
        <Eyebrow size={px(16, k)} color={accent}>{`MAÇ GÜNÜ  ·  ${competitionLine(card)}`}</Eyebrow>
        <div tw="flex" style={{ marginTop: px(18, k) }}>
          <Headline card={card} width={px(520, k)} k={k} />
        </div>
        <div tw="flex" style={{ marginTop: px(40, k) }}>
          <DateBlock card={card} accent={accent} k={k} />
        </div>
      </div>
      <div tw="absolute flex" style={{ right: g.left, top: g.top }}>
        <LeagueLogo card={card} size={px(64, k)} />
      </div>

      <div tw="absolute flex flex-col" style={{ left: g.left, right: g.left, top: g.blockTop }}>
        {card.stats ? (
          <div tw="flex items-center justify-between" style={{ marginBottom: px(18, k) }}>
            <div tw="flex flex-col">
              <Eyebrow size={px(13, k)} color={accent}>SON 5 MAÇ</Eyebrow>
              <div tw="flex flex-col" style={{ marginTop: px(10, k) }}>
                <FormRow logo={card.homeLogo} name={card.homeTeam} form={card.stats.homeForm} size={px(34, k)} />
                <FormRow logo={card.awayLogo} name={card.awayTeam} form={card.stats.awayForm} size={px(34, k)} />
              </div>
            </div>
          </div>
        ) : null}
        <div tw="flex">
          {boxes.map((box) => (
            <StatBox key={box.label} label={box.label} value={box.value} accent={accent} size={px(card.stats ? 48 : 40, k)} width={boxWidth} />
          ))}
        </div>
      </div>
      <div tw="absolute flex" style={{ right: g.left, bottom: g.frame.height - g.bottom }}>
        <BrandLogo card={card} height={px(28, k)} />
      </div>
    </Canvas>
  );
}

function Landscape({ card, g }: { card: MatchDayCard; g: TemplateGeometry }) {
  const accent = accentFor(card);
  const boxes = statBoxes(card).slice(0, 4);
  return (
    <Canvas>
      <div tw="absolute flex flex-col" style={{ left: g.left, top: g.top, width: 420 }}>
        <Eyebrow size={12} color={accent}>{`MAÇ GÜNÜ  ·  ${competitionLine(card)}`}</Eyebrow>
        <div tw="flex" style={{ marginTop: 12 }}>
          <Headline card={card} width={420} k={0.72} />
        </div>
        <div tw="flex" style={{ marginTop: 26 }}>
          <DateBlock card={card} accent={accent} k={0.72} />
        </div>
      </div>
      <div tw="absolute flex flex-col" style={{ left: 880, top: g.top, width: 272 }}>
        <div tw="flex" style={{ marginBottom: 18 }}>
          <LeagueLogo card={card} size={50} />
        </div>
        {card.stats ? (
          <div tw="flex flex-col" style={{ marginBottom: 12 }}>
            <Eyebrow size={11} color={accent}>SON 5 MAÇ</Eyebrow>
            <div tw="flex flex-col" style={{ marginTop: 8 }}>
              <FormRow logo={card.homeLogo} name={card.homeTeam} form={card.stats.homeForm} size={26} />
              <FormRow logo={card.awayLogo} name={card.awayTeam} form={card.stats.awayForm} size={26} />
            </div>
          </div>
        ) : null}
        <div tw="flex flex-wrap">
          {boxes.map((box) => (
            <div key={box.label} tw="flex" style={{ marginBottom: 10 }}>
              <StatBox label={box.label} value={box.value} accent={accent} size={34} width={124} />
            </div>
          ))}
        </div>
      </div>
      <div tw="absolute flex" style={{ right: g.left, bottom: 30 }}>
        <BrandLogo card={card} height={24} />
      </div>
    </Canvas>
  );
}

export function DataDrivenTemplate({ card, g }: { card: MatchDayCard; g: TemplateGeometry }) {
  return g.frame.orientation === "landscape" ? <Landscape card={card} g={g} /> : <Vertical card={card} g={g} />;
}
