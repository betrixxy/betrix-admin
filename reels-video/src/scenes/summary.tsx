import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Card, clamp, COLORS, Crest, Cutout, Main, PhotoPair, Strip, Swatch, Title } from "../components/Primitives";
import { FONTS, heroNumber, wordLabel, monoValue, sentence } from "../components/typography";
import { formatDecimal, TYPE, ZONES } from "../lib/motion";
import { LAYOUTS } from "../lib/photo-layouts";
import { photoOf, type SceneProps } from "./common";
import { OutcomeStats } from "./outcome";

/** Üç evre: özet kartı (kaydedilmeye değer) → soru → kapanış. */
export const SUMMARY_PHASES = { question: 210, close: 285 } as const;

const NOW = { home: -60, draw: -60, away: -60 };

function Tile({ name, label, children }: { name: string; label: string; children: ReactNode }) {
  return (
    <Card name={name} style={{ flex: 1, justifyContent: "center", gap: 4, padding: "10px 20px" }}>
      <div style={{ ...wordLabel(), color: COLORS.ink2, whiteSpace: "nowrap" }}>{label}</div>
      {children}
    </Card>
  );
}

function PairRow({ items, format }: { items: { color: string; value: number; id: number }[]; format: (value: number) => string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      {items.map((item) => <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, ...monoValue(50) }}><Swatch color={item.color} size={22} />{format(item.value)}</div>)}
    </div>
  );
}

export function SummaryScene({ script, scene }: SceneProps<"S16_SUMMARY">) {
  const frame = useCurrentFrame();
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
  const pair = (homeValue: number, awayValue: number) => [{ id: home.id, color: home.colors.primary, value: homeValue }, { id: away.id, color: away.colors.primary, value: awayValue }];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: summary }}>
        <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
        <Main height={ZONES.stripTop + ZONES.stripHeight - ZONES.mainTop} style={{ gap: 12, transform: "none" }}>
          <Card name="kim kazanır" style={{ padding: "14px 22px", gap: 8 }}>
            <div style={{ ...wordLabel(), color: COLORS.ink2 }}>Kim kazanır?</div>
            <OutcomeStats script={script} values={data.outcome} leader={leader} start={NOW} sizes={{ lead: 170, rest: 104 }} />
          </Card>
          <div style={{ flex: 1, display: "flex", gap: 12 }}>
            <Tile name="3+ gol" label="3+ gol"><div style={heroNumber(TYPE.big)}>%{data.threePlus}</div></Tile>
            <Tile name="iki takım da gol" label="İki takım da gol"><div style={heroNumber(TYPE.big)}>%{data.bothScore}</div></Tile>
          </div>
          <div style={{ flex: 1, display: "flex", gap: 12 }}>
            <Tile name="ilk gol" label="İlk gol"><PairRow items={pair(data.firstGoal.home, data.firstGoal.away)} format={(value) => `%${value}`} /></Tile>
            <Tile name="xG" label="xG ort."><PairRow items={pair(data.xg.home, data.xg.away)} format={(value) => formatDecimal(value)} /></Tile>
          </div>
          {data.h2hAvg !== null ? (
            <Card name="h2h özeti" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "8px 22px" }}>
              <div style={{ ...wordLabel(), color: COLORS.ink2 }}>H2H maç başına gol</div>
              <div style={monoValue()}>{formatDecimal(data.h2hAvg)}</div>
            </Card>
          ) : null}
        </Main>
      </AbsoluteFill>

      {question > 0 ? (
        <AbsoluteFill style={{ opacity: question }}>
          <PhotoPair>
{homePhoto ? <Cutout photo={homePhoto} color={home.colors.primary} slot={left} fade={false} drift={12} /> : null}
          {awayPhoto ? <Cutout photo={awayPhoto} color={away.colors.primary} slot={right} fade={false} drift={-12} /> : null}
</PhotoPair>
          <Title line1={words.slice(0, -1).join(" ")} line2={words.at(-1) ?? ""} accent={accent} still />
          <Main height={360} style={{ justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Crest src={home.logo} size={210} />
              <div style={heroNumber(190)}>? – ?</div>
              <Crest src={away.logo} size={210} />
            </div>
          </Main>
          <Strip>
            <Card name="çağrı" edge={accent} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <div style={{ ...sentence(72, 900), color: accent }}>{data.prompt}</div>
            </Card>
          </Strip>
        </AbsoluteFill>
      ) : null}

      {close > 0 ? (
        <AbsoluteFill style={{ opacity: close, alignItems: "center", justifyContent: "center", gap: 34, paddingBottom: 200, fontFamily: FONTS.body }}>
          <Img src={staticFile(script.brand.logo)} style={{ width: 720 }} />
          <div style={{ color: accent, ...sentence(58) }}>{data.handle}</div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
}
