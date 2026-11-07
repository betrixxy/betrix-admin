import { Img, interpolate, staticFile } from "remotion";
import { Dot, playerPoint } from "./Board";
import { Column, Header, INK, PANEL, box, labelFont, numberFont, reveal, upper } from "./parts";
import type { Beat, Side, TacticalScript } from "./types";
import { num, optText, text } from "./values";

/**
 * "Neden?" (puan durumu + iç saha / deplasman karnesi, en çok 2 madde, tek kaynak API-Football) ve "Yıldızların düellosu"
 * (iki forvetin noktası halkayla öne çıkar, onaylı kesimleri yükselir, 4 satırlık karşılaştırma). Paneller opak (`data-box`).
 * Sakat/cezalı oyuncu noktası grileşir (`Dot` → `player.out`); veri yoksa hiçbir nokta grileşmez.
 */

const appear = (local: number, at: number) => interpolate(local, [at, at + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

export function WhyOverlay({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  const rows = [
    { rank: num(beat, "homeRank"), team: script.home, points: num(beat, "homePoints") },
    { rank: num(beat, "awayRank"), team: script.away, points: num(beat, "awayPoints") },
  ].sort((a, b) => a.rank - b.rank);
  return (
    <Column>
      <Header tag={beat.tag} title={upper(beat.title)} />
      <div {...box("puan-durumu")} style={{ boxSizing: "border-box", background: PANEL, borderRadius: 14, padding: "10px 24px", display: "flex", flexDirection: "column" }}>
        {rows.map((row, index) => (
          <div key={row.rank} style={{ display: "flex", alignItems: "center", gap: 20, padding: "10px 0", borderTop: index ? "2px solid rgba(255,255,255,0.14)" : undefined, opacity: appear(local, index * 5) }}>
            <span style={{ ...numberFont, fontSize: 96, color: INK, width: 84 }}>{row.rank}.</span>
            <Img src={staticFile(row.team.logo)} style={{ width: 86, height: 86, objectFit: "contain" }} />
            <span style={{ ...labelFont, fontSize: 52, color: INK, flex: 1 }}>{upper(row.team.short)}</span>
            <span style={{ ...numberFont, fontSize: 96, color: INK }}>{row.points}</span>
            <span style={{ ...labelFont, fontSize: 36, color: "rgba(246,248,244,0.86)", marginTop: 26 }}>PUAN</span>
          </div>
        ))}
      </div>
      <div {...box("karne")} style={{ boxSizing: "border-box", background: PANEL, borderRadius: 14, padding: "14px 24px 12px", display: "flex", flexDirection: "column", gap: 10, ...reveal(appear(local, 14)) }}>
        {[text(beat, "homeRecord"), text(beat, "awayRecord")].map((line) => (
          <span key={line} style={{ ...labelFont, fontSize: 44, color: INK }}>{upper(line)}</span>
        ))}
      </div>
    </Column>
  );
}

function find(script: TacticalScript, side: Side, id: number) {
  return (side === "home" ? script.home : script.away).players.find((player) => player.id === id) ?? null;
}

/** İki forvet: takım renginde nabız halkası (ad, üst katmandaki başlıkta). Kadroda yoksa (kimlikle) hiçbir şey çizilmez. */
export function DuelBoard({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  const sides: [Side, number][] = [["home", num(beat, "homePlayerId")], ["away", num(beat, "awayPlayerId")]];
  return (
    <>
      {sides.map(([side, id]) => {
        const player = find(script, side, id);
        if (!player) return null;
        const team = side === "home" ? script.home : script.away;
        const { x, y } = playerPoint(player, side);
        const ring = 50 + ((local % 24) / 24) * 40;
        return (
          <div key={side}>
            <div style={{ position: "absolute", left: x - ring, top: y - ring, width: ring * 2, height: ring * 2, borderRadius: ring, border: `5px solid ${team.secondary}`, opacity: 1 - (local % 24) / 24, boxSizing: "border-box" }} />
            <Dot player={player} side={side} team={team} />
          </div>
        );
      })}
    </>
  );
}

function Cutout({ src, logo, color, local, delay, align }: { src: string; logo: string; color: string; local: number; delay: number; align: "left" | "right" }) {
  const rise = interpolate(local, [delay, delay + 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lift = 1 - (1 - rise) ** 3;
  return (
    <div style={{ position: "relative", width: 380, height: 380, display: "flex", justifyContent: align === "left" ? "flex-start" : "flex-end", alignItems: "flex-end", overflow: "hidden" }}>
      <div style={{ position: "absolute", bottom: 0, left: 20, right: 20, height: 120, borderRadius: "50%", background: `radial-gradient(ellipse at 50% 100%, ${color} 0%, rgba(0,0,0,0) 70%)`, opacity: 0.7 * rise }} />
      {src ? (
        <Img src={staticFile(src)} style={{ position: "relative", height: 380, objectFit: "contain", transform: `translateY(${(1 - lift) * 380}px)` }} />
      ) : (
        <Img src={staticFile(logo)} style={{ position: "relative", width: 220, height: 220, objectFit: "contain", marginBottom: 60, opacity: rise }} />
      )}
    </div>
  );
}

export function DuelOverlay({ script, beat, local }: { script: TacticalScript; beat: Beat; local: number }) {
  const rows = [
    { label: "GOL", home: String(num(beat, "goalsHome")), away: String(num(beat, "goalsAway")) },
    { label: "ASİST", home: String(num(beat, "assistsHome")), away: String(num(beat, "assistsAway")) },
    { label: "İSABETLİ ŞUT", home: String(num(beat, "shotsHome")), away: String(num(beat, "shotsAway")) },
    { label: "GOL+ASİST / 90 DK", home: text(beat, "per90Home"), away: text(beat, "per90Away") },
  ];
  return (
    <Column>
      <Header tag={beat.tag} title={upper(beat.title)} sub={upper(text(beat, "scope"))} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Cutout src={optText(beat, "homePhoto")} logo={script.home.logo} color={script.home.primary} local={local} delay={4} align="left" />
        <Cutout src={optText(beat, "awayPhoto")} logo={script.away.logo} color={script.away.primary} local={local} delay={8} align="right" />
      </div>
      <div {...box("düello-tablosu")} style={{ boxSizing: "border-box", background: PANEL, borderRadius: 14, padding: "6px 24px" }}>
        {rows.map((row, index) => (
          <div key={row.label} style={{ display: "flex", alignItems: "center", height: 62, borderTop: index ? "2px solid rgba(255,255,255,0.12)" : undefined, opacity: appear(local, 10 + index * 4) }}>
            <span style={{ ...numberFont, fontSize: 56, color: INK, width: 150 }}>{row.home}</span>
            <span style={{ ...labelFont, fontSize: 36, color: INK, flex: 1, textAlign: "center" }}>{row.label}</span>
            <span style={{ ...numberFont, fontSize: 56, color: INK, width: 150, textAlign: "right" }}>{row.away}</span>
          </div>
        ))}
      </div>
    </Column>
  );
}
