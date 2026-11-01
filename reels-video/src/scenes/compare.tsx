import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Bar, Card, clamp, COLORS, Crest, Cutout, Main, Strip, Swatch, tabular, Title, TrustLine } from "../components/Primitives";
import { countUpTenths, formatDecimal, TYPE } from "../lib/motion";
import { LAYOUTS } from "../lib/photo-layouts";
import { photoOf, type SceneProps } from "./common";

const COLUMNS = "204px 1fr 204px";
const FORM_COLOR = { G: "#2EA537", B: "#5B6660", M: "#9C3B3B" } as const;

function FormChips({ letters, align }: { letters: readonly ("G" | "B" | "M")[]; align: "flex-start" | "flex-end" }) {
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: align }}>
      {letters.map((letter, index) => (
        <div key={index} style={{ width: 34, height: 44, borderRadius: 8, background: FORM_COLOR[letter], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 900 }}>{letter}</div>
      ))}
    </div>
  );
}

/** Üstün değer takım renginde çerçeveli çipte; diğeri sönük. Rakam her zaman okunur renkte. */
function CompareValue({ value, color, win, align }: { value: string; color: string; win: boolean; align: "left" | "right" }) {
  return (
    <div style={{ display: "flex", justifyContent: align === "left" ? "flex-start" : "flex-end" }}>
      <div style={{ padding: "0 14px", borderRadius: 14, border: `3px solid ${win ? color : "transparent"}`, background: win ? `${color}33` : "transparent", fontSize: TYPE.value, fontWeight: 900, letterSpacing: -1, lineHeight: 1.2, color: win ? COLORS.ink : COLORS.ink3, ...tabular }}>{value}</div>
    </div>
  );
}

/** 4: iki sütun, ortada etiketler, üstün olan taraf vurgulu. */
export function CompareScene({ script, scene }: SceneProps<"S04_COMPARE">) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const { data } = scene;
  const homeWins = data.rows.filter((row) => row.better === "home").length;
  const awayWins = data.rows.filter((row) => row.better === "away").length;
  const rowStyle = (index: number) => ({ flex: 1, display: "grid", gridTemplateColumns: COLUMNS, alignItems: "center", borderTop: `1px solid ${COLORS.border}`, opacity: interpolate(frame, [18 + index * 9, 28 + index * 9], [0, 1], clamp) });
  return (
    <AbsoluteFill>
      <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={script.brand.accent} />
      <Main>
        <Card name="karşılaştırma" style={{ height: "100%", padding: "14px 22px" }}>
          <div style={{ display: "grid", gridTemplateColumns: COLUMNS, alignItems: "center", paddingBottom: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><Crest src={home.logo} size={68} /><div style={{ fontSize: TYPE.label, fontWeight: 900 }}>{home.shortName}</div></div>
            <div />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}><Crest src={away.logo} size={68} /><div style={{ fontSize: TYPE.label, fontWeight: 900 }}>{away.shortName}</div></div>
          </div>
          <div style={rowStyle(0)}>
            <FormChips letters={data.form.home} align="flex-start" />
            <div style={{ textAlign: "center", fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2 }}>Son 5 maç</div>
            <FormChips letters={data.form.away} align="flex-end" />
          </div>
          {data.rows.map((row, index) => (
            <div key={row.key} style={rowStyle(index + 1)}>
              <CompareValue value={row.home} color={home.colors.primary} win={row.better === "home"} align="left" />
              <div style={{ textAlign: "center", fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2, lineHeight: 1.1 }}>{row.label}</div>
              <CompareValue value={row.away} color={away.colors.primary} win={row.better === "away"} align="right" />
            </div>
          ))}
        </Card>
      </Main>
      <Strip>
        <Card name="özet" style={{ flex: 1, justifyContent: "center", gap: 14 }}>
          <div style={{ fontSize: 38, fontWeight: 700, whiteSpace: "nowrap" }}>{data.summary}</div>
          <div style={{ display: "flex", gap: 4, height: 16 }}>
            {homeWins > 0 ? <div style={{ flex: homeWins, background: home.colors.primary, borderRadius: 8 }} /> : null}
            {awayWins > 0 ? <div style={{ flex: awayWins, background: away.colors.primary, borderRadius: 8 }} /> : null}
          </div>
        </Card>
      </Strip>
      <TrustLine script={script} />
    </AbsoluteFill>
  );
}

/** 5: skor şeridi en yeni solda; kazanan renk kenarda, hangi skor kimin arma sırasından okunur. */
export function HeadToHeadScene({ script, scene }: SceneProps<"S05_H2H">) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const { data } = scene;
  const crestOf = (name: string) => (name === home.name ? home.logo : away.logo);
  const colorOf = (name: string) => (name === home.name ? home.colors.primary : away.colors.primary);
  const goals = data.matches.map((match) => match.score.split("–").map(Number));
  const peak = Math.max(1, ...goals.map(([a = 0, b = 0]) => a + b));
  const segments = [
    { label: home.shortName, value: data.homeWins, color: home.colors.primary },
    { label: "Beraberlik", value: data.draws, color: COLORS.draw },
    { label: away.shortName, value: data.awayWins, color: away.colors.primary },
  ];
  return (
    <AbsoluteFill>
      <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={script.brand.accent} />
      <Main style={{ gap: 16 }}>
        <div style={{ display: "flex", gap: 10, height: 240 }}>
          {data.matches.map((match, index) => {
            const [a = 0, b = 0] = goals[index] ?? [];
            const edge = a === b ? COLORS.draw : a > b ? colorOf(match.home) : colorOf(match.away);
            return (
              <Card key={index} name={`maç ${index + 1}`} edge={edge} style={{ flex: 1, padding: "12px 4px", alignItems: "center", justifyContent: "space-between", opacity: interpolate(frame, [12 + index * 7, 20 + index * 7], [0, 1], clamp) }}>
                <div style={{ fontSize: TYPE.note, fontWeight: 500, color: COLORS.ink2, ...tabular }}>{match.date}</div>
                <div style={{ display: "flex", gap: 8 }}><Crest src={crestOf(match.home)} size={54} /><Crest src={crestOf(match.away)} size={54} /></div>
                <div style={{ fontSize: TYPE.value, fontWeight: 900, lineHeight: 1, ...tabular }}>{match.score}</div>
              </Card>
            );
          })}
        </div>
        <Card name="gol ortalaması" style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 24 }}>
          <div style={{ width: 340, flexShrink: 0 }}>
            <div style={{ fontSize: 176, fontWeight: 900, letterSpacing: -5, lineHeight: 1, ...tabular }}>{formatDecimal(countUpTenths(frame, { to: data.avgGoals, start: 20, duration: 50 }))}</div>
            <div style={{ fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2, lineHeight: 1.15 }}>maç başına gol, son {data.played} maç</div>
          </div>
          <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", paddingBlock: 6 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 12 }}>
              {goals.map(([a = 0, b = 0], index) => (
                <div key={index} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: TYPE.label, fontWeight: 900, ...tabular }}>{a + b}</div>
                  <div style={{ width: "100%", borderRadius: "8px 8px 0 0", background: script.brand.accent, height: `${((a + b) / peak) * 72 * interpolate(frame, [30, 70], [0, 1], clamp)}%` }} />
                </div>
              ))}
            </div>
            <div style={{ fontSize: TYPE.note, color: COLORS.ink2, marginTop: 8, whiteSpace: "nowrap" }}>Şeritteki maçlarda toplam gol</div>
          </div>
        </Card>
      </Main>
      <Strip>
        <Card name="galibiyet dağılımı" style={{ flex: 1, justifyContent: "center", gap: 14 }}>
          <div style={{ display: "flex", gap: 4, height: 18 }}>
            {segments.filter((segment) => segment.value > 0).map((segment) => <div key={segment.label} style={{ flex: segment.value, background: segment.color, borderRadius: 6 }} />)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: TYPE.label, fontWeight: 700, whiteSpace: "nowrap" }}>
            {segments.map((segment) => <span key={segment.label} style={{ display: "flex", alignItems: "center", gap: 8 }}><Swatch color={segment.color} />{segment.label} {segment.value}</span>)}
          </div>
        </Card>
      </Strip>
      <TrustLine script={script} />
    </AbsoluteFill>
  );
}

/** 7: en belirgin fark, tek büyük görsel. */
export function KeyGapScene({ script, scene }: SceneProps<"S07_KEY_GAP">) {
  const frame = useCurrentFrame();
  const { data } = scene;
  const lead = script.meta.teams[data.leader];
  const other = script.meta.teams[data.leader === "home" ? "away" : "home"];
  const photo = photoOf(script, scene.assets.photoIds, data.leader);
  const [slot] = LAYOUTS.feature.slots;
  const numeric = (text: string) => Number(text.replace("%", "").replace(",", "."));
  const peak = Math.max(numeric(data.leaderValue), numeric(data.otherValue), 0.01);
  const grow = interpolate(frame, [24, 66], [0, 1], clamp);
  const rows = [
    { team: lead, value: data.leaderValue, muted: false },
    { team: other, value: data.otherValue, muted: true },
  ];
  return (
    <AbsoluteFill>
      {photo ? <Cutout photo={photo} color={lead.colors.primary} slot={slot} drift={-10} /> : null}
      <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={script.brand.accent} />
      <Main height={370} style={{ width: 580, justifyContent: "center" }}>
        <div style={{ fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2 }}>{data.metric}</div>
        <div style={{ fontSize: 200, fontWeight: 900, letterSpacing: -6, lineHeight: 1.05, ...tabular }}>{data.leaderValue}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 40, fontWeight: 900 }}><Crest src={lead.logo} size={56} />{lead.shortName}</div>
      </Main>
      <Main top={900} height={362}>
        <Card name="fark" style={{ height: "100%", justifyContent: "center", gap: 26 }}>
          {rows.map(({ team, value, muted }) => (
            <div key={team.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: TYPE.label, fontWeight: 700 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 12 }}><Crest src={team.logo} size={48} />{team.name}</span>
                <span style={{ fontSize: TYPE.value, fontWeight: 900, color: muted ? COLORS.ink2 : COLORS.ink, ...tabular }}>{value}</span>
              </div>
              <Bar fraction={(numeric(value) / peak) * grow} color={team.colors.primary} height={26} />
            </div>
          ))}
        </Card>
      </Main>
      <Strip>
        <Card name="açıklama" style={{ flex: 1, justifyContent: "center" }}>
          <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.2 }}>{data.sentence}</div>
        </Card>
      </Strip>
      <TrustLine script={script} />
    </AbsoluteFill>
  );
}
