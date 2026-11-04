import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Figures, Panel, PlayerCut, QuestionTitle, themeOf, titleBottom, useEnter } from "../design/kit";
import { BOTTOM, labelStyle, numberStyle, type Theme, W, X } from "../design/tokens";
import type { CompareRow, ReelScript } from "../schema";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

function DuelRow({ theme, row, index }: { theme: Theme; row: CompareRow; index: number }) {
  const enter = useEnter(40 + index * 6, 14);
  const value = (text: string, win: boolean, align: "left" | "right") => (
    <div style={{ width: 190, display: "flex", justifyContent: align === "left" ? "flex-start" : "flex-end" }}>
      <span data-support="" style={{ ...numberStyle(theme, 56), color: win ? theme.accentInk : theme.ink, background: win ? theme.accent : "transparent", padding: "1px 12px", borderRadius: theme.id === "A" ? 0 : theme.id === "C" ? 4 : 30, whiteSpace: "nowrap", boxShadow: win && theme.id === "C" ? `0 0 18px ${theme.accent}66` : undefined }}><Figures theme={theme} text={text} /></span>
    </div>
  );
  return (
    <div data-block={`satır ${row.label}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 86, borderBottom: `1.5px solid ${theme.panelEdge}`, ...enter }}>
      {value(row.home, row.better === "home", "left")}
      <div style={{ ...labelStyle(theme, 38), textAlign: "center", whiteSpace: "nowrap", color: theme.ink, flex: 1 }}>{row.label}</div>
      {value(row.away, row.better === "away", "right")}
    </div>
  );
}

const DUEL_PRIORITY = ["goals", "assists", "shots_on_target", "minutes", "shots", "key_passes", "appearances", "per90"] as const;

/** Düello: iki takımın yıldızı karşı karşıya, üstün taraf vurgulu. Kapsam etiketi ekranda; tahmin cümlesi yok. */
export function DuelScene({ script, scene }: { script: ReelScript; scene: { headline: { line1: string; line2: string } | null; data: { home: { name: string; team: string; logo: string }; away: { name: string; team: string; logo: string }; rows: CompareRow[]; scope: string } } }) {
  const theme = themeOf(script);
  const { data } = scene;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const homePhoto = script.photos["home-1"];
  const awayPhoto = script.photos["away-1"];
  const cutTop = titleBottom(theme, line1, line2) - 6;
  // Okunurluk: en çok 4 satır, öncelik sırasıyla. Bütün satırlar veride kalır.
  const rows = DUEL_PRIORITY.flatMap((key) => data.rows.filter((row) => row.key === key)).slice(0, 4);
  const rowsHeight = rows.length * 86 + 150;
  const nameStyle = { ...labelStyle(theme, 38), color: theme.ink, whiteSpace: "nowrap" as const, textTransform: theme.id === "A" ? "uppercase" as const : "none" as const };
  return (
    <AbsoluteFill>
      {homePhoto ? <PlayerCut theme={theme} photo={homePhoto} color={script.meta.teams.home.colors.primary} left={0} top={cutTop} height={520} fade /> : null}
      {awayPhoto ? <PlayerCut theme={theme} photo={awayPhoto} color={script.meta.teams.away.colors.primary} left={470} top={cutTop + 40} height={450} fade /> : null}
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top: BOTTOM - rowsHeight - 22 }}>
        <Panel theme={theme} name="düello tablosu" style={{ padding: "8px 16px 6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingBottom: 8, borderBottom: `3px solid ${theme.accent}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><Img src={staticFile(data.home.logo)} style={{ width: 42, height: 42 }} /><span style={nameStyle}>{data.home.name}</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}><span style={nameStyle}>{data.away.name}</span><Img src={staticFile(data.away.logo)} style={{ width: 42, height: 42 }} /></div>
          </div>
          {rows.map((row, index) => <DuelRow key={row.key} theme={theme} row={row} index={index} />)}
          <div data-label="" style={{ ...labelStyle(theme, 34), textAlign: "center", paddingTop: 8, whiteSpace: "nowrap" }}>{data.scope}</div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
}

/** Rakibine karşı: zaman şeridi + toplam + sezon ortalamasıyla kıyas. Başka kulüpteyken oynanan maçta kulüp adı ve arması görünür. */
export function VsOpponentScene({ script, scene }: { script: ReelScript; scene: { headline: { line1: string; line2: string } | null; data: { side: "home" | "away"; player: string; opponent: string; timeline: { date: string; club: string; clubLogo: string | null; otherClub: boolean; score: string; goals: number; assists: number }[]; totals: { matches: number; goals: number; assists: number }; per90: { opponent: string; season: string }; scope: string } } }) {
  const frame = useCurrentFrame();
  const theme = themeOf(script);
  const { data } = scene;
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const top = titleBottom(theme, line1, line2) + 12;
  return (
    <AbsoluteFill>
      <QuestionTitle theme={theme} line1={line1} line2={line2} />
      <div style={{ position: "absolute", left: X, width: W, top, bottom: 1920 - BOTTOM + 22, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12 }}>
        <div data-label="" style={{ ...labelStyle(theme, 36), color: theme.ink }}>{data.scope}</div>
        <Panel theme={theme} name="zaman şeridi" style={{ padding: "6px 16px" }}>
          {data.timeline.slice(-4).map((match, index) => (
            <div key={match.date} data-block={`maç ${match.date}`} style={{ display: "flex", alignItems: "center", gap: 12, height: 78, borderBottom: index === data.timeline.slice(-4).length - 1 ? "none" : `1.5px solid ${theme.panelEdge}`, opacity: interpolate(frame, [24 + index * 8, 32 + index * 8], [0, 1], clamp) }}>
              <div style={{ ...labelStyle(theme, 36), color: theme.ink2, width: 170, whiteSpace: "nowrap" }}>{match.date}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                {match.otherClub && match.clubLogo ? <Img src={staticFile(match.clubLogo)} style={{ width: 40, height: 40 }} /> : null}
                {match.otherClub ? <span style={{ ...labelStyle(theme, 34), whiteSpace: "nowrap" }}>{match.club}</span> : null}
              </div>
              <div style={{ ...numberStyle(theme, 44), color: theme.ink, width: 120, textAlign: "center", whiteSpace: "nowrap" }}>{match.score}</div>
              <div style={{ ...labelStyle(theme, 34), color: theme.ink, width: 130, textAlign: "right", whiteSpace: "nowrap" }}>{match.goals} G · {match.assists} A</div>
            </div>
          ))}
        </Panel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, flex: 1 }}>
          {[{ key: "goals", value: String(data.totals.goals), label: `Gol · ${data.totals.matches} maç` }, { key: "assists", value: String(data.totals.assists), label: "Asist" }, { key: "vs", value: data.per90.opponent, label: "Rakibe gol/90" }, { key: "season", value: data.per90.season, label: "Sezon gol/90" }].map((item) => (
            <div key={item.key} data-block={`toplam ${item.key}`} style={{ minWidth: 0, background: theme.panel, padding: "10px 14px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
              <div data-support="" style={{ ...numberStyle(theme, 62), color: theme.ink, whiteSpace: "nowrap" }}><Figures theme={theme} text={item.value} /></div>
              <div style={{ ...labelStyle(theme, 40), whiteSpace: "nowrap" }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Kapak: ilk kare tam dolu ve hareketsiz; akışta görünen kare aynı zamanda kapak görseli. */
export function StageCover({ script, scene }: { script: ReelScript; scene: { headline: { line1: string; line2: string } | null; data: { seriesLabel: string; league: string; round: string | null; dateLabel: string; venue: string | null } } }) {
  const theme = themeOf(script);
  const { data } = scene;
  const { home, away } = script.meta.teams;
  const homePhoto = script.photos["home-1"];
  const awayPhoto = script.photos["away-1"];
  const meta = [data.league, data.round].filter(Boolean).join(" · ");
  const line1 = scene.headline?.line1 ?? "";
  const line2 = scene.headline?.line2 ?? "";
  const series = theme.id === "A"
    ? { background: theme.accent, color: theme.accentInk, padding: "6px 18px", transform: "skewX(-10deg)", fontWeight: 900, textTransform: "uppercase" as const }
    : { color: theme.accent, border: `1.5px solid ${theme.panelEdge}`, padding: "4px 12px", borderRadius: 4 };
  if (theme.id === "B") {
    // Dergi kapağı: fotoğraf önde ve büyük, başlık altta fotoğrafın üstünde.
    const titleTop = BOTTOM - 410;
    return (
      <AbsoluteFill>
        {homePhoto ? <PlayerCut theme={theme} photo={homePhoto} color={home.colors.primary} left={-210} top={330} height={1240} /> : null}
        {awayPhoto ? <PlayerCut theme={theme} photo={awayPhoto} color={away.colors.primary} left={300} top={470} height={900} /> : null}
        <AbsoluteFill style={{ background: `linear-gradient(transparent ${titleTop - 190}px, rgba(8,6,3,0.93) ${titleTop - 10}px, rgba(8,6,3,0.93) ${BOTTOM + 30}px, transparent ${BOTTOM + 170}px)` }} />
        <QuestionTitle theme={theme} line1={line1} line2={line2} still top={titleTop} />
        <div style={{ position: "absolute", left: X, width: W, top: BOTTOM - 146, borderTop: `2px solid ${theme.panelEdge}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ ...labelStyle(theme, 34), color: theme.ink, whiteSpace: "nowrap" }}><span style={{ fontFamily: theme.display, fontStyle: "italic", color: theme.accent, fontWeight: 400 }}>{data.seriesLabel}</span> · {meta}</div>
          <div style={{ ...labelStyle(theme, 30), whiteSpace: "nowrap" }}>{data.dateLabel}{data.venue ? ` · ${data.venue}` : ""}</div>
        </div>
      </AbsoluteFill>
    );
  }
  if (theme.id === "D" || theme.id === "E") {
    // Poster: dev yeşil daire, kesimler önde, başlık üstte. Tahta: beyaz kenarlı mıknatıs kesimler, ortada çizgi.
    const poster = theme.id === "D";
    return (
      <AbsoluteFill>
        {poster ? <div data-fill="" style={{ position: "absolute", left: 90, top: 480, width: 900, height: 900, borderRadius: 450, background: theme.accent, opacity: 0.92 }} /> : <div style={{ position: "absolute", left: 90, top: 640, width: 400, height: 400, borderRadius: 200, border: `14px solid ${home.colors.primary}` }} />}
        {!poster ? <div style={{ position: "absolute", left: 560, top: 800, width: 340, height: 340, borderRadius: 170, border: `14px solid ${away.colors.primary}` }} /> : null}
        {awayPhoto ? <PlayerCut theme={theme} photo={awayPhoto} color={away.colors.primary} left={poster ? 400 : 430} top={poster ? 700 : 760} height={poster ? 700 : 560} /> : null}
        {homePhoto ? <PlayerCut theme={theme} photo={homePhoto} color={home.colors.primary} left={poster ? -110 : -60} top={poster ? 600 : 620} height={poster ? 860 : 680} /> : null}
        <QuestionTitle theme={theme} line1={line1} line2={line2} still />
        <div data-label="" style={{ position: "absolute", left: X, width: W, top: BOTTOM - 240 }}>
          <Panel theme={theme} name="künye" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span style={{ ...labelStyle(theme, 40), color: theme.ink, whiteSpace: "nowrap", textTransform: poster ? "uppercase" : "none" }}>{data.seriesLabel}</span>
              <span style={{ display: "flex", gap: 8 }}><Img src={staticFile(home.logo)} style={{ width: 54, height: 54 }} /><Img src={staticFile(away.logo)} style={{ width: 54, height: 54 }} /></span>
            </div>
            <div style={{ ...labelStyle(theme, 36), color: theme.ink, whiteSpace: "nowrap" }}>{meta}</div>
            <div style={{ ...labelStyle(theme, 34), whiteSpace: "nowrap" }}>{data.dateLabel}</div>
            {data.venue ? <div style={{ ...labelStyle(theme, 34), whiteSpace: "nowrap" }}>{data.venue}</div> : null}
          </Panel>
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      {homePhoto ? <PlayerCut theme={theme} photo={homePhoto} color={home.colors.primary} left={-130} top={theme.id === "C" ? 620 : 590} height={theme.id === "C" ? 800 : 1020} /> : null}
      {awayPhoto ? <PlayerCut theme={theme} photo={awayPhoto} color={away.colors.primary} left={theme.id === "C" ? 400 : 310} top={720} height={theme.id === "C" ? 600 : 760} /> : null}
      <QuestionTitle theme={theme} line1={line1} line2={line2} still />
      <div style={{ position: "absolute", left: X, width: W, top: BOTTOM - 214 }}>
        <Panel theme={theme} name="künye" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "14px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ ...labelStyle(theme, 38), whiteSpace: "nowrap", ...series }}>{data.seriesLabel}</span>
            <span style={{ display: "flex", gap: 8 }}><Img src={staticFile(home.logo)} style={{ width: 54, height: 54 }} /><Img src={staticFile(away.logo)} style={{ width: 54, height: 54 }} /></span>
          </div>
          <div style={{ ...labelStyle(theme, 36), color: theme.ink, whiteSpace: "nowrap" }}>{meta}</div>
          <div style={{ ...labelStyle(theme, 32), whiteSpace: "nowrap" }}>{data.dateLabel}{data.venue ? ` · ${data.venue}` : ""}</div>
        </Panel>
      </div>
    </AbsoluteFill>
  );
}
