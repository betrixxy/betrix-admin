import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Figures, HeroFigure, Panel, PlayerCut, QuestionTitle, SupportStrip, themeOf, titleBottom } from "../design/kit";
import { BOTTOM, labelStyle, numberStyle, type Theme, W, X } from "../design/tokens";
import { countUp, seeded } from "../lib/motion";
import type { QuestionData, ReelPhoto, ReelScript } from "../schema";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Yöne göre kadraj: A orta boy ve köşede, B fotoğraf odaklı ve büyük, C küçük ve işaretli. */
const CUT = {
  A: { home: { left: 420, top: 470, height: 780 }, away: { left: 400, top: 560, height: 640 } },
  B: { home: { left: 300, top: 500, height: 1040 }, away: { left: 330, top: 620, height: 800 } },
  C: { home: { left: 500, top: 500, height: 620 }, away: { left: 500, top: 560, height: 500 } },
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
              <div style={{ ...labelStyle(theme, 30), color: active ? theme.accentInk : theme.ink2, whiteSpace: "nowrap" }}>{step.label} gol</div>
            </div>
          );
        })}
      </div>
      <Panel theme={theme} name="toplam gol dağılımı" style={{ padding: "12px 20px 10px" }}>
        <div style={{ ...labelStyle(theme, 28), marginBottom: 6 }}>Toplam gol</div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
          {viz.bars.map((bar, index) => {
            const grow = interpolate(frame, [50 + index * 5, 76 + index * 5], [0, 1], clamp);
            return (
              <div key={bar.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ ...numberStyle(theme, 34), color: theme.ink, opacity: grow }}><Figures theme={theme} text={`%${bar.percent}`} /></div>
                <div style={{ width: "100%", height: Math.max(6, (bar.percent / highest) * barArea * grow), background: bar.percent === highest ? theme.accent : "rgba(255,255,255,0.42)", borderRadius: theme.id === "A" ? 0 : 4 }} />
                <div style={{ ...labelStyle(theme, 28), whiteSpace: "nowrap" }}>{bar.label}</div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/** Bütün veri sahnelerinin tek şablonu. Tek tek rakamlar için "simülasyonların %X'inde" cümlesi kurulmaz: rakam + HUD rozeti yeter. */
export function QuestionScene({ script, scene }: { script: ReelScript; scene: { headline: { line1: string; line2: string } | null; data: QuestionData } }) {
  const theme = themeOf(script);
  const { data } = scene;
  const colors = { home: script.meta.teams.home.colors.primary, away: script.meta.teams.away.colors.primary };
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const top = titleBottom(theme, line1, line2) + 10;
  const heroColor = data.hero.side === "home" ? colors.home : data.hero.side === "away" ? colors.away : data.hero.side === "draw" ? "#A8B2AE" : theme.accent;
  const photo = data.focus ? script.photos[`${data.focus}-1`] : undefined;
  return (
    <AbsoluteFill>
      {data.focus && photo ? <FocusPlayer script={script} focus={data.focus} photo={photo} /> : null}
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <HeroFigure theme={theme} value={data.hero.value} percent={data.hero.percent} label={data.hero.label} color={heroColor} size={data.viz.kind === "ladder" ? Math.round(theme.heroSize * 0.8) : theme.heroSize} />
        {data.viz.kind === "dots" ? <DotsViz theme={theme} viz={data.viz} colors={colors} /> : null}
        {data.viz.kind === "split" ? <SplitViz theme={theme} viz={data.viz} colors={colors} /> : null}
        {data.viz.kind === "ladder" ? <LadderViz theme={theme} viz={data.viz} /> : <SupportStrip theme={theme} items={data.supports} colors={colors} />}
      </div>
    </AbsoluteFill>
  );
}

const PARTICLES = 340;

/** "Nasıl hesapladık?": modele giren veri grupları, sonra noktalar akar ve üç sonuca yığılır. */
export function MethodScene({ script, scene }: { script: ReelScript; scene: { headline: { line1: string; line2: string } | null; durationInFrames: number; data: { groups: { label: string; value: string }[]; piles: { label: string; share: number; side: "home" | "away" | "draw" }[] } } }) {
  const frame = useCurrentFrame();
  const theme = themeOf(script);
  const { data } = scene;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const top = titleBottom(theme, line1, line2) + 18;
  const colors = { home: script.meta.teams.home.colors.primary, away: script.meta.teams.away.colors.primary, draw: "#A8B2AE" };
  const canvas = { width: W, height: 410 };
  const cols = data.piles.length;
  const pileWidth = (canvas.width - 40) / cols;
  const size = 15;
  const perRow = Math.floor((pileWidth - 18) / size);
  const counts = data.piles.map((pile) => Math.round(pile.share * PARTICLES));
  const totalCount = counts.reduce((sum, value) => sum + value, 0);
  const labelArea = 52;
  let cursor = 0;
  // Karışık sıra: üç yığın birlikte büyür, sonuç sona kadar belli olmaz.
  const particles = counts.flatMap((count, pileIndex) => Array.from({ length: count }, (_, index) => ({ pileIndex, index, id: cursor++ }))).sort((a, b) => seeded(a.id * 13 + 1) - seeded(b.id * 13 + 1));
  const offsets = particles.map((particle) => seeded(particle.id * 7 + 3));
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top, display: "flex", flexDirection: "column", gap: 8 }}>
        {data.groups.map((group, index) => {
          const appear = interpolate(frame, [12 + index * 6, 20 + index * 6], [0, 1], clamp);
          return (
            <div key={group.label} data-block={`veri ${group.label}`} style={{ display: "flex", alignItems: "center", gap: 18, opacity: appear, padding: "6px 14px", background: theme.panel, border: theme.id === "C" ? `1.5px solid ${theme.panelEdge}` : "none", borderLeft: theme.id === "A" ? `8px solid ${theme.accent}` : undefined, borderRadius: theme.id === "C" ? 6 : 0 }}>
              <div style={{ ...numberStyle(theme, 56), color: theme.accent, minWidth: 96, textAlign: "right" }}><Figures theme={theme} text={group.value} /></div>
              <div style={{ ...labelStyle(theme, Math.max(36, theme.labelSize)), color: theme.ink, whiteSpace: "nowrap" }}>{group.label}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: X, top: BOTTOM - canvas.height - 22, width: canvas.width, height: canvas.height }}>
        <Panel theme={theme} name="simülasyon" style={{ position: "absolute", inset: 0, padding: 0, width: canvas.width }}><div /></Panel>
        <svg width={canvas.width} height={canvas.height} viewBox={`0 0 ${canvas.width} ${canvas.height}`} style={{ position: "absolute", inset: 0 }}>
          {particles.map((particle, order) => {
            const start = 46 + (order / totalCount) * 60 + (offsets[order] ?? 0) * 6;
            const progress = interpolate(frame, [start, start + 24], [0, 1], { ...clamp, easing: (t) => t * t });
            if (progress <= 0) return null;
            const pileLeft = 20 + particle.pileIndex * pileWidth + 9;
            const targetX = pileLeft + (particle.index % perRow) * size + size / 2;
            const targetY = canvas.height - labelArea - Math.floor(particle.index / perRow) * size - size / 2;
            const startX = canvas.width / 2 + ((offsets[order] ?? 0.5) - 0.5) * 120;
            const x = startX + (targetX - startX) * progress;
            const y = 14 + (targetY - 14) * progress;
            const pile = data.piles[particle.pileIndex];
            return <circle key={particle.id} cx={x} cy={y} r={size / 2 - 1.5} fill={pile ? colors[pile.side] : "#FFFFFF"} />;
          })}
        </svg>
        <div style={{ position: "absolute", left: 20, right: 20, bottom: 6, display: "flex" }}>
          {data.piles.map((pile) => <div key={pile.label} style={{ flex: 1, textAlign: "center", ...labelStyle(theme, 34), color: theme.ink, whiteSpace: "nowrap", textTransform: theme.id === "A" ? "uppercase" : "none" }}>{pile.label}</div>)}
        </div>
      </div>
    </AbsoluteFill>
  );
}
