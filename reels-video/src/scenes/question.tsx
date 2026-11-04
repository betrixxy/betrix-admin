import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BoardPanel, ChalkArrow, HandLabel, Magnet, boardLabel } from "../design/board";
import { ReasonList } from "./reason-list";
import { Figures, HeroFigure, Panel, PlayerCut, QuestionTitle, SupportStrip, themeOf, titleBottom } from "../design/kit";
import { BOTTOM, labelStyle, numberStyle, type Theme, W, X } from "../design/tokens";
import { countUp } from "../lib/motion";
import type { QuestionData, ReelPhoto, ReelScript } from "../schema";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Yöne göre kadraj: A orta boy ve köşede, B fotoğraf odaklı ve büyük, C küçük ve işaretli. */
const CUT = {
  A: { home: { left: 420, top: 470, height: 780 }, away: { left: 400, top: 560, height: 640 } },
  B: { home: { left: 300, top: 500, height: 1040 }, away: { left: 330, top: 620, height: 800 } },
  C: { home: { left: 500, top: 500, height: 620 }, away: { left: 500, top: 560, height: 500 } },
  D: { home: { left: 430, top: 360, height: 760 }, away: { left: 380, top: 520, height: 660 } },
  E: { home: { left: 500, top: 520, height: 600 }, away: { left: 480, top: 580, height: 480 } },
} as const;

function FocusPlayer({ script, focus, photo }: { script: ReelScript; focus: "home" | "away"; photo: ReelPhoto }) {
  const theme = themeOf(script);
  const place = CUT[theme.id][focus];
  return <PlayerCut theme={theme} photo={photo} color={script.meta.teams[focus].colors.primary} {...place} />;
}

/** Kim kazanır?: her nokta aynı sayıda simülasyonu temsil eder; soldan sağa dolar. */
function DotsViz({ theme, viz, colors }: { theme: Theme; viz: Extract<QuestionData["viz"], { kind: "dots" }>; colors: { home: string; away: string } }) {
  const frame = useCurrentFrame();
  const total = viz.home + viz.draw + viz.away;
  const lit = countUp(frame, { to: total, start: 24, duration: 60 });
  const columns = 40;
  const cell = (W - 40) / columns;
  const rows = Math.ceil(total / columns);
  const paint = (index: number) => (index < viz.home ? colors.home : index < viz.home + viz.draw ? "#A8B2AE" : colors.away);
  return (
    <Panel theme={theme} name="nokta dağılımı" style={{ padding: "16px 20px" }}>
      <svg width={W - 40} height={rows * cell} viewBox={`0 0 ${W - 40} ${rows * cell}`} style={{ display: "block" }}>
        {Array.from({ length: total }, (_, index) => {
          // Sütun sütun boyanır: üç sonuç yan yana blok olarak görünür.
          const column = Math.floor(index / rows);
          const row = index % rows;
          return <rect key={index} x={column * cell + 1.5} y={row * cell + 1.5} width={cell - 3} height={cell - 3} rx={theme.id === "A" ? 0 : (cell - 3) / 2} fill={paint(index)} opacity={index < lit ? 1 : 0.14} />;
        })}
      </svg>
    </Panel>
  );
}

function SplitViz({ theme, viz, colors }: { theme: Theme; viz: Extract<QuestionData["viz"], { kind: "split" }>; colors: { home: string; away: string } }) {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [24, 60], [0, 1], clamp);
  const palette = [theme.accent, "#A8B2AE", "#FFFFFF"];
  return (
    <Panel theme={theme} name="dağılım" style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", height: 34, gap: 4 }}>
        {viz.parts.map((part, index) => (
          <div key={part.label} style={{ flex: `${Math.max(part.percent, 1)} 1 0`, background: part.side === "home" ? colors.home : part.side === "away" ? colors.away : part.side === "draw" ? "#A8B2AE" : palette[index], transform: `scaleX(${reveal})`, transformOrigin: "left" }} />
        ))}
      </div>
    </Panel>
  );
}

/** Gol merdiveni (2+, 3+, 4+, 5+) + toplam gol dağılımı çubukları. İkisi aynı kaynaktan: `questions.ts`. */
function LadderViz({ theme, viz }: { theme: Theme; viz: Extract<QuestionData["viz"], { kind: "ladder" }> }) {
  const frame = useCurrentFrame();
  const stepStart = (index: number) => 30 + index * 8;
  const highest = Math.max(...viz.bars.map((bar) => bar.percent), 1);
  const barArea = 104;
  const stepNumber = Math.min(theme.supportSize, 62);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, width: W }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        {viz.steps.map((step, index) => {
          const active = step.label === "3+";
          const height = 126 + (viz.steps.length - index - 1) * 26;
          return (
            <div key={step.label} data-block={`basamak ${step.label}`} style={{ flex: 1, height, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "10px 12px", background: active ? theme.accent : theme.panel, border: active || theme.id === "A" ? "none" : `1.5px solid ${theme.panelEdge}`, borderRadius: theme.id === "C" ? 6 : 0, opacity: interpolate(frame, [stepStart(index) - 6, stepStart(index) + 2], [0, 1], clamp) }}>
              <div data-support="" style={{ ...numberStyle(theme, stepNumber), color: active ? theme.accentInk : theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={`%${countUp(frame, { to: step.percent, start: stepStart(index), duration: 24 })}`} /></div>
              <div style={{ ...labelStyle(theme, 34), color: active ? theme.accentInk : theme.ink2, whiteSpace: "nowrap" }}>{step.label} gol</div>
            </div>
          );
        })}
      </div>
      <Panel theme={theme} name="toplam gol dağılımı" style={{ padding: "12px 20px 10px" }}>
        <div style={{ ...labelStyle(theme, 34), marginBottom: 6 }}>Toplam gol</div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
          {viz.bars.map((bar, index) => {
            const grow = interpolate(frame, [50 + index * 5, 76 + index * 5], [0, 1], clamp);
            return (
              <div key={bar.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ ...numberStyle(theme, 36), color: theme.ink, opacity: grow }}><Figures theme={theme} text={`%${bar.percent}`} /></div>
                <div style={{ width: "100%", height: Math.max(6, (bar.percent / highest) * barArea * grow), background: bar.percent === highest ? theme.accent : "rgba(255,255,255,0.42)", borderRadius: theme.id === "A" ? 0 : 4 }} />
                <div style={{ ...labelStyle(theme, 34), whiteSpace: "nowrap" }}>{bar.label}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/** "Neden?" paneli varken yalnız merdiven: çubuklar sığmaz, aynı veriyi basamaklar da taşır. */
function LadderSteps({ theme, viz }: { theme: Theme; viz: Extract<QuestionData["viz"], { kind: "ladder" }> }) {
  return (
    <div style={{ display: "flex", gap: 10, width: W }}>
      {viz.steps.map((step) => {
        const active = step.label === "3+";
        return (
          <div key={step.label} data-block={`basamak ${step.label}`} style={{ flex: 1, padding: "10px 12px", background: active ? theme.accent : theme.panel, display: "flex", flexDirection: "column", gap: 4 }}>
            <div data-support="" style={{ ...numberStyle(theme, Math.min(theme.supportSize, 52)), color: active ? theme.accentInk : theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={`%${step.percent}`} /></div>
            <div style={{ ...labelStyle(theme, 34), color: active ? theme.accentInk : theme.ink2, whiteSpace: "nowrap" }}>{step.label} gol</div>
          </div>
        );
      })}
    </div>
  );
}

/** İlk gol kimden: tahtada iki mıknatıs, öndeki takımdan kaleye tebeşir ok. Rakamlar Archivo, el yazısı yalnız kısa vurgu. */
function FirstGoalBoard({ script, theme, supports, hero }: { script: ReelScript; theme: Theme; supports: QuestionData["supports"]; hero: QuestionData["hero"] }) {
  const { home, away } = script.meta.teams;
  const height = 340;
  const lead = hero.side === "away" ? "away" : "home";
  const from = lead === "home" ? [180, 190] as const : [W - 180, 190] as const;
  const to = lead === "home" ? [W - 60, 158] as const : [60, 158] as const;
  const other = supports.find((item) => item.key === "other");
  const none = supports.find((item) => item.key === "none");
  const values = { home: lead === "home" ? hero.value : other?.value ?? "", away: lead === "away" ? hero.value : other?.value ?? "" };
  return (
    <BoardPanel name="ilk gol tahtası" width={W} height={height}>
      <svg data-fill="" width={W} height={height} viewBox={`0 0 ${W} ${height}`} style={{ position: "absolute", left: 0, top: 0 }}>
        <Magnet x={180} y={190} r={68} color={home.colors.primary} logo={home.logo} />
        <Magnet x={W - 180} y={190} r={68} color={away.colors.primary} logo={away.logo} />
      </svg>
      <ChalkArrow width={W} height={height} from={from} to={to} bend={-80} color={theme.accentText} name="ilk-gol" />
      <HandLabel theme={theme} text="İlk vuruş" size={60} style={{ left: W / 2 + 24, top: 12 }} />
      <div data-support="" style={{ ...numberStyle(theme, 56), position: "absolute", left: 180 - 90, width: 180, top: 268, textAlign: "center", color: theme.ink }}><Figures theme={theme} text={values.home} /></div>
      <div data-support="" style={{ ...numberStyle(theme, 56), position: "absolute", left: W - 180 - 90, width: 180, top: 268, textAlign: "center", color: theme.ink }}><Figures theme={theme} text={values.away} /></div>
      {none ? <div style={{ ...boardLabel(theme, 34), position: "absolute", left: W / 2 - 90, width: 180, top: 272, textAlign: "center" }}>Gol yok <Figures theme={theme} text={none.value} /></div> : null}
    </BoardPanel>
  );
}

/** Bütün veri sahnelerinin tek şablonu. Tek tek rakamlar için "simülasyonların %X'inde" cümlesi kurulmaz: rakam + HUD rozeti yeter. */
export function QuestionScene({ script, scene }: { script: ReelScript; scene: { type: string; headline: { line1: string; line2: string } | null; data: QuestionData } }) {
  const theme = themeOf(script);
  const { data } = scene;
  const colors = { home: script.meta.teams.home.colors.primary, away: script.meta.teams.away.colors.primary };
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const top = titleBottom(theme, line1, line2) + 10;
  const heroColor = data.hero.side === "home" ? colors.home : data.hero.side === "away" ? colors.away : data.hero.side === "draw" ? "#A8B2AE" : theme.accent;
  const photo = data.focus ? script.photos[`${data.focus}-1`] : undefined;
  const board = theme.id === "D" && scene.type === "Q12_FIRST_GOAL";
  return (
    <AbsoluteFill>
      {data.focus && photo ? <FocusPlayer script={script} focus={data.focus} photo={photo} /> : null}
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
        <HeroFigure theme={theme} value={data.hero.value} percent={data.hero.percent} label={data.hero.label} color={heroColor} size={data.viz.kind === "ladder" || board ? 190 : theme.heroSize} />
        {data.reasons.length ? null : data.viz.kind === "dots" ? <DotsViz theme={theme} viz={data.viz} colors={colors} /> : null}
        {data.viz.kind === "split" && !board ? <SplitViz theme={theme} viz={data.viz} colors={colors} /> : null}
        {board ? <FirstGoalBoard script={script} theme={theme} supports={data.supports} hero={data.hero} /> : data.viz.kind === "ladder" ? (data.reasons.length ? <LadderSteps theme={theme} viz={data.viz} /> : <LadderViz theme={theme} viz={data.viz} />) : <SupportStrip theme={theme} items={data.supports} colors={colors} grow={!data.reasons.length} />}
        {data.reasons.length ? <ReasonList theme={theme} heading="Neden?" items={data.reasons} start={52} /> : null}
      </div>
    </AbsoluteFill>
  );
}

