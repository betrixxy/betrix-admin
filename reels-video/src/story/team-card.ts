import { FPS } from "../lib/motion";
import { type LineupChange, type ReelLineupPlayer, type ResolvedLineup, resolveLineup } from "../../../src/lib/reels/lineup-rule";
import { claim, say, TEAM, type VoiceLine, voiceOf } from "./claims";
import { base, dec, type Entry, type Frames, key, off, on } from "./entry";
import type { MatchContext } from "./match-context";
import type { MatchData, Side } from "./match-data";
import { wordCount, WORDS_PER_SECOND } from "./speech";
import { inSquad } from "./squad";

/** Takım analizi kartı: üç değer, Muhtemel 11 tahtası, iki madde. Tahtadaki güçlü/zayıf yön lig ortalamasıyla kıyastır. */

export const SOURCE_LABELS = { full: "Son maçın ilk 11'i ve eksikler esas alındı", lastOnly: "Son maçın ilk 11'i esas alındı", editor: "checkmatch editörü" } as const;
/** Lig ortalamasından bu kadar ayrılmıyorsa tahtaya yön çizilmez. */
const EDGE_MIN = 0.1;

/** Pul altındaki ad: dar sütuna sığsın diye uzun adda baş harf düşer. */
export const puckName = (player: ReelLineupPlayer): string => (player.short_name.length > 10 ? player.short_name.replace(/^\p{L}\.\s*/u, "") : player.short_name);

export function teamLineup(data: MatchData, ctx: MatchContext, side: Side): ResolvedLineup | null {
  if (data.players.squad_checked_at === null) return null;
  const absent = (ctx.absences?.[side] ?? []).filter((item) => item.status !== "doubtful" && inSquad(data.players, side, item.player_id)).map((item) => ({ id: item.player_id, name: item.name }));
  return resolveLineup({ last: ctx.teams[side].lineup, edit: data.lineup_edits?.[side] ?? null, absent, inSquad: (id) => inSquad(data.players, side, id) });
}

const edge = (value: number): "strong" | "weak" | null => (value >= EDGE_MIN ? "strong" : value <= -EDGE_MIN ? "weak" : null);

/** Kilit değişiklik cümlesi: yalnız veride olan. Yer boşsa kim oynayacağı söylenmez. */
function changeLine(data: MatchData, side: Side, change: LineupChange, from: string): VoiceLine | null {
  const out = { label: change.out.name };
  const zone = { label: change.zone };
  return change.in
    ? say(data, `team.${side}.change`, "{out} yok, {zone} için {who} bekleniyor.", { out, zone, who: { label: change.in.name } }, [from])
    : say(data, `team.${side}.change`, "{out} yok, {zone} yeri belirsiz.", { out, zone }, [from]);
}

export function teamAnalysis(data: MatchData, ctx: MatchContext, side: Side, frames: Frames): Entry {
  const type = side === "home" ? "C04_TEAM_HOME" : "C05_TEAM_AWAY";
  const team = ctx.teams[side];
  const name = data.teams[side].short_name;
  const lineup = teamLineup(data, ctx, side);
  if (team.goals_for_avg === null || team.goals_against_avg === null || (!lineup && !team.formation)) return off(type, "Takım istatistiği eksik");
  const league = ctx.standings.league_goals_avg;
  const leagueFact = { key: "context.standings.league_goals_avg", format: "dec1" } as const;
  const attack = claim(data, `team.${side}.attack`, "Hücum: maçta {v} gol, lig {l}", { v: { key: key(side, "goals_for_avg"), format: "dec1" }, l: leagueFact });
  const defence = claim(data, `team.${side}.defence`, "Savunma: maçta {v} gol yiyor, lig {l}", { v: { key: key(side, "goals_against_avg"), format: "dec1" }, l: leagueFact });
  const fail = claim(data, `team.${side}.fail`, "Maçların {v} gol bulamadı", { v: { key: key(side, "failed_to_score_pct"), format: "pctIn" } });
  const clean = claim(data, `team.${side}.clean`, "Maçların {v} gol yemedi", { v: { key: key(side, "clean_sheet_pct"), format: "pctIn" } });
  if (league === null) return off(type, "Lig ortalaması yok");
  // Lig ortalamasıyla kıyas: ortalamadan iyi olan güçlü, kötü olan zayıf. İkisi de aynı tarafta kalırsa diğer ölçü devreye girer.
  const attackEdge = team.goals_for_avg - league;
  const defenceEdge = league - team.goals_against_avg;
  const [strong, weak] = attackEdge >= defenceEdge ? [attack, defence] : [defence, attack];
  const strongEdge = Math.max(attackEdge, defenceEdge);
  const weakEdge = Math.min(attackEdge, defenceEdge);
  const points = [
    ...(strong && strongEdge >= 0 ? [{ label: "Güçlü", reason: strong }] : []),
    ...(weak && weakEdge < 0 ? [{ label: "Zayıf", reason: weak }] : []),
  ];
  if (points.length < 2 && clean && fail) points.push({ label: "Dikkat", reason: strongEdge < 0 ? clean : fail });
  if (points.length < 2) return off(type, "Yorum için veri yetersiz");

  const edited = lineup?.source === "editor";
  const formationKey = edited ? `lineup_edits.${side}.formation` : lineup ? key(side, "lineup.formation") : key(side, "formation.name");
  const shape = say(data, `team.${side}.shape`, "{team} {f}.", { team: TEAM[side], f: { key: formationKey, format: "formation" } });
  const firstChange = lineup?.changes[0];
  const change = firstChange ? changeLine(data, side, firstChange, edited ? `lineup_edits.${side}.players` : key(side, "lineup.players")) : null;
  const stats = say(data, `team.${side}`, "Maçta {a} gol atıyor, {b} yiyor.", { a: { key: key(side, "goals_for_avg"), format: "dec1" }, b: { key: key(side, "goals_against_avg"), format: "dec1" } });
  // Süreye sığan cümleler okunur; önce diziliş ve kilit değişiklik.
  const limit = Math.floor(((frames[type] ?? 180) / FPS) * WORDS_PER_SECOND);
  const spoken: VoiceLine[] = [];
  for (const line of [shape, change, stats]) {
    if (line && wordCount([...spoken.map((part) => part.text), line.text].join(" ")) <= limit) spoken.push(line);
  }
  return on({
    type, ...base(frames, type, name, "analizi", voiceOf(spoken), { photoIds: [`${side}-1`] }),
    data: {
      side,
      stats: [
        { key: "for", value: dec(team.goals_for_avg) ?? "", label: "Attığı/maç" },
        { key: "against", value: dec(team.goals_against_avg) ?? "", label: "Yediği/maç" },
        ...(team.xg_for_avg === null ? [] : [{ key: "xg", value: dec(team.xg_for_avg) ?? "", label: "xG/maç" }]),
        ...(team.clean_sheet_pct === null ? [] : [{ key: "clean", value: `%${Math.round(team.clean_sheet_pct)}`, label: "Gol yememe" }]),
        ...(team.failed_to_score_pct === null ? [] : [{ key: "fail", value: `%${Math.round(team.failed_to_score_pct)}`, label: "Gol atamama" }]),
      ],
      formation: team.formation,
      lineup: lineup && {
        formation: lineup.formation,
        source: lineup.source,
        sourceLabel: edited ? SOURCE_LABELS.editor : ctx.absences ? SOURCE_LABELS.full : SOURCE_LABELS.lastOnly,
        slots: lineup.slots.map((slot) => ({ line: slot.line, index: slot.index, lineSize: slot.line_size, number: slot.player?.number === null || slot.player === null ? null : String(slot.player.number), name: slot.player ? puckName(slot.player) : null })),
      },
      board: { attack: edge(attackEdge), defence: edge(defenceEdge) },
      points: points.slice(0, 2),
    },
  });
}
