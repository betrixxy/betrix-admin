import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Bar, Card, clamp, COLORS, Crest, Cutout, Main, Strip, tabular, Title, TrustLine } from "../components/Primitives";
import { countUp, formatDecimal, TYPE, withLocative } from "../lib/motion";
import { LAYOUTS } from "../lib/photo-layouts";
import { photoOf, type SceneProps } from "./common";

const Heading = ({ scene, accent }: { scene: { headline: { line1: string; line2: string } | null }; accent: string }) => <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />;

function SentenceStrip({ name, text }: { name: string; text: string }) {
  return (
    <Strip>
      <Card name={name} style={{ flex: 1, justifyContent: "center" }}>
        <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.2 }}>{text}</div>
      </Card>
    </Strip>
  );
}

/** 11: son Avrupa maçından bu yana gün. Avrupa'da oynamayan taraf sayı almaz. */
export function FatigueScene({ script, scene }: SceneProps<"S11_FATIGUE">) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const sides = [{ team: home, days: scene.data.days.home }, { team: away, days: scene.data.days.away }];
  return (
    <AbsoluteFill>
      <Heading scene={scene} accent={script.brand.accent} />
      <Main style={{ flexDirection: "row", gap: 14 }}>
        {sides.map(({ team, days }) => (
          <Card key={team.id} name={`takvim ${team.shortName}`} edge={days === null ? undefined : team.colors.primary} style={{ flex: 1, alignItems: "center", justifyContent: "space-evenly", padding: "20px 12px" }}>
            <Crest src={team.logo} size={150} />
            <div style={{ fontSize: 44, fontWeight: 900 }}>{team.shortName}</div>
            {days === null ? (
              <div style={{ fontSize: TYPE.value, fontWeight: 900, textAlign: "center", lineHeight: 1.1, color: COLORS.ink2 }}>Avrupa maçı yok</div>
            ) : (
              <div style={{ fontSize: 240, fontWeight: 900, letterSpacing: -8, lineHeight: 1, ...tabular }}>{countUp(frame, { to: days, start: 18, duration: 34 })}</div>
            )}
            <div style={{ fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2, textAlign: "center", lineHeight: 1.15 }}>{days === null ? "Bu dönem Avrupa'da oynamıyor" : "gün önce Avrupa'da oynadı"}</div>
            {days === null ? null : (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  {Array.from({ length: 7 }, (_, index) => <div key={index} style={{ width: 42, height: 42, borderRadius: "50%", background: index < Math.min(days, 7) ? team.colors.primary : COLORS.track }} />)}
                </div>
                <div style={{ fontSize: TYPE.note, color: COLORS.ink3 }}>1 daire = 1 gün</div>
              </>
            )}
          </Card>
        ))}
      </Main>
      <SentenceStrip name="takvim özeti" text={scene.data.sentence} />
      <TrustLine script={script} />
    </AbsoluteFill>
  );
}

/** 12: en olası skor (yalnız `score_scene_allowed`). */
export function ScoreScene({ script, scene }: SceneProps<"S12_SCORE">) {
  const frame = useCurrentFrame();
  const accent = script.brand.accent;
  const [top, ...rest] = scene.data.scores;
  if (!top) return null;
  const peak = top.percent;
  const sum = scene.data.scores.reduce((acc, cell) => acc + cell.percent, 0);
  return (
    <AbsoluteFill>
      <Heading scene={scene} accent={accent} />
      <Main style={{ gap: 14 }}>
        <Card name="en olası skor" edge={accent} style={{ height: 320, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: "0 34px" }}>
          <div style={{ fontSize: 220, fontWeight: 900, letterSpacing: -6, lineHeight: 1, ...tabular }}>{top.label}</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: TYPE.big, fontWeight: 900, letterSpacing: -3, lineHeight: 1, ...tabular }}>%{countUp(frame, { to: top.percent, start: 18, duration: 40 })}</div>
            <div style={{ fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2 }}>en olası</div>
          </div>
        </Card>
        <Card name="diğer skorlar" style={{ flex: 1, justifyContent: "space-evenly" }}>
          {rest.map((cell, index) => (
            <div key={cell.label} style={{ display: "grid", gridTemplateColumns: "130px 1fr 110px", alignItems: "center", gap: 18, opacity: interpolate(frame, [26 + index * 8, 36 + index * 8], [0, 1], clamp) }}>
              <div style={{ fontSize: TYPE.value, fontWeight: 900, lineHeight: 1, ...tabular }}>{cell.label}</div>
              <Bar fraction={(cell.percent / peak) * interpolate(frame, [30, 70], [0, 1], clamp)} color={accent} height={22} />
              <div style={{ fontSize: TYPE.value, fontWeight: 900, lineHeight: 1, textAlign: "right", ...tabular }}>%{cell.percent}</div>
            </div>
          ))}
        </Card>
      </Main>
      <SentenceStrip name="skor notu" text={`İlk ${scene.data.scores.length} skorun toplamı %${sum}. Tek bir skorun ihtimali her zaman düşüktür.`} />
      <TrustLine script={script} />
    </AbsoluteFill>
  );
}

/** 13: golcü adayı (yalnız `season_xg_fresh`). */
export function ScorerScene({ script, scene }: SceneProps<"S13_SCORER">) {
  const frame = useCurrentFrame();
  const { data } = scene;
  const team = script.meta.teams[data.leader];
  const rival = script.meta.teams[data.leader === "home" ? "away" : "home"];
  const photo = photoOf(script, scene.assets.photoIds, data.leader);
  const [slot] = LAYOUTS.feature.slots;
  const cells = [{ label: "Sezon xG", value: formatDecimal(data.xg, 2) }, { label: "Maç", value: String(data.games) }, { label: "Gol / maç", value: formatDecimal(data.goals / Math.max(1, data.games), 2) }];
  return (
    <AbsoluteFill>
      {photo ? <Cutout photo={photo} color={team.colors.primary} slot={slot} drift={-10} /> : null}
      <Heading scene={scene} accent={script.brand.accent} />
      <Main height={370} style={{ width: 580, justifyContent: "center" }}>
        <div style={{ fontSize: TYPE.value, fontWeight: 900, lineHeight: 1.1 }}>{data.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: TYPE.label, fontWeight: 700, color: COLORS.ink2 }}><Crest src={team.logo} size={44} />{team.shortName}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <div style={{ fontSize: 200, fontWeight: 900, letterSpacing: -6, lineHeight: 1.05, ...tabular }}>{countUp(frame, { to: data.goals, start: 18, duration: 34 })}</div>
          <div style={{ fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2 }}>sezon golü</div>
        </div>
      </Main>
      <Main top={900} height={362}>
        <Card name="sezon verisi" style={{ height: "100%", justifyContent: "space-evenly" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {cells.map((cell) => (
              <div key={cell.label}>
                <div style={{ fontSize: TYPE.big, fontWeight: 900, letterSpacing: -3, lineHeight: 1.05, ...tabular }}>{cell.value}</div>
                <div style={{ fontSize: TYPE.label, fontWeight: 500, color: COLORS.ink2 }}>{cell.label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: TYPE.note, color: COLORS.ink3 }}>Sezon verisi {data.updated} itibarıyla</div>
        </Card>
      </Main>
      {data.other ? <SentenceStrip name="rakip golcü" text={`Karşı tarafta ${data.other.name} (${rival.shortName}): ${data.other.goals} gol, ${formatDecimal(data.other.xg, 2)} xG.`} /> : null}
      <TrustLine script={script} />
    </AbsoluteFill>
  );
}

/** 14: modelin karnesi. Yalnız başlama öncesi hesaplar; kaynak `docs/contract-v1.1-ihtiyac.md`. */
export function TrackRecordScene({ script, scene }: SceneProps<"S14_TRACK_RECORD">) {
  const frame = useCurrentFrame();
  const accent = script.brand.accent;
  const { focus, buckets } = scene.data;
  const grow = interpolate(frame, [26, 76], [0, 1], clamp);
  const plot = 450;
  return (
    <AbsoluteFill>
      <Heading scene={scene} accent={accent} />
      <Main style={{ gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, height: 180 }}>
          <div style={{ fontSize: TYPE.hero, fontWeight: 900, letterSpacing: -5, lineHeight: 1, ...tabular }}>%{countUp(frame, { to: focus.hitRate, start: 16, duration: 44 })}</div>
          <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.18 }}>Model {focus.range} dediği maçların %{withLocative(focus.hitRate)} o sonuç çıktı ({focus.matches} maç).</div>
        </div>
        <Card name="kalibrasyon" style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "flex-end", padding: "14px 16px" }}>
          {buckets.map((bucket) => (
            <div key={bucket.range} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ position: "relative", width: "100%", height: plot }}>
                <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${bucket.hitRate * grow}%`, background: bucket.active ? accent : "rgba(255,255,255,0.28)", borderRadius: "8px 8px 0 0" }} />
                <div style={{ position: "absolute", left: -2, right: -2, bottom: `${bucket.mid}%`, height: 5, background: COLORS.ink }} />
                <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", bottom: `calc(${Math.max(bucket.hitRate, bucket.mid)}% + 8px)`, fontSize: TYPE.label, fontWeight: 900, color: bucket.active ? COLORS.ink : COLORS.ink2, opacity: grow, ...tabular }}>%{bucket.hitRate}</div>
              </div>
              <div style={{ fontSize: TYPE.note, fontWeight: 500, color: COLORS.ink2, whiteSpace: "nowrap", letterSpacing: -1, ...tabular }}>{bucket.range}</div>
            </div>
          ))}
        </Card>
      </Main>
      <Strip>
        <Card name="grafik açıklaması" style={{ flex: 1, justifyContent: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30, fontWeight: 700 }}><span style={{ width: 32, height: 22, background: accent, borderRadius: 4 }} />Sütun: gerçekleşen oran</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 30, fontWeight: 700 }}><span style={{ width: 32, height: 5, background: COLORS.ink }} />Çizgi: tahmin aralığının ortası</div>
          <div style={{ fontSize: TYPE.note, color: COLORS.ink3 }}>Yalnız başlama öncesi hesaplar sayıldı.</div>
        </Card>
      </Strip>
      <TrustLine script={script} />
    </AbsoluteFill>
  );
}

/** 15: ihtimal, kesinlik değil. */
export function ChanceScene({ script, scene }: SceneProps<"S15_CHANCE">) {
  const frame = useCurrentFrame();
  const accent = script.brand.accent;
  const { data } = scene;
  return (
    <AbsoluteFill>
      <Heading scene={scene} accent={accent} />
      <Main style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ fontSize: 210, fontWeight: 900, letterSpacing: -7, lineHeight: 1, ...tabular }}>%{countUp(frame, { to: data.percent, start: 14, duration: 40 })}</div>
          <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15 }}>En olası sonuç bile garanti değildir.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 20, justifyItems: "center" }}>
          {Array.from({ length: 10 }, (_, index) => {
            const start = 24 + index * 5;
            const filled = index < data.hitsOfTen;
            const pop = interpolate(frame, [start, start + 8], [0, 1], clamp);
            return <div key={index} style={{ width: 158, height: 158, borderRadius: "50%", border: `6px solid ${filled ? accent : "rgba(255,255,255,0.28)"}`, background: filled ? accent : "transparent", opacity: pop, transform: `scale(${0.7 + 0.3 * pop})` }} />;
          })}
        </div>
        <div style={{ display: "flex", gap: 40, fontSize: TYPE.label, fontWeight: 700, color: COLORS.ink2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 28, height: 28, borderRadius: "50%", background: accent }} />O sonuç</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 28, height: 28, borderRadius: "50%", border: "4px solid rgba(255,255,255,0.4)" }} />Başka sonuç</span>
        </div>
      </Main>
      <SentenceStrip name="ihtimal açıklaması" text={data.statement} />
      <TrustLine script={script} />
    </AbsoluteFill>
  );
}
