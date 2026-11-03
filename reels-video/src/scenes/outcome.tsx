import { interpolate, useCurrentFrame } from "remotion";
import { clamp, COLORS, Swatch } from "../components/Primitives";
import { heroNumber, teamName } from "../components/typography";
import { countUp, TYPE } from "../lib/motion";
import type { ReelScript } from "../schema";


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

