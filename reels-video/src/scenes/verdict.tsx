import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { BOARD_GROUND, BoardPanel, ChalkArrow, HandLabel, inkOn, Magnet } from "../design/board";
import { Figures, HeroFigure, Panel, PlayerCut, QuestionTitle, themeOf, titleBottom, useEnter } from "../design/kit";
import { BOTTOM, labelStyle, numberStyle, type Theme, W, X } from "../design/tokens";
import { countUp } from "../lib/motion";
import type { SceneProps } from "./common";
import { ReasonList } from "./reason-list";

/** Yorum kartları: maçın anahtarı, sürpriz senaryosu, checkmatch senaryosu, kapanış. */

const Area = ({ top, children }: { top: number; children: React.ReactNode }) => (
  <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>{children}</div>
);

/** Kullanıcının kendi notu: varsa veri yorumunun yerine geçer, kaynağı açıkça "Analist notu" yazar. */
function AnalystNote({ theme, text }: { theme: Theme; text: string }) {
  const enter = useEnter(56, 14);
  return (
    <Panel theme={theme} name="analist notu" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "14px 18px", ...enter }}>
      <div style={{ ...labelStyle(theme, 36), color: theme.accentText, fontWeight: 800 }}>Analist notu</div>
      <div data-note="" style={{ ...labelStyle(theme, 40), color: theme.ink, lineHeight: 1.14 }}>{text}</div>
    </Panel>
  );
}

export function KeyScene({ script, scene }: SceneProps<"C07_KEY">) {
  const frame = useCurrentFrame();
  const theme = themeOf(script);
  const { data } = scene;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const lead = script.meta.teams[data.leader];
  const trail = script.meta.teams[data.leader === "home" ? "away" : "home"];
  // Lider kutusu genişliğin 3/5'i (eksi boşluk ve iç pay). "%40" gibi değer 190 px'te taşıyordu (GS–Amed, 11-06): yazı kutuya
  // sığacak kadar küçülür, glif başına ≈ 0,86 em. Ana rakam alt sınırı (160 px) okunurluk denetiminde.
  const heroSize = Math.min(190, Math.floor(((W - 12) * 0.6 - 36) / (Math.max(1, data.leaderValue.length) * 0.86)));
  const boardHeight = 360;
  const shown = frame < 20 ? "" : data.leaderValue;
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <Area top={titleBottom(theme, line1, line2) + 12}>
        <div style={{ ...labelStyle(theme, 44), color: theme.ink, whiteSpace: "nowrap" }}>{data.metric}</div>
        <div style={{ display: "flex", gap: 12 }}>
          <div data-block={`lider ${lead.shortName}`} style={{ flex: 3, minWidth: 0, background: theme.accent, padding: "12px 18px", borderRadius: theme.id === "E" ? 20 : 0 }}>
            <div style={{ ...labelStyle(theme, 34), color: theme.accentInk, whiteSpace: "nowrap" }}>{lead.shortName}</div>
            <div data-hero="" style={{ ...numberStyle(theme, heroSize), color: theme.accentInk, whiteSpace: "nowrap", minHeight: heroSize }}><Figures theme={theme} text={shown} /></div>
          </div>
          <div data-block={`rakip ${trail.shortName}`} style={{ flex: 2, minWidth: 0, background: theme.panel, padding: "12px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between", borderRadius: theme.id === "E" ? 20 : 0 }}>
            <div style={{ ...labelStyle(theme, 34), color: theme.ink, whiteSpace: "nowrap" }}>{trail.shortName}</div>
            <div data-support="" style={{ ...numberStyle(theme, 110), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={data.otherValue} /></div>
          </div>
        </div>
        <BoardPanel name="anahtar tahtası" width={W} height={boardHeight}>
          {/* Hücum farkı: lider rakip kaleye gider. Savunma farkı: rakip gelir, liderin kalesi vurgulu. */}
          <div style={{ position: "absolute", top: boardHeight * 0.2, height: boardHeight * 0.6, width: 150, ...(data.focus === "attack" ? { right: 0 } : { left: 0 }), background: "rgba(46,165,55,0.34)" }} />
          <svg data-fill="" width={W} height={boardHeight} viewBox={`0 0 ${W} ${boardHeight}`} style={{ position: "absolute", left: 0, top: 0 }}>
            <Magnet x={130} y={boardHeight / 2} r={90} color={lead.colors.primary} logo={lead.logo} />
            <Magnet x={W - 130} y={boardHeight / 2} r={90} color={trail.colors.primary} logo={trail.logo} />
          </svg>
          <ChalkArrow width={W} height={boardHeight} from={data.focus === "attack" ? [240, boardHeight / 2 + 30] : [W - 240, boardHeight / 2 + 30]} to={data.focus === "attack" ? [W - 240, boardHeight / 2 + 30] : [240, boardHeight / 2 + 30]} bend={60} color={theme.accentText} start={30} name="anahtar" />
          <HandLabel theme={theme} text={data.focus === "attack" ? "Hücumda fark" : "Savunmada fark"} size={60} style={{ left: data.focus === "attack" ? 40 : W / 2 + 24, top: 18 }} />
        </BoardPanel>
        {data.analystNote ? <AnalystNote theme={theme} text={data.analystNote} /> : <ReasonList theme={theme} items={data.reasons} start={48} size={44} />}
      </Area>
    </AbsoluteFill>
  );
}

const UPSET_BOARD = 560;
const UPSET_STEP = 152;

export function UpsetScene({ script, scene }: SceneProps<"C08_UPSET">) {
  const theme = themeOf(script);
  const { data } = scene;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const team = script.meta.teams[data.side];
  const photo = script.photos[`${data.side}-1`];
  return (
    <AbsoluteFill>
      {photo ? <PlayerCut theme={theme} photo={photo} color={team.colors.primary} left={540} top={titleBottom(theme, line1, line2) + 4} height={480} /> : null}
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <Area top={titleBottom(theme, line1, line2) + 12}>
        <HeroFigure theme={theme} value={data.hero.value} percent={data.hero.percent} label={`${data.team} kazanırsa`} color={team.colors.primary} size={Math.min(theme.heroSize, 220)} />
        <BoardPanel name="sürpriz yolu" width={W} height={UPSET_BOARD} style={{ height: UPSET_BOARD }}>
          <HandLabel theme={theme} text="Sürpriz yolu" size={62} style={{ left: 24, top: 14 }} />
          {data.reasons.map((reason, index) => {
            const y = 96 + index * UPSET_STEP;
            return (
              <div key={reason.id}>
                <div style={{ ...numberStyle(theme, 40), position: "absolute", left: 22, top: y, width: 68, height: 68, borderRadius: 34, display: "flex", alignItems: "center", justifyContent: "center", background: team.colors.primary, color: inkOn(team.colors.primary), border: "4px solid #F4F6EF" }}>{index + 1}</div>
                <div data-bullet="" style={{ ...labelStyle(theme, 44), position: "absolute", left: 108, right: 14, top: y - 4, color: theme.ink, lineHeight: 1.1, background: BOARD_GROUND, padding: "6px 10px" }}>{reason.text}</div>
                {index < data.reasons.length - 1 ? <ChalkArrow width={W} height={UPSET_BOARD} from={[56, y + 76]} to={[56, y + UPSET_STEP - 8]} color={theme.accentText} start={30 + index * 14} name={`surpriz-${index}`} /> : null}
              </div>
            );
          })}
        </BoardPanel>
      </Area>
    </AbsoluteFill>
  );
}

function ScenarioItem({ theme, text, index }: { theme: Theme; text: string; index: number }) {
  const enter = useEnter(18 + index * 18, 16);
  return (
    <div data-block={`madde ${index + 1}`} style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, background: theme.panel, padding: "14px 18px", borderRadius: theme.id === "E" ? 20 : 0, ...enter }}>
      <span data-support="" style={{ ...numberStyle(theme, 72), color: theme.accentInk, background: theme.accent, width: 96, height: 96, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: theme.id === "E" ? 48 : 0 }}>{index + 1}</span>
      <span data-bullet="" style={{ ...labelStyle(theme, 46), color: theme.ink, lineHeight: 1.12 }}>{text}</span>
    </div>
  );
}

export function ScenarioScene({ script, scene }: SceneProps<"C09_SCENARIO">) {
  const theme = themeOf(script);
  const { data } = scene;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <Area top={titleBottom(theme, line1, line2) + 12}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {data.items.map((item, index) => <ScenarioItem key={item.id} theme={theme} text={item.text} index={index} />)}
        </div>
        {data.analystNote ? <AnalystNote theme={theme} text={data.analystNote} /> : null}
      </Area>
    </AbsoluteFill>
  );
}

/** Kapanış: anket, kaydet, hesap. Takım adları seçenek; sayı ya da işaret yok. */
export function CloseScene({ script, scene }: SceneProps<"S17_CLOSE">) {
  const frame = useCurrentFrame();
  const theme = themeOf(script);
  const { data } = scene;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const lit = countUp(frame, { to: data.options.length, start: 10, duration: 24 });
  const logos = [script.meta.teams.home.logo, null, script.meta.teams.away.logo];
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <Area top={titleBottom(theme, line1, line2) + 12}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {data.options.map((option, index) => {
            const logo = logos[index];
            return (
              <div key={option} data-block={`seçenek ${option}`} style={{ flex: 1, display: "flex", alignItems: "center", gap: 14, padding: "0 20px", background: theme.panel, border: `3px solid ${index < lit ? theme.accent : theme.panelEdge}`, borderRadius: theme.id === "E" ? 56 : 0 }}>
                {logo ? <Img src={staticFile(logo)} style={{ width: 96, height: 96 }} /> : null}
                <span style={{ ...labelStyle(theme, 64), color: theme.ink, whiteSpace: "nowrap", textTransform: theme.titleUpper ? "uppercase" : "none" }}>{option}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ ...labelStyle(theme, 42), color: theme.ink }}>{data.prompt}</div>
          <div style={{ ...labelStyle(theme, 40) }}>{data.save}</div>
          <div style={{ ...labelStyle(theme, 40), color: theme.accentText, fontWeight: 800 }}>{data.handle}</div>
        </div>
      </Area>
    </AbsoluteFill>
  );
}
