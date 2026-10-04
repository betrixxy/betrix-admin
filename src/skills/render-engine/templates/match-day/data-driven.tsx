import type { MatchDayCard, MatchDayStats } from "@/types/match-day";
import type { TemplateGeometry } from "./geometry";
import { BODY, BrandLogo, Canvas, DISPLAY, Eyebrow, GOLD, LeagueLogo, TeamLogo, clip, competitionLine, fitFontSize, known, px } from "./shared";

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

interface StatBoxData {
  /** Kutu grubunu anlatan küçük üst satır ("GOL ORTALAMASI", "SON 5 MAÇ") — takım adı kırpılmasın diye etiketten ayrı. */
  caption?: string;
  label: string;
  value: string;
}

function StatBox({ caption, label, value, accent, size, width }: StatBoxData & { accent: string; size: number; width: number }) {
  return (
    <div
      tw="flex flex-col"
      style={{ width, padding: `${size * 0.35}px ${size * 0.4}px`, border: `2px solid ${accent}`, borderRadius: size * 0.22, marginRight: size * 0.3 }}
    >
      {caption ? (
        <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size * 0.24, letterSpacing: size * 0.05, color: "rgba(255,255,255,0.5)" }}>
          {caption}
        </span>
      ) : null}
      <span style={{ fontFamily: BODY, fontWeight: 700, fontSize: size * 0.3, letterSpacing: size * 0.06, color: "rgba(255,255,255,0.8)" }}>
        {label}
      </span>
      <span style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1.05, color: accent, marginTop: size * 0.1 }}>{value}</span>
    </div>
  );
}

/** Takım adı kutuda iki satıra kırılabilir; yalnızca gerçekten aşırı uzun adlar kısaltılır. */
const BOX_TEAM_CHARS = 18;

/** Künye kutuları (istatistik yoksa): yalnızca bilinen alanlar — "—" kutusu çizilmez. */
function venueBoxes(card: MatchDayCard): StatBoxData[] {
  const boxes: StatBoxData[] = [];
  const stadium = known(card.stadiumLabel);
  const referee = known(card.refereeLabel);
  if (stadium) boxes.push({ label: "STADYUM", value: clip(stadium, 16) });
  if (referee) boxes.push({ label: "HAKEM", value: clip(referee, 16) });
  return boxes;
}

function statBoxes(card: MatchDayCard): StatBoxData[] {
  const stats = card.stats;
  if (!stats) return venueBoxes(card);

  const boxes: StatBoxData[] = [];
  const goals: [string, number | null][] = [
    [card.homeTeam, stats.homeGoalsForAvg],
    [card.awayTeam, stats.awayGoalsForAvg],
  ];
  for (const [team, value] of goals) {
    if (value !== null) boxes.push({ caption: "GOL ORTALAMASI", label: clip(team, BOX_TEAM_CHARS), value: value.toFixed(1) });
  }
  if (stats.h2h.played > 0) {
    const caption = `SON ${stats.h2h.played} MAÇ`;
    boxes.push(
      { caption, label: clip(card.homeTeam, BOX_TEAM_CHARS), value: String(stats.h2h.homeWins) },
      { caption, label: "BERABERLİK", value: String(stats.h2h.draws) },
      { caption, label: clip(card.awayTeam, BOX_TEAM_CHARS), value: String(stats.h2h.awayWins) },
    );
  }
  // Gerçek sayı yoksa boş kutu yerine künyeye dönülür (uydurma ya da "—" değer çizilmez).
  return boxes.length > 0 ? boxes : venueBoxes(card);
}

/** Son 5 maç satırları — yalnızca formu bilinen takımlar; hiçbiri yoksa bölüm hiç çizilmez. */
function formRows(card: MatchDayCard): { logo: string | null; name: string; form: MatchDayStats["homeForm"] }[] {
  if (!card.stats) return [];
  return [
    { logo: card.homeLogo, name: card.homeTeam, form: card.stats.homeForm },
    { logo: card.awayLogo, name: card.awayTeam, form: card.stats.awayForm },
  ].filter((row) => row.form.length > 0);
}

function FormSection({ card, accent, size, eyebrowSize, gap }: { card: MatchDayCard; accent: string; size: number; eyebrowSize: number; gap: number }) {
  return (
    <div tw="flex flex-col">
      <Eyebrow size={eyebrowSize} color={accent}>SON 5 MAÇ</Eyebrow>
      <div tw="flex flex-col" style={{ marginTop: gap }}>
        {formRows(card).map((row) => (
          <FormRow key={row.name} logo={row.logo} name={row.name} form={row.form} size={size} />
        ))}
      </div>
    </div>
  );
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

/** Tarih bloğu yalnızca bilinen bir alan varsa çizilir — yer tutucu ("—") tireler basılmaz. */
function hasDateBlock(card: MatchDayCard): boolean {
  return Boolean(known(card.dateLabel) ?? known(card.timeLabel) ?? known(card.stadiumLabel));
}

function DateLine({ date, weekday, accent, k }: { date: string; weekday: string | null; accent: string; k: number }) {
  const [day, ...rest] = date.split(" ");
  const isDay = day !== undefined && /^\d{1,2}$/.test(day);
  return (
    <div tw="flex items-center">
      <span style={{ fontFamily: DISPLAY, fontSize: px(isDay ? 150 : 56, k), lineHeight: 1, color: accent }}>{isDay ? day : date}</span>
      {isDay ? (
        <div tw="flex flex-col" style={{ marginLeft: px(18, k) }}>
          <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: px(30, k), color: "white" }}>{rest.join(" ")}</span>
          {weekday ? <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: px(24, k), color: "rgba(255,255,255,0.7)" }}>{weekday}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function DateBlock({ card, accent, k }: { card: MatchDayCard; accent: string; k: number }) {
  const date = known(card.dateLabel);
  const time = known(card.timeLabel);
  const stadium = known(card.stadiumLabel);
  return (
    <div tw="flex flex-col">
      {date ? <DateLine date={date} weekday={card.weekdayLabel} accent={accent} k={k} /> : null}
      {time ? <span style={{ fontFamily: DISPLAY, fontSize: px(60, k), lineHeight: 1.1, color: "white" }}>{time}</span> : null}
      {stadium ? (
        <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: px(20, k), color: "rgba(255,255,255,0.72)", marginTop: px(6, k), maxWidth: px(440, k) }}>
          {stadium}
        </span>
      ) : null}
    </div>
  );
}

function Vertical({ card, g }: { card: MatchDayCard; g: TemplateGeometry }) {
  const { k } = g;
  const accent = accentFor(card);
  const boxes = statBoxes(card);
  const boxWidth = Math.floor((g.right - g.left - px(12, k) * boxes.length) / Math.max(1, boxes.length)) - px(8, k);
  return (
    <Canvas>
      {/* Kolon, sağdaki lig logosuna kadar uzanır: uzun künye satırı ("…ULUSLAR LİGİ") kırılmaz. */}
      <div tw="absolute flex flex-col" style={{ left: g.left, top: g.top, width: g.right - g.left - px(90, k) }}>
        <Eyebrow size={px(16, k)} color={accent}>{`MAÇ GÜNÜ  ·  ${competitionLine(card)}`}</Eyebrow>
        <div tw="flex" style={{ marginTop: px(18, k) }}>
          <Headline card={card} width={px(520, k)} k={k} />
        </div>
        {hasDateBlock(card) ? (
          <div tw="flex" style={{ marginTop: px(40, k) }}>
            <DateBlock card={card} accent={accent} k={k} />
          </div>
        ) : null}
      </div>
      <div tw="absolute flex" style={{ right: g.left, top: g.top }}>
        <LeagueLogo card={card} size={px(64, k)} />
      </div>

      <div tw="absolute flex flex-col" style={{ left: g.left, right: g.left, top: g.blockTop }}>
        {formRows(card).length > 0 ? (
          <div tw="flex" style={{ marginBottom: px(18, k) }}>
            <FormSection card={card} accent={accent} size={px(34, k)} eyebrowSize={px(13, k)} gap={px(10, k)} />
          </div>
        ) : null}
        {boxes.length > 0 ? (
          <div tw="flex">
            {boxes.map((box, index) => (
              <StatBox key={index} {...box} accent={accent} size={px(card.stats ? 48 : 40, k)} width={boxWidth} />
            ))}
          </div>
        ) : null}
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
        {hasDateBlock(card) ? (
          <div tw="flex" style={{ marginTop: 26 }}>
            <DateBlock card={card} accent={accent} k={0.72} />
          </div>
        ) : null}
      </div>
      <div tw="absolute flex flex-col" style={{ left: 880, top: g.top, width: 272 }}>
        <div tw="flex" style={{ marginBottom: 18 }}>
          <LeagueLogo card={card} size={50} />
        </div>
        {formRows(card).length > 0 ? (
          <div tw="flex" style={{ marginBottom: 12 }}>
            <FormSection card={card} accent={accent} size={26} eyebrowSize={11} gap={8} />
          </div>
        ) : null}
        <div tw="flex flex-wrap">
          {boxes.map((box, index) => (
            <div key={index} tw="flex" style={{ marginBottom: 10 }}>
              <StatBox {...box} accent={accent} size={34} width={124} />
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
