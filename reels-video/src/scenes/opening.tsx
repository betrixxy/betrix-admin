import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Bar, Card, clamp, COLORS, Crest, Cutout, Main, PhotoPair, Strip, Swatch, Title } from "../components/Primitives";
import { heroNumber, wordLabel, monoValue, sentence, teamName } from "../components/typography";
import { countUp, formatInt, SAFE, TYPE, WIDTH, ZONES } from "../lib/motion";
import { LAYOUTS } from "../lib/photo-layouts";
import { rollingScore } from "../story/rolling";
import { photoOf, type SceneProps } from "./common";

const LOGO_WIDTH = 760;
const LOGO_RATIO = 248 / 1269;

/** 1: ilk kare tam dolu ve hareketsiz; akışta görünen kare aynı zamanda kapak görseli. */
export function CoverScene({ script, scene }: SceneProps<"S01_COVER">) {
  const { home, away } = script.meta.teams;
  const homePhoto = photoOf(script, scene.assets.photoIds, "home");
  const awayPhoto = photoOf(script, scene.assets.photoIds, "away");
  const [left, right] = LAYOUTS.cover.slots;
  const { data } = scene;
  return (
    <AbsoluteFill>
      <PhotoPair>
{homePhoto ? <Cutout photo={homePhoto} color={home.colors.primary} slot={left} fade={false} drift={10} /> : null}
      {awayPhoto ? <Cutout photo={awayPhoto} color={away.colors.primary} slot={right} fade={false} drift={-10} /> : null}
</PhotoPair>
      <Title line1={scene.headline?.line1 ?? home.name} line2={scene.headline?.line2 ?? away.name} accent={script.brand.accent} still weight={600} />
      <div style={{ position: "absolute", left: WIDTH - SAFE.right - 96, top: ZONES.titleTop, display: "flex", flexDirection: "column", gap: 4 }}>
        <Crest src={home.logo} size={92} />
        <Crest src={away.logo} size={92} />
      </div>
      <Strip>
        <Card name="künye" style={{ flex: 1, justifyContent: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, whiteSpace: "nowrap", ...sentence(TYPE.label) }}>
            <span style={{ padding: "2px 16px", borderRadius: 12, background: script.brand.accent, color: "#04120A", fontWeight: 900 }}>{data.seriesLabel}</span>
            <span>{[data.league, data.round].filter(Boolean).join(" · ")}</span>
          </div>
          <div style={{ ...sentence(TYPE.label, 500), color: COLORS.ink2, whiteSpace: "nowrap" }}>{[data.dateLabel, data.venue].filter(Boolean).join(" · ")}</div>
        </Card>
      </Strip>
    </AbsoluteFill>
  );
}

/** 2: tik kendini çizer, yazı soldan açılır; sonda gerçek logo dosyası oturur. */
export function LogoScene({ script }: SceneProps<"S02_LOGO">) {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [6, 15], [0, 100], clamp);
  const word = interpolate(frame, [11, 19], [0, 100], clamp);
  const settled = interpolate(frame, [18, 21], [0, 1], clamp);
  const src = staticFile(script.brand.logo);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "relative", width: LOGO_WIDTH, height: LOGO_WIDTH * LOGO_RATIO }}>
        {/* Yazı bölgesi: logonun tik içermeyen kısmı (tik sol üstte, x < 215, y < 90). */}
        <Img src={src} style={{ position: "absolute", inset: 0, width: "100%", clipPath: `polygon(9.6% 37%, ${9.6 + word * 0.904}% 37%, ${9.6 + word * 0.904}% 100%, 9.6% 100%)` }} />
        <svg width={LOGO_WIDTH} height={LOGO_WIDTH * LOGO_RATIO} viewBox="0 0 1269 248" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <path d="M 28 100 L 74 156 Q 112 74 204 18" fill="none" stroke={script.brand.accent} strokeWidth={30} pathLength={100} strokeDasharray={`${draw} 100`} />
        </svg>
        <Img src={src} style={{ position: "absolute", inset: 0, width: "100%", opacity: settled }} />
      </div>
    </AbsoluteFill>
  );
}

const TILES = 8;
const COUNT_START = 14;
const COUNT_FRAMES = 96;

/** 3: sayaç artarken skor tablosu döner; sonuçlar maçın gerçek olasılıklarından çekilir. Simülasyon sayısı yalnız burada. */
export function HookScene({ script, scene }: SceneProps<"S03_HOOK">) {
  const frame = useCurrentFrame();
  const { home, away } = script.meta.teams;
  const { data } = scene;
  const accent = script.brand.accent;
  const shown = countUp(frame, { to: data.simulations, start: COUNT_START, duration: COUNT_FRAMES });
  const key = Math.floor(Math.min(frame, COUNT_START + COUNT_FRAMES) / 2);
  const homePhoto = photoOf(script, scene.assets.photoIds, "home");
  const awayPhoto = photoOf(script, scene.assets.photoIds, "away");
  const [left, right] = LAYOUTS.duel.slots;
  const winnerColor = { home: home.colors.primary, draw: COLORS.draw, away: away.colors.primary };
  const stats = [
    { label: home.shortName, color: home.colors.primary, value: data.wins.home },
    { label: "Beraberlik", color: COLORS.draw, value: data.wins.draw },
    { label: away.shortName, color: away.colors.primary, value: data.wins.away },
  ];
  return (
    <AbsoluteFill>
      <PhotoPair>
{homePhoto ? <Cutout photo={homePhoto} color={home.colors.primary} slot={left} fade={false} drift={12} /> : null}
      {awayPhoto ? <Cutout photo={awayPhoto} color={away.colors.primary} slot={right} fade={false} drift={-12} /> : null}
</PhotoPair>
      <Title line1={scene.headline?.line1 ?? ""} line2={scene.headline?.line2 ?? ""} accent={accent} />
      <Main height={380}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 18, height: 186 }}>
          <div style={heroNumber(180)}>{formatInt(shown)}</div>
          <div style={wordLabel()}>simülasyon</div>
        </div>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {Array.from({ length: TILES }, (_, index) => {
            const score = rollingScore(index * 1000 + key, data.wins);
            return (
              <Card key={index} name={`skor ${index + 1}`} edge={winnerColor[score.winner]} style={{ padding: "6px 0", alignItems: "center" }}>
                <div style={monoValue()}>{score.home}–{score.away}</div>
              </Card>
            );
          })}
        </div>
      </Main>
      <Strip>
        {stats.map((stat) => {
          const value = countUp(frame, { to: stat.value, start: COUNT_START, duration: COUNT_FRAMES });
          return (
            <Card key={stat.label} name={`kazanım ${stat.label}`} style={{ flex: 1, justifyContent: "center", gap: 6, padding: "10px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, ...teamName() }}><Swatch color={stat.color} />{stat.label}</div>
              <div style={monoValue(44)}>{formatInt(value)}</div>
              <Bar fraction={value / data.simulations} color={stat.color} height={10} />
            </Card>
          );
        })}
      </Strip>
    </AbsoluteFill>
  );
}
