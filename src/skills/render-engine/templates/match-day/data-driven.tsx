import { formatNumber } from "@/lib/format/number";
import type { MatchDayCard, MatchDayStats } from "@/types/match-day";
import type { TemplateGeometry } from "./geometry";
import { MATCH_DAY_NAME_LAYERS, blockOpacity, layerOpacity, unlayered, type BlockFilter, type LayoutBlockId } from "../checkmatch-set/blocks";
import { wrapLines } from "../../satori-text";
import { BODY, BrandLogo, Canvas, DISPLAY, DISPLAY_ACCENT_EM, DISPLAY_DESCENT_EM, Eyebrow, GOLD, TeamLogo, clip, competitionLine, known, px } from "./shared";

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

/** Kartın blokları (yerleşim kapısı, bkz. `match-day-overlay.tsx::matchDayLayoutGate`) — logo dahil her öğe birine aittir. */
export const DATA_DRIVEN_BLOCKS = ["header-label", "headline", ...MATCH_DAY_NAME_LAYERS, "md-date", "form", "md-boxes", "footer-logo"] as const satisfies readonly LayoutBlockId[];

const shown = (only: BlockFilter, id: LayoutBlockId, layers: readonly LayoutBlockId[] = []) => ({ opacity: blockOpacity(only, id, layers) });

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
        <span data-wrap style={{ fontFamily: BODY, fontWeight: 700, fontSize: size * 0.24, letterSpacing: size * 0.05, color: "rgba(255,255,255,0.5)" }}>
          {caption}
        </span>
      ) : null}
      <span data-wrap style={{ fontFamily: BODY, fontWeight: 700, fontSize: size * 0.3, letterSpacing: size * 0.06, color: "rgba(255,255,255,0.8)" }}>
        {label}
      </span>
      <span data-wrap style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1.05, color: accent, marginTop: size * 0.1 }}>{value}</span>
    </div>
  );
}

/** Takım adı kutuda iki satıra kırılabilir; yalnızca gerçekten aşırı uzun adlar kısaltılır. */
const BOX_TEAM_CHARS = 18;

/**
 * Künye kutuları (istatistik yoksa): yalnızca tarih bloğunda OLMAYAN bilinen alanlar. Stadyum tarih
 * bloğunda yazar — tekrar kutuya konmaz; hakem yoksa kutu alanı hiç çizilmez ("—" kutusu da yok).
 */
export function venueBoxes(card: MatchDayCard): StatBoxData[] {
  const referee = known(card.refereeLabel);
  // Tek kutu bütün genişliği kaplar: uzun ad kesilmesin.
  return referee ? [{ label: "HAKEM", value: clip(referee, 28) }] : [];
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
    if (value !== null) boxes.push({ caption: "GOL ORTALAMASI", label: clip(team, BOX_TEAM_CHARS), value: formatNumber(value, { maxDecimals: 1 }) });
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

/** Anton büyük harf ortalaması ≈ 0,42–0,48 em/karakter (ölçüm 2026-10-27); satır genişliği taşmasın diye 0,5. */
const NAME_EM = 0.5;

/**
 * Ad satırları — satır bölmeyi Satori'ye bırakmaz: ad tek satıra okunur boyda (≥ 0,65 × azami) sığmıyorsa en
 * fazla 3 satıra bölünür, boy en uzun satıra göre. Satırlar arası (ad içinde ve iki ad arasında) mürekkep
 * ölçüsüne göre: üst satırın Ç/Ş/Ğ kuyruğu + alt satırın İ/Ö/Ü işareti + boşluk. Satırlar sırayla iki mürekkep
 * katmanına (md-name-a / md-name-b) düşer; yerleşim kapısı komşu satırların mürekkebini piksel düzeyinde denetler.
 */
export function nameLines(name: string, width: number, max: number): { lines: string[]; size: number } {
  const single = Math.min(max, Math.floor(width / Math.max(1, [...name].length * NAME_EM)));
  if (single >= Math.round(max * 0.65) || !/\s/u.test(name.trim())) return { lines: [name], size: single };
  for (let size = max; size > 12; size -= 2) {
    const lines = wrapLines(name, width, size, NAME_EM);
    if (lines.length <= 2) return { lines, size };
  }
  const lines = wrapLines(name, width, 12, NAME_EM).slice(0, 3);
  return { lines, size: Math.min(max, Math.floor(width / Math.max(...lines.map((line) => [...line].length * NAME_EM)))) };
}

const lineGap = (upper: number, lower: number, k: number) => Math.ceil(upper * DISPLAY_DESCENT_EM + lower * DISPLAY_ACCENT_EM) + px(6, k);

function Headline({ card, width, k, only }: { card: MatchDayCard; width: number; k: number; only: BlockFilter }) {
  const names = [
    { name: card.homeTeam, logo: card.homeLogo },
    { name: card.awayTeam, logo: card.awayLogo },
  ].map((team) => ({ ...team, ...nameLines(team.name, width - px(70, k), px(74, k)) }));
  let index = 0;
  return (
    <div tw="flex flex-col">
      {names.map((team, row) => {
        const previous = names[row - 1];
        return (
          <div key={row} tw="flex items-center" style={{ marginTop: previous ? lineGap(previous.size, team.size, k) : px(6, k) }}>
            <div tw="flex" style={{ opacity: unlayered(only) }}>
              <TeamLogo src={team.logo} name={team.name} size={px(52, k)} />
            </div>
            <div tw="flex flex-col" style={{ marginLeft: px(16, k) }}>
              {team.lines.map((line, i) => {
                const layer = index++ % 2 === 0 ? "md-name-a" : "md-name-b";
                return (
                  <span key={i} style={{ fontFamily: DISPLAY, fontSize: team.size, lineHeight: 1.05, color: "white", marginTop: i === 0 ? 0 : lineGap(team.size, team.size, k), opacity: layerOpacity(only, layer) }}>
                    {line}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
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
        <span data-wrap style={{ fontFamily: BODY, fontWeight: 600, fontSize: px(20, k), color: "rgba(255,255,255,0.72)", marginTop: px(6, k), maxWidth: px(440, k) }}>
          {stadium}
        </span>
      ) : null}
    </div>
  );
}

function Vertical({ card, g, only }: { card: MatchDayCard; g: TemplateGeometry; only: BlockFilter }) {
  const { k } = g;
  const brandHeight = px(28, k);
  const accent = accentFor(card);
  const boxes = statBoxes(card);
  const boxWidth = Math.floor((g.right - g.left - px(12, k) * boxes.length) / Math.max(1, boxes.length)) - px(8, k);
  return (
    <Canvas>
      {/* Kolon, sağ kenara kadar uzanır: uzun künye satırı ("…ULUSLAR LİGİ") kırılmaz. */}
      <div tw="absolute flex flex-col" style={{ left: g.left, top: g.top, width: g.right - g.left - px(90, k) }}>
        <div tw="flex" style={shown(only, "header-label")}>
          <Eyebrow size={px(16, k)} color={accent}>{`MAÇ GÜNÜ  ·  ${competitionLine(card)}`}</Eyebrow>
        </div>
        <div tw="flex" style={{ marginTop: px(18, k), ...shown(only, "headline", MATCH_DAY_NAME_LAYERS) }}>
          <Headline card={card} width={px(520, k)} k={k} only={only} />
        </div>
        {hasDateBlock(card) ? (
          <div tw="flex" style={{ marginTop: px(40, k), ...shown(only, "md-date") }}>
            <DateBlock card={card} accent={accent} k={k} />
          </div>
        ) : null}
      </div>

      {/* Form + kutular alttan, logonun ÜSTÜNE yaslanır (eskiden blockTop'tan aşağı uzayıp logoya biniyordu). */}
      <div tw="absolute flex flex-col" style={{ left: g.left, right: g.left, bottom: g.frame.height - g.bottom + brandHeight + px(22, k) }}>
        {formRows(card).length > 0 ? (
          <div tw="flex" style={{ marginBottom: px(18, k), ...shown(only, "form") }}>
            <FormSection card={card} accent={accent} size={px(34, k)} eyebrowSize={px(13, k)} gap={px(10, k)} />
          </div>
        ) : null}
        {boxes.length > 0 ? (
          <div tw="flex" style={shown(only, "md-boxes")}>
            {boxes.map((box, index) => (
              <StatBox key={index} {...box} accent={accent} size={px(card.stats ? 48 : 40, k)} width={boxWidth} />
            ))}
          </div>
        ) : null}
      </div>
      <div tw="absolute flex" style={{ right: g.left, bottom: g.frame.height - g.bottom, ...shown(only, "footer-logo") }}>
        <BrandLogo card={card} height={brandHeight} />
      </div>
    </Canvas>
  );
}

function Landscape({ card, g, only }: { card: MatchDayCard; g: TemplateGeometry; only: BlockFilter }) {
  const accent = accentFor(card);
  const boxes = statBoxes(card).slice(0, 4);
  return (
    <Canvas>
      <div tw="absolute flex flex-col" style={{ left: g.left, top: g.top, width: 420 }}>
        <div tw="flex" style={shown(only, "header-label")}>
          <Eyebrow size={12} color={accent} maxWidth={420}>{`MAÇ GÜNÜ  ·  ${competitionLine(card)}`}</Eyebrow>
        </div>
        <div tw="flex" style={{ marginTop: 12, ...shown(only, "headline", MATCH_DAY_NAME_LAYERS) }}>
          <Headline card={card} width={420} k={0.72} only={only} />
        </div>
        {hasDateBlock(card) ? (
          <div tw="flex" style={{ marginTop: 26, ...shown(only, "md-date") }}>
            <DateBlock card={card} accent={accent} k={0.72} />
          </div>
        ) : null}
      </div>
      <div tw="absolute flex flex-col" style={{ left: 880, top: g.top, width: 272 }}>
        {formRows(card).length > 0 ? (
          <div tw="flex" style={{ marginBottom: 12, ...shown(only, "form") }}>
            <FormSection card={card} accent={accent} size={26} eyebrowSize={11} gap={8} />
          </div>
        ) : null}
        <div tw="flex flex-wrap" style={shown(only, "md-boxes")}>
          {boxes.map((box, index) => (
            <div key={index} tw="flex" style={{ marginBottom: 10 }}>
              <StatBox {...box} accent={accent} size={34} width={124} />
            </div>
          ))}
        </div>
      </div>
      <div tw="absolute flex" style={{ right: g.left, bottom: 30, ...shown(only, "footer-logo") }}>
        <BrandLogo card={card} height={24} />
      </div>
    </Canvas>
  );
}

/** `only`: yerleşim kapısı için yalnızca o blok / ad satırı katmanı (bkz. `DATA_DRIVEN_BLOCKS`). */
export function DataDrivenTemplate({ card, g, only }: { card: MatchDayCard; g: TemplateGeometry; only?: BlockFilter }) {
  return g.frame.orientation === "landscape" ? <Landscape card={card} g={g} only={only} /> : <Vertical card={card} g={g} only={only} />;
}
