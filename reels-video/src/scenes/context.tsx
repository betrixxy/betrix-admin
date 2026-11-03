import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Bar, Card, clamp, COLORS, Crest, Cutout, Main, Strip, Title } from "../components/Primitives";
import { heroNumber, wordLabel, monoValue, sentence, teamName } from "../components/typography";
import { countUp, formatDecimal, TYPE, withLocative } from "../lib/motion";
import { LAYOUTS } from "../lib/photo-layouts";
import { photoOf, type SceneProps } from "./common";

const Heading = ({ scene, accent }: { scene: { headline: { line1: string; line2: string } | null }; accent: string }) => <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />;

function SentenceStrip({ name, text }: { name: string; text: string }) {
  return (
    <Strip>
      <Card name={name} style={{ flex: 1, justifyContent: "center" }}>
        <div style={sentence()}>{text}</div>
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
            <div style={teamName(56)}>{team.shortName}</div>
            {days === null ? (
              <div style={{ ...sentence(TYPE.value, 900), textAlign: "center", lineHeight: 1.1, color: COLORS.ink2 }}>Avrupa maçı yok</div>
            ) : (
              <div style={heroNumber(280)}>{countUp(frame, { to: days, start: 18, duration: 34 })}</div>
            )}
            <div style={{ ...sentence(TYPE.label, 500), color: COLORS.ink2, textAlign: "center", lineHeight: 1.15 }}>{days === null ? "Bu dönem Avrupa'da oynamıyor" : "gün önce Avrupa'da oynadı"}</div>
            {days === null ? null : (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  {Array.from({ length: 7 }, (_, index) => <div key={index} style={{ width: 42, height: 42, borderRadius: "50%", background: index < Math.min(days, 7) ? team.colors.primary : COLORS.track }} />)}
                </div>
                <div style={{ ...wordLabel(TYPE.note), color: COLORS.ink3 }}><span style={monoValue(TYPE.note)}>1</span> daire = <span style={monoValue(TYPE.note)}>1</span> gün</div>
              </>
            )}
          </Card>
        ))}
      </Main>
      <SentenceStrip name="takvim özeti" text={scene.data.sentence} />
    </AbsoluteFill>
  );
}

/** 14: modelin karnesi. Gerçek veride ReelSnapshot tabanlı sonuç olmadan kapalı (`story/track-record.ts`). */
export function TrackRecordScene({ script, scene }: SceneProps<"S14_TRACK_RECORD">) {
  const frame = useCurrentFrame();
  const accent = script.brand.accent;
  const { focus, buckets } = scene.data;
  const grow = interpolate(frame, [26, 76], [0, 1], clamp);
  const plot = 480;
  return (
    <AbsoluteFill>
      <Heading scene={scene} accent={accent} />
      <Main style={{ gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22, height: 190 }}>
          <div style={heroNumber(TYPE.hero)}>%{countUp(frame, { to: focus.hitRate, start: 16, duration: 44 })}</div>
          <div style={sentence()}>Model {focus.range} dediği maçların %{withLocative(focus.hitRate)} o sonuç çıktı ({focus.matches} maç).</div>
        </div>
        <Card name="kalibrasyon" style={{ flex: 1, flexDirection: "row", gap: 8, alignItems: "flex-end", padding: "14px 16px" }}>
          {buckets.map((bucket) => (
            <div key={bucket.range} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ position: "relative", width: "100%", height: plot }}>
                <div style={{ position: "absolute", bottom: 0, width: "100%", height: `${bucket.hitRate * grow}%`, background: bucket.active ? accent : "rgba(255,255,255,0.28)", borderRadius: "8px 8px 0 0" }} />
                <div style={{ position: "absolute", left: -2, right: -2, bottom: `${bucket.mid}%`, height: 5, background: COLORS.ink }} />
                <div style={{ position: "absolute", left: 0, right: 0, textAlign: "center", bottom: `calc(${Math.max(bucket.hitRate, bucket.mid)}% + 8px)`, ...monoValue(TYPE.label), color: bucket.active ? COLORS.ink : COLORS.ink2, opacity: grow }}>%{bucket.hitRate}</div>
              </div>
              <div style={{ ...monoValue(TYPE.note), fontWeight: 500, color: COLORS.ink2, whiteSpace: "nowrap", letterSpacing: -2 }}>{bucket.range}</div>
            </div>
          ))}
        </Card>
      </Main>
      <Strip>
        <Card name="grafik açıklaması" style={{ flex: 1, justifyContent: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, ...sentence(30) }}><span style={{ width: 32, height: 22, background: accent, borderRadius: 4 }} />Sütun: gerçekleşen oran</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, ...sentence(30) }}><span style={{ width: 32, height: 5, background: COLORS.ink }} />Çizgi: tahmin aralığının ortası</div>
          <div style={{ ...sentence(TYPE.note, 500), color: COLORS.ink3 }}>Yalnız başlama öncesi hesaplar sayıldı.</div>
        </Card>
      </Strip>
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
          <div style={heroNumber(TYPE.hero + 60)}>%{countUp(frame, { to: data.percent, start: 14, duration: 40 })}</div>
          <div style={sentence(40)}>En olası sonuç bile garanti değildir.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 20, justifyItems: "center" }}>
          {Array.from({ length: 10 }, (_, index) => {
            const start = 24 + index * 5;
            const filled = index < data.hitsOfTen;
            const pop = interpolate(frame, [start, start + 8], [0, 1], clamp);
            return <div key={index} style={{ width: 158, height: 158, borderRadius: "50%", border: `6px solid ${filled ? accent : "rgba(255,255,255,0.28)"}`, background: filled ? accent : "transparent", opacity: pop, transform: `scale(${0.7 + 0.3 * pop})` }} />;
          })}
        </div>
        <div style={{ display: "flex", gap: 40, ...sentence(TYPE.label), color: COLORS.ink2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 28, height: 28, borderRadius: "50%", background: accent }} />O sonuç</span>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 28, height: 28, borderRadius: "50%", border: "4px solid rgba(255,255,255,0.4)" }} />Başka sonuç</span>
        </div>
      </Main>
      <SentenceStrip name="ihtimal açıklaması" text={data.statement} />
    </AbsoluteFill>
  );
}
