import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Card, clamp, COLORS, Crest, Cutout, FONT_FAMILY, Main, Strip, Swatch, tabular, Title, TrustLine } from "../components/Primitives";
import { formatDecimal, TYPE, ZONES } from "../lib/motion";
import { LAYOUTS } from "../lib/photo-layouts";
import { photoOf, type SceneProps } from "./common";
import { OutcomeStats } from "./outcome";

/** Üç evre: özet kartı (kaydedilmeye değer) → soru → kapanış. */
export const SUMMARY_PHASES = { question: 210, close: 285 } as const;

const NOW = { home: -60, draw: -60, away: -60 };

function Tile({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  return (
    <Card name={name} style={{ flex: 1, justifyContent: "center", gap: 2, padding: "10px 20px" }}>
      <div style={{ fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2, whiteSpace: "nowrap" }}>{label}</div>
      {children}
    </Card>
  );
}

const Big = ({ children }: { children: ReactNode }) => <div style={{ fontSize: TYPE.big, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05, ...tabular }}>{children}</div>;

export function SummaryScene({ script, scene }: SceneProps<"S16_SUMMARY">) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { home, away } = script.meta.teams;
  const { data } = scene;
  const accent = script.brand.accent;
  const leader = data.outcome.home >= data.outcome.draw && data.outcome.home >= data.outcome.away ? "home" : data.outcome.away >= data.outcome.draw ? "away" : "draw";
  const summary = interpolate(frame, [SUMMARY_PHASES.question - 10, SUMMARY_PHASES.question], [1, 0], clamp);
  const question = interpolate(frame, [SUMMARY_PHASES.question, SUMMARY_PHASES.question + 8, SUMMARY_PHASES.close - 8, SUMMARY_PHASES.close], [0, 1, 1, 0], clamp);
  const close = interpolate(frame, [SUMMARY_PHASES.close, SUMMARY_PHASES.close + 8], [0, 1], clamp);
  const [left, right] = LAYOUTS.duel.slots;
  const homePhoto = photoOf(script, scene.assets.photoIds, "home");
  const awayPhoto = photoOf(script, scene.assets.photoIds, "away");
  const words = data.question.split(" ");
  const lastWord = words.at(-1) ?? "";
  void durationInFrames;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: summary }}>
        <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
        <Main height={ZONES.stripTop + ZONES.stripHeight - ZONES.mainTop} style={{ gap: 12, transform: "none" }}>
          <Card name="kim kazanır" style={{ padding: "14px 22px", gap: 8 }}>
            <div style={{ fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2 }}>Kim kazanır?</div>
            <OutcomeStats script={script} values={data.outcome} leader={leader} start={NOW} />
          </Card>
          <div style={{ flex: 1, display: "flex", gap: 12 }}>
            <Tile name="3+ gol" label="3+ gol"><Big>%{data.threePlus}</Big></Tile>
            <Tile name="iki takım da gol" label="İki takım da gol"><Big>%{data.bothScore}</Big></Tile>
          </div>
          <div style={{ flex: 1, display: "flex", gap: 12 }}>
            <Tile name="ilk gol" label="İlk gol">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {[{ team: home, value: data.firstGoal.home }, { team: away, value: data.firstGoal.away }].map(({ team, value }) => (
                  <div key={team.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 60, fontWeight: 900, letterSpacing: -2, ...tabular }}><Swatch color={team.colors.primary} size={22} />%{value}</div>
                ))}
              </div>
            </Tile>
            <Tile name="xG" label="xG (son maçlar)">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {[{ team: home, value: data.xg.home }, { team: away, value: data.xg.away }].map(({ team, value }) => (
                  <div key={team.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 60, fontWeight: 900, letterSpacing: -2, ...tabular }}><Swatch color={team.colors.primary} size={22} />{formatDecimal(value)}</div>
                ))}
              </div>
            </Tile>
          </div>
          {data.h2hAvg !== null ? (
            <Card name="h2h özeti" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "8px 22px" }}>
              <div style={{ fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2 }}>Kafa kafaya maç başına gol</div>
              <div style={{ fontSize: TYPE.value, fontWeight: 900, lineHeight: 1.1, ...tabular }}>{formatDecimal(data.h2hAvg)}</div>
            </Card>
          ) : null}
        </Main>
        <TrustLine script={script} />
      </AbsoluteFill>

      {question > 0 ? (
        <AbsoluteFill style={{ opacity: question }}>
          {homePhoto ? <Cutout photo={homePhoto} color={home.colors.primary} slot={left} drift={12} /> : null}
          {awayPhoto ? <Cutout photo={awayPhoto} color={away.colors.primary} slot={right} drift={-12} /> : null}
          <Title line1={words.slice(0, -1).join(" ")} line2={lastWord} accent={accent} still />
          <Main height={360} style={{ justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Crest src={home.logo} size={210} />
              <div style={{ fontSize: 130, fontWeight: 900, ...tabular }}>? – ?</div>
              <Crest src={away.logo} size={210} />
            </div>
          </Main>
          <Strip>
            <Card name="çağrı" edge={accent} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 72, fontWeight: 900, color: accent }}>{data.prompt}</div>
            </Card>
          </Strip>
        </AbsoluteFill>
      ) : null}

      {close > 0 ? (
        <AbsoluteFill style={{ opacity: close, alignItems: "center", justifyContent: "center", gap: 34, paddingBottom: 200, fontFamily: FONT_FAMILY }}>
          <Img src={staticFile(script.brand.logo)} style={{ width: 720 }} />
          <div style={{ color: accent, fontSize: 58, fontWeight: 700 }}>{data.handle}</div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}
