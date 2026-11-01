import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { DotGrid, Gauge, PitchRace } from "../components/Charts";
import { Bar, Card, clamp, COLORS, Crest, Cutout, Main, Strip, Swatch, Title } from "../components/Primitives";
import { heroNumber, wordLabel, monoValue, sentence, teamName } from "../components/typography";
import { CONTENT_WIDTH, countUp, formatDecimal, formatInt, ofTen, TYPE } from "../lib/motion";
import { LAYOUTS } from "../lib/photo-layouts";
import type { ReelScript } from "../schema";
import { photoOf, type SceneProps } from "./common";

export const OUTCOME_STOPS = { home: 30, draw: 74, away: 118 } as const;

/** Sonuç sütunları: önde olan taraf en büyük rakam, diğerleri ikinci büyüklükte. S06 ve özet kartı ortak. */
export function OutcomeStats({ script, values, leader, start = OUTCOME_STOPS, sizes = { lead: TYPE.hero, rest: TYPE.big } }: { script: ReelScript; sizes?: { lead: number; rest: number }; values: { home: number; draw: number; away: number }; leader: "home" | "draw" | "away"; start?: { home: number; draw: number; away: number } }) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const columns = [
    { key: "home", label: home.shortName, color: home.colors.primary, value: values.home },
    { key: "draw", label: "Beraberlik", color: COLORS.draw, value: values.draw },
    { key: "away", label: away.shortName, color: away.colors.primary, value: values.away },
  ] as const;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
      {columns.map((column) => (
        <div key={column.key} style={{ display: "flex", flexDirection: "column", gap: 2, opacity: interpolate(frame, [start[column.key] - 6, start[column.key] + 4], [0, 1], clamp) }}>
          <div style={heroNumber(column.key === leader ? sizes.lead : sizes.rest)}>%{countUp(frame, { to: column.value, start: start[column.key], duration: 36 })}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, ...teamName() }}><Swatch color={column.color} />{column.label}</div>
        </div>
      ))}
    </div>
  );
}

/** 6: nokta ızgarası + iki oyuncu. */
export function WinnerScene({ script, scene }: SceneProps<"S06_WINNER">) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const { data } = scene;
  const [left, right] = LAYOUTS.winner.slots;
  const homePhoto = photoOf(script, scene.assets.photoIds, "home");
  const awayPhoto = photoOf(script, scene.assets.photoIds, "away");
  const lit = (to: number, start: number) => countUp(frame, { to, start, duration: 36 });
  return (
    <AbsoluteFill>
      {homePhoto ? <Cutout photo={homePhoto} color={home.colors.primary} slot={left} drift={10} /> : null}
      {awayPhoto ? <Cutout photo={awayPhoto} color={away.colors.primary} slot={right} drift={-10} /> : null}
      <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={script.brand.accent} />
      <Main top={780} height={90} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Crest src={home.logo} size={84} />
        {data.simulationsPerDot !== null ? (
          <div data-block="ölçek" style={{ ...wordLabel(30), color: COLORS.ink, padding: "6px 18px", background: COLORS.surface, border: `2px solid ${COLORS.border}`, borderRadius: 14, whiteSpace: "nowrap" }}>
            <span style={monoValue(30)}>1</span> nokta = <span style={monoValue(30)}>{formatInt(data.simulationsPerDot)}</span> simülasyon
          </div>
        ) : null}
        <Crest src={away.logo} size={84} />
      </Main>
      <Main top={880} height={350}>
        <div data-block="nokta ızgarası">
          <DotGrid size={CONTENT_WIDTH} segments={[
            { color: home.colors.primary, lit: lit(data.dots.home, OUTCOME_STOPS.home) },
            { color: COLORS.draw, lit: lit(data.dots.draw, OUTCOME_STOPS.draw) },
            { color: away.colors.primary, lit: lit(data.dots.away, OUTCOME_STOPS.away) },
          ]} />
        </div>
      </Main>
      <Main top={1240} height={235} style={{ justifyContent: "center" }}>
        <OutcomeStats script={script} values={data} leader={data.leader} />
      </Main>
    </AbsoluteFill>
  );
}

function SupportCard({ name, value, label, crest }: { name: string; value: string; label: string; crest?: string }) {
  return (
    <Card name={name} style={{ flex: 1, justifyContent: "center", gap: 6, padding: "10px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {crest ? <Crest src={crest} size={52} /> : null}
        <div style={monoValue()}>{value}</div>
      </div>
      <div style={{ ...wordLabel(26), color: COLORS.ink2, whiteSpace: "nowrap" }}>{label}</div>
    </Card>
  );
}

function GaugeHero({ value, radius, stroke, color, size }: { value: number; radius: number; stroke: number; color: string; size: number }) {
  return (
    <div style={{ position: "relative", alignSelf: "center" }}>
      <Gauge value={value} color={color} radius={radius} stroke={stroke} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: stroke / 2 - 4, textAlign: "center", ...heroNumber(size) }}>%{value}</div>
    </div>
  );
}

function TenDots({ lit, color, size }: { lit: number; color: string; size: number }) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {Array.from({ length: 10 }, (_, index) => <div key={index} style={{ width: size, height: size, borderRadius: "50%", background: index < lit ? color : COLORS.track }} />)}
    </div>
  );
}

/** 8: gauge + destek şeridi. */
export function GoalsScene({ script, scene }: SceneProps<"S08_GOALS">) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const { data } = scene;
  const accent = script.brand.accent;
  const hits = Math.round(data.percent / 10);
  return (
    <AbsoluteFill>
      <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
      <Main style={{ gap: 10 }}>
        <GaugeHero value={countUp(frame, { to: data.percent, start: 18, duration: 66 })} radius={390} stroke={64} color={accent} size={280} />
        <div style={{ textAlign: "center", ...sentence(44) }}>3 ve üzeri gol olasılığı</div>
        <Card name="on maçta" style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 16, marginTop: 6 }}>
          <TenDots lit={hits} color={accent} size={62} />
          <div style={{ ...sentence(), whiteSpace: "nowrap" }}>10 maçın yaklaşık {ofTen(hits)} 3+ gollü</div>
        </Card>
      </Main>
      <Strip>
        <SupportCard name="ev xG" crest={home.logo} value={formatDecimal(data.xg.home)} label={`${home.shortName} xG`} />
        <SupportCard name="deplasman xG" crest={away.logo} value={formatDecimal(data.xg.away)} label={`${away.shortName} xG`} />
        {data.h2hAvg !== null ? <SupportCard name="h2h" value={formatDecimal(data.h2hAvg)} label="H2H gol ort." /> : null}
      </Strip>
    </AbsoluteFill>
  );
}

/** 9: iki yarım gauge; takım olasılığı yoksa tek gauge + gol yememe oranları. */
export function BothScoreScene({ script, scene }: SceneProps<"S09_BOTH_SCORE">) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const { data } = scene;
  const accent = script.brand.accent;
  const teams = [{ team: home, chance: data.teamChance?.home ?? 0, sheet: data.cleanSheet.home }, { team: away, chance: data.teamChance?.away ?? 0, sheet: data.cleanSheet.away }];
  const shown = countUp(frame, { to: data.percent, start: 16, duration: 60 });
  return (
    <AbsoluteFill>
      <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
      {data.teamChance ? (
        <Main style={{ gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 26, height: 200 }}>
            <div style={heroNumber(TYPE.hero + 30)}>%{shown}</div>
            <div style={sentence(40)}>İki takımın da gol bulma olasılığı</div>
          </div>
          <div style={{ flex: 1, display: "flex", gap: 14 }}>
            {teams.map(({ team, chance }) => (
              <Card key={team.id} name={`gol bulma ${team.shortName}`} edge={team.colors.primary} style={{ flex: 1, alignItems: "center", justifyContent: "space-evenly", padding: "14px 8px" }}>
                <Crest src={team.logo} size={110} />
                <div style={teamName(50)}>{team.shortName}</div>
                <div style={{ position: "relative" }}>
                  <Gauge value={countUp(frame, { to: chance, start: 30, duration: 50 })} color={team.colors.primary} radius={170} stroke={36} />
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 8, textAlign: "center", ...heroNumber(TYPE.big) }}>%{countUp(frame, { to: chance, start: 30, duration: 50 })}</div>
                </div>
                <div style={{ ...sentence(TYPE.label, 500), color: COLORS.ink2 }}>gol bulma olasılığı</div>
              </Card>
            ))}
          </div>
        </Main>
      ) : (
        <Main style={{ justifyContent: "center", gap: 30 }}>
          <GaugeHero value={shown} radius={390} stroke={64} color={accent} size={280} />
          <div style={{ textAlign: "center", ...sentence(44) }}>İki takımın da gol bulma olasılığı</div>
        </Main>
      )}
      <Strip>
        {teams.map(({ team, sheet }) => (
          <Card key={team.id} name={`gol yememe ${team.shortName}`} style={{ flex: 1, justifyContent: "center", gap: 8, padding: "10px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={teamName()}>{team.shortName}</div>
              <div style={{ ...monoValue(), lineHeight: 1 }}>%{countUp(frame, { to: sheet, start: 40, duration: 40 })}</div>
            </div>
            <Bar fraction={countUp(frame, { to: sheet, start: 40, duration: 40 }) / 100} color={team.colors.primary} height={12} />
            <div style={{ ...wordLabel(26), color: COLORS.ink2 }}>Gol yememe oranı</div>
          </Card>
        ))}
      </Strip>
    </AbsoluteFill>
  );
}

/** 10: saha diyagramı + gol olmama ihtimali. */
export function FirstGoalScene({ script, scene }: SceneProps<"S10_FIRST_GOAL">) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const { data } = scene;
  const progress = interpolate(frame, [22, 80], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const sides = [{ team: home, value: data.home, align: "flex-start" as const }, { team: away, value: data.away, align: "flex-end" as const }];
  return (
    <AbsoluteFill>
      <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={script.brand.accent} />
      <Main style={{ gap: 14 }}>
        <div data-block="saha"><PitchRace width={CONTENT_WIDTH} height={470} home={data.home} away={data.away} homeColor={home.colors.primary} awayColor={away.colors.primary} progress={progress} /></div>
        <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }}>
          {sides.map(({ team, value, align }) => (
            <div key={team.id} style={{ display: "flex", flexDirection: "column", alignItems: align, justifyContent: "center", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, ...teamName(46) }}><Crest src={team.logo} size={64} />{team.shortName}</div>
              <div style={heroNumber(TYPE.hero)}>%{countUp(frame, { to: value, start: 34, duration: 50 })}</div>
            </div>
          ))}
        </div>
      </Main>
      <Strip>
        <Card name="golsüz" style={{ flex: 1, justifyContent: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={sentence()}>Gol olmama ihtimali</div>
            <div style={{ ...monoValue(), lineHeight: 1 }}>%{countUp(frame, { to: data.none, start: 50, duration: 30 })}</div>
          </div>
          <Bar fraction={countUp(frame, { to: data.none, start: 50, duration: 30 }) / 100} color={COLORS.draw} height={14} />
        </Card>
      </Strip>
    </AbsoluteFill>
  );
}
