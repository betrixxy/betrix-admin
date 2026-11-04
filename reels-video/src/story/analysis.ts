import { formatDecimal, formatInt, FPS, seeded, spokenThousands } from "../lib/motion";
import type { ReelScene, ReelSceneType } from "../schema";
import { claim, claims, noteForScreen, noteLine, say, TEAM, type VoiceLine, voiceOf, type Voiceover } from "./claims";
import { checkBothScore, checkFirstGoal, checkGoals, checkOutcome } from "./market-checks";
import { type Absence, GOAL_SLOTS, type MatchContext } from "./match-context";
import type { MatchData, Side } from "./match-data";
import { slotWords, wordCount, WORDS_PER_SECOND } from "./speech";
import { inSquad } from "./squad";

/**
 * Futbol okuması sahneleri. Veri `MatchData.context`ten; yoksa sahne kapanır, boş kare çizilmez. Yorum cümleleri
 * `claim` ile kurulur: rakam kodla eklenir, veride olmayan taktik/oyuncu iddiası yazılmaz.
 */

type Entry = { type: ReelSceneType; scene: ReelScene; reason: null } | { type: ReelSceneType; scene: null; reason: string };
type Frames = Record<string, number>;

const NONE = { photoIds: [] as string[] };
const BOTH = { photoIds: ["home-1", "away-1"] };
const SIDES = ["home", "away"] as const;
const other = (side: Side): Side => (side === "home" ? "away" : "home");
const NO_CONTEXT = "Futbol okuması verisi yok (API-Football)";
const pct = (value: number) => Math.round(value * 100);
const key = (side: Side, path: string) => `context.teams.${side}.${path}`;
const dec = (value: number | null) => (value === null ? null : formatDecimal(value, 1));

const base = (frames: Frames, type: ReelSceneType, line1: string, line2: string, voiceover: Voiceover | null, assets = NONE) => ({ durationInFrames: frames[type] ?? 150, voiceover, headline: { line1, line2 }, caption: null, assets });
const on = (scene: ReelScene): Entry => ({ type: scene.type, scene, reason: null });
const off = (type: ReelSceneType, reason: string): Entry => ({ type, scene: null, reason });

/** Skorborddaki örnek skorlar: sonuç payları simülasyonla aynı, tek tek skor iddiası değildir. */
const WIN_SCORES = [[1, 0], [2, 0], [2, 1], [3, 1], [3, 0], [3, 2]] as const;
const DRAW_SCORES = [[0, 0], [1, 1], [2, 2]] as const;
export function sampleScores(outcome: MatchData["outcome"], count = 28): { home: number; away: number }[] {
  return Array.from({ length: count }, (_, index) => {
    const roll = seeded(index * 17 + 5);
    const pick = seeded(index * 29 + 11);
    if (roll < outcome.home_win) { const [a, b] = WIN_SCORES[Math.floor(pick * WIN_SCORES.length)] ?? [1, 0]; return { home: a, away: b }; }
    if (roll < outcome.home_win + outcome.draw) { const [a, b] = DRAW_SCORES[Math.floor(pick * DRAW_SCORES.length)] ?? [1, 1]; return { home: a, away: b }; }
    const [a, b] = WIN_SCORES[Math.floor(pick * WIN_SCORES.length)] ?? [1, 0];
    return { home: b, away: a };
  });
}

function monteCarlo(data: MatchData, frames: Frames): Entry {
  const simulations = data.model.simulations;
  if (simulations === null) return off("M02_MONTE_CARLO", "Simülasyon sayısı yok");
  const bad = checkOutcome(data.outcome);
  if (bad) return off("M02_MONTE_CARLO", bad);
  const { home_win: home, draw, away_win: away } = data.outcome;
  return on({
    type: "M02_MONTE_CARLO", ...base(frames, "M02_MONTE_CARLO", `Maçı ${spokenThousands(simulations)} kez`, "oynattık.", voiceOf([
      say(data, "mc.count", "Maçı {n} kez oynattık.", { n: { key: "model.simulations", format: "int" } }),
      say(data, "mc.result", "{home} {a}, {away} {b}, beraberlik {c}.", { home: TEAM.home, away: TEAM.away, a: { key: "outcome.home_win", format: "prob" }, b: { key: "outcome.away_win", format: "prob" }, c: { key: "outcome.draw", format: "prob" } }),
    ])),
    data: { simulations, shares: { home, draw, away }, final: { home: pct(home), draw: pct(draw), away: pct(away) }, samples: sampleScores(data.outcome) },
  });
}

function story(data: MatchData, ctx: MatchContext, frames: Frames): Entry {
  const { home, away } = ctx.standings;
  if (!home || !away) return off("C01_STORY", "Puan durumu yok");
  const behind: Side = home.points <= away.points ? "home" : "away";
  const gap = Math.abs(home.points - away.points);
  const table = (side: Side, path: string) => `context.standings.${side}.${path}`;
  const gapFact = { keys: [table("home", "points"), table("away", "points")], op: "diff", format: "int" } as const;
  const averages = { diffHome: { key: table("home", "goals_diff"), format: "int" }, diffAway: { key: table("away", "goals_diff"), format: "int" } } as const;
  const reasons = claims([
    gap > 0 && gap < 3
      ? claim(data, "story.stakes.close", "{gap} puan fark: {behind} kazanırsa öne geçiyor", { gap: gapFact, behind: TEAM[behind] })
      : gap === 0
        ? claim(data, "story.stakes.level", "Puanlar eşit, averaj {diffHome} ve {diffAway}", averages)
        : claim(data, "story.stakes.far", "{gap} puan fark: {behind} kapatmak istiyor", { gap: gapFact, behind: TEAM[behind] }),
  ]);
  const voiceover = voiceOf([
    say(data, "story.table", "{home} {r1}, {away} {r2} sırada.", { home: TEAM.home, away: TEAM.away, r1: { key: table("home", "rank"), format: "ordinal" }, r2: { key: table("away", "rank"), format: "ordinal" } }),
    gap === 0
      ? say(data, "story.level", "Puanlar eşit, kazanan öne geçiyor.", {}, [table("home", "points"), table("away", "points")])
      : gap < 3
        ? say(data, "story.close", "Aradaki {gap} puan: {behind} kazanırsa rakibini geçiyor.", { gap: gapFact, behind: TEAM[behind] })
        : say(data, "story.far", "Aradaki {gap} puan: {behind} için fark kapatma maçı.", { gap: gapFact, behind: TEAM[behind] }),
  ]);
  const line = (side: Side) => {
    const row = ctx.standings[side];
    return { rank: row?.rank ?? 0, points: row?.points ?? 0, played: row?.played ?? 0, goalsDiff: row?.goals_diff ?? 0 };
  };
  return on({ type: "C01_STORY", ...base(frames, "C01_STORY", "Maçın", "hikâyesi", voiceover, BOTH), data: { home: line("home"), away: line("away"), reasons } });
}

/** Ekranda takım başına: okunurluk için 2 satır, en büyük katkı önce. */
const ABSENCES_ON_SCREEN = 2;
const FORM_LETTER: Record<string, "G" | "B" | "M"> = { W: "G", D: "B", L: "M" };

function formAndStreaks(data: MatchData, ctx: MatchContext, frames: Frames): Entry {
  const block = (side: Side) => {
    const team = ctx.teams[side];
    if (!team.form || team.form.length < 3 || !team.venue) return null;
    // Sezon dizisinde en yeni sonda; ekranda en yeni başta.
    const last5 = [...team.form.slice(-5)].reverse().flatMap((letter) => FORM_LETTER[letter] ?? []);
    return { last5, venueLabel: side === "home" ? "İç saha" : "Deplasman", venue: { win: team.venue.win, draw: team.venue.draw, lose: team.venue.lose, goalsFor: team.venue.goals_for, goalsAgainst: team.venue.goals_against }, streaks: team.streaks };
  };
  const [home, away] = [block("home"), block("away")];
  if (!home || !away) return off("C02_FORM", "Form ya da iç/dış saha verisi eksik");
  const lead: Side = ctx.teams.home.streaks.wins >= ctx.teams.away.streaks.wins ? "home" : "away";
  const reasons = claims([
    ctx.teams.home.streaks.wins === ctx.teams.away.streaks.wins
      ? claim(data, "form.streak.same", "İkisinin de en uzun serisi {a} galibiyet", { a: { key: key("home", "streaks.wins"), format: "int" } })
      : claim(data, "form.streak", "{lead}: en uzun galibiyet serisi {a} maç", { lead: TEAM[lead], a: { key: key(lead, "streaks.wins"), format: "int" } }),
  ]);
  const voiceover = voiceOf([
    say(data, "form.streak", "En uzun seri {home} {a}, {away} {b} maç.", { home: TEAM.home, away: TEAM.away, a: { key: key("home", "streaks.wins"), format: "int" }, b: { key: key("away", "streaks.wins"), format: "int" } }),
    say(data, "form.venue", "{home} evinde {w} kazandı, {away} deplasmanda {x}.", { home: TEAM.home, away: TEAM.away, w: { key: key("home", "venue.win"), format: "int" }, x: { key: key("away", "venue.win"), format: "int" } }),
  ]);
  return on({ type: "C02_FORM", ...base(frames, "C02_FORM", "Form ve", "seriler", voiceover), data: { home, away, reasons } });
}

function absences(data: MatchData, ctx: MatchContext, frames: Frames): Entry {
  if (!ctx.absences) return off("C03_ABSENCES", "Eksik verisi okunamadı");
  if (data.players.squad_checked_at === null) return off("C03_ABSENCES", "Kadro doğrulanamadı");
  // Kadro kuralı: güncel kadroda olmayan oyuncu eksik listesine de girmez.
  const verified = (side: Side): (Absence & { index: number })[] => (ctx.absences?.[side] ?? []).map((item, index) => ({ ...item, index })).filter((item) => inSquad(data.players, side, item.player_id));
  const lists = { home: verified("home"), away: verified("away") };
  if (lists.home.length + lists.away.length === 0) return off("C03_ABSENCES", "Bildirilen eksik yok");
  const row = (item: Absence) => ({ name: item.name, status: item.status, minutes: item.minutes === null ? null : formatInt(item.minutes), goals: item.goals, assists: item.assists, share: item.involvement_pct === null ? null : `%${Math.round(item.involvement_pct)}` });
  const biggest = SIDES.flatMap((side) => lists[side].map((item) => ({ side, item }))).sort((a, b) => (b.item.involvement_pct ?? -1) - (a.item.involvement_pct ?? -1))[0];
  const path = biggest ? `context.absences.${biggest.side}.${biggest.item.index}` : "";
  const nameFact = { key: `${path}.name`, format: "text" } as const;
  const shareFact = { key: `${path}.involvement_pct`, format: "pct" } as const;
  const reasons = biggest ? claims([claim(data, "absence.biggest", "{name}: takım katkısında {share} pay", { name: nameFact, share: shareFact })]) : [];
  const voiceover = biggest
    ? voiceOf([say(data, "absence.biggest", "En büyük eksik {name}. Takımın gol ve asistlerindeki payı {share}.", { name: nameFact, share: shareFact })])
    : null;
  const count = { computed: lists.home.length + lists.away.length, from: ["context.absences.home", "context.absences.away"], format: "int" } as const;
  const fallback = voiceOf([say(data, "absence.count", "İki takımda toplam {n} eksik var.", { n: count })]);
  return on({ type: "C03_ABSENCES", ...base(frames, "C03_ABSENCES", "Kimler", "eksik?", voiceover ?? fallback), data: { home: lists.home.slice(0, ABSENCES_ON_SCREEN).map(row), away: lists.away.slice(0, ABSENCES_ON_SCREEN).map(row), reasons } });
}

function teamAnalysis(data: MatchData, ctx: MatchContext, side: Side, frames: Frames): Entry {
  const type = side === "home" ? "C04_TEAM_HOME" : "C05_TEAM_AWAY";
  const team = ctx.teams[side];
  const name = data.teams[side].short_name;
  if (team.goals_for_avg === null || team.goals_against_avg === null || !team.formation) return off(type, "Takım istatistiği eksik");
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
  return on({
    type, ...base(frames, type, name, "analizi", voiceOf([
      say(data, `team.${side}`, "{team} maçta {a} gol atıyor, {b} yiyor.", { team: TEAM[side], a: { key: key(side, "goals_for_avg"), format: "dec1" }, b: { key: key(side, "goals_against_avg"), format: "dec1" } }),
      say(data, `team.${side}.shape`, "Dizilişi {f}.", { f: { key: key(side, "formation.name"), format: "formation" } }),
    ]), { photoIds: [`${side}-1`] }),
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
      points: points.slice(0, 2),
    },
  });
}

function goalMinutes(data: MatchData, ctx: MatchContext, frames: Frames): Entry {
  const complete = (values: (number | null)[]): values is number[] => values.length === GOAL_SLOTS.length && values.every((value) => value !== null);
  const { home, away } = ctx.teams;
  if (![home.minutes.for, home.minutes.against, away.minutes.for, away.minutes.against].every(complete)) return off("C06_MINUTES", "Dakika dağılımı eksik");
  const peak = (values: (number | null)[]): number => values.reduce<number>((best, value, index) => ((value ?? 0) > (values[best] ?? 0) ? index : best), 0);
  const slotFact = (index: number) => ({ label: GOAL_SLOTS[index] ?? "", spoken: slotWords(GOAL_SLOTS[index] ?? "") });
  const homePeak = peak(home.minutes.for);
  const awayLeak = peak(away.minutes.against);
  const awayPeak = peak(away.minutes.for);
  const homeLeak = peak(home.minutes.against);
  const reasons = claims([
    claim(data, "minutes.home", "{home}: en çok {slot} arası, {n} gol", { home: TEAM.home, slot: slotFact(homePeak), n: { key: key("home", `minutes.for.${homePeak}`), format: "int" } }),
    awayLeak === awayPeak && homeLeak === homePeak ? null : claim(data, "minutes.away", "{away}: en çok {slot} arası, {n} gol", { away: TEAM.away, slot: slotFact(awayPeak), n: { key: key("away", `minutes.for.${awayPeak}`), format: "int" } }),
  ]);
  const voiceover = voiceOf([
    say(data, "minutes.home", "{home} en çok {slot} arasında atıyor: {n} gol.", { home: TEAM.home, slot: slotFact(homePeak), n: { key: key("home", `minutes.for.${homePeak}`), format: "int" } }),
    say(data, "minutes.away", "{away} aynı dilimde {m} yiyor.", { away: TEAM.away, m: { key: key("away", `minutes.against.${homePeak}`), format: "int" } }),
  ]);
  const row = (side: Side, kind: "for" | "against") => ({ side, label: kind === "for" ? "Attığı" : "Yediği", cells: ctx.teams[side].minutes[kind].map((value) => value ?? 0) });
  return on({ type: "C06_MINUTES", ...base(frames, "C06_MINUTES", "Goller hangi", "dakikalarda?", voiceover), data: { slots: [...GOAL_SLOTS], rows: [row("home", "for"), row("home", "against"), row("away", "for"), row("away", "against")], reasons } });
}

/** En belirgin fark: lig ortalamasına göre göreli en açık başlık. */
export function keyDifference(ctx: MatchContext): { path: string; label: string; format: "dec1" | "pct"; lowerIsBetter: boolean; leader: Side } | null {
  const METRICS = [
    { path: "goals_for_avg", label: "Maç başı gol", format: "dec1", lowerIsBetter: false },
    { path: "goals_against_avg", label: "Maç başı yenilen gol", format: "dec1", lowerIsBetter: true },
    { path: "xg_for_avg", label: "Maç başı xG", format: "dec1", lowerIsBetter: false },
    { path: "clean_sheet_pct", label: "Gol yememe payı", format: "pct", lowerIsBetter: false },
    { path: "failed_to_score_pct", label: "Gol atamama payı", format: "pct", lowerIsBetter: true },
  ] as const;
  const scored = METRICS.flatMap((metric) => {
    const [a, b] = [ctx.teams.home[metric.path], ctx.teams.away[metric.path]];
    if (a === null || b === null || Math.max(a, b) <= 0) return [];
    const gap = Math.abs(a - b) / Math.max(a, b);
    const leader: Side = (a > b) !== metric.lowerIsBetter ? "home" : "away";
    return [{ metric, gap, leader, equal: a === b }];
  }).filter((item) => !item.equal).sort((x, y) => y.gap - x.gap);
  const top = scored[0];
  return top && top.gap >= 0.1 ? { path: top.metric.path, label: top.metric.label, format: top.metric.format, lowerIsBetter: top.metric.lowerIsBetter, leader: top.leader } : null;
}

function matchKey(data: MatchData, ctx: MatchContext, frames: Frames): Entry {
  const found = keyDifference(ctx);
  if (!found) return off("C07_KEY", "İki takım arasında belirgin fark yok");
  const trail = other(found.leader);
  const [a, b] = [ctx.teams[found.leader][found.path as "goals_for_avg"], ctx.teams[trail][found.path as "goals_for_avg"]];
  if (a === null || b === null) return off("C07_KEY", "Fark verisi eksik");
  const show = (value: number) => (found.format === "pct" ? `%${Math.round(value)}` : formatDecimal(value, 1));
  const values = { a: { key: key(found.leader, found.path), format: found.format }, b: { key: key(trail, found.path), format: found.format } } as const;
  const reason = claim(data, "key.gap", "Maçın en açık farkı: {a} ile {b}", values);
  const voiceover = voiceOf([
    say(data, "key.gap", "En açık fark {metric}: {lead} {a}, {trail} {b}.", { metric: { label: found.label.toLocaleLowerCase("tr-TR") }, lead: TEAM[found.leader], trail: TEAM[trail], ...values }),
    data.analyst_note ? noteLine(data.analyst_note) : null,
  ]);
  return on({
    type: "C07_KEY", ...base(frames, "C07_KEY", "Maçın", "anahtarı", voiceover, { photoIds: [`${found.leader}-1`] }),
    data: { metric: found.label, leader: found.leader, leaderValue: show(a), otherValue: show(b), reasons: claims([reason]), analystNote: data.analyst_note ? noteForScreen(data.analyst_note) : null },
  });
}

function upset(data: MatchData, frames: Frames): Entry {
  const bad = checkOutcome(data.outcome) ?? checkFirstGoal(data.first_goal);
  if (bad) return off("C08_UPSET", bad);
  const favourite: Side = data.outcome.home_win >= data.outcome.away_win ? "home" : "away";
  const under = other(favourite);
  const win = under === "home" ? data.outcome.home_win : data.outcome.away_win;
  const first = data.first_goal[under];
  const back = data.comeback[under];
  if (first === null) return off("C08_UPSET", "İlk gol verisi yok");
  const name = data.teams[under].short_name;
  const reasons = claims([
    claim(data, "upset.first", "Önce gol: {under} için {first}", { under: TEAM[under], first: { key: `first_goal.${under}`, format: "prob" } }),
    back === null ? null : claim(data, "upset.back", "Geriden dönüş: {under} için {back}", { under: TEAM[under], back: { key: `comeback.${under}`, format: "prob" } }),
    claim(data, "upset.loss", "{fav} bu sezon {n} maç kaybetti", { fav: TEAM[favourite], n: { key: key(favourite, "loses"), format: "int" } }),
  ]);
  return on({
    type: "C08_UPSET", ...base(frames, "C08_UPSET", "Sürpriz", "senaryosu", voiceOf([
      say(data, "upset.hero", "{under} için sürpriz {p}.", { under: TEAM[under], p: { key: under === "home" ? "outcome.home_win" : "outcome.away_win", format: "prob" } }),
      say(data, "upset.first", "Yolu önce golü bulmak: {first}.", { first: { key: `first_goal.${under}`, format: "prob" } }),
      say(data, "upset.loss", "{fav} {n} maç kaybetti.", { fav: TEAM[favourite], n: { key: key(favourite, "loses"), format: "int" } }),
    ]), { photoIds: [`${under}-1`] }),
    data: { side: under, team: name, hero: { value: `%${pct(win)}`, percent: pct(win) }, reasons: reasons.slice(0, 3) },
  });
}

function scenario(data: MatchData, frames: Frames, readNote: boolean): Entry {
  const bad = checkOutcome(data.outcome);
  if (bad) return off("C09_SCENARIO", bad);
  const { home_win: home, away_win: away } = data.outcome;
  const lead: Side = home >= away ? "home" : "away";
  const leadKey = lead === "home" ? "outcome.home_win" : "outcome.away_win";
  const close = Math.abs(home - away) < 0.08;
  const three = data.goals.three_plus;
  const both = data.both_score;
  const items = claims([
    close
      ? claim(data, "scenario.close", "Dengeli: {home} {a}, {away} {b}", { home: TEAM.home, away: TEAM.away, a: { key: "outcome.home_win", format: "prob" }, b: { key: "outcome.away_win", format: "prob" } })
      : claim(data, "scenario.lead", "{lead} önde: kazanma ihtimali {p}", { lead: TEAM[lead], p: { key: leadKey, format: "prob" } }),
    checkGoals(data.goals) || three === null ? null : three >= 0.5
      ? claim(data, "scenario.goals.high", "Gollü maç: en az üç gol {p}", { p: { key: "goals.three_plus", format: "prob" } })
      : claim(data, "scenario.goals.low", "Az gollü: en az üç gol {p}", { p: { key: "goals.three_plus", format: "prob" } }),
    checkBothScore(data) || both === null ? null : both >= 0.5
      ? claim(data, "scenario.both.yes", "İki takım da gol bulur: {p}", { p: { key: "both_score", format: "prob" } })
      : claim(data, "scenario.both.no", "İki takım da gol: yalnız {p}", { p: { key: "both_score", format: "prob" } }),
    checkFirstGoal(data.first_goal) ? null : claim(data, "scenario.first", "İlk golde {lead} önde: {p}", { lead: TEAM[lead], p: { key: `first_goal.${lead}`, format: "prob" } }),
  ]).slice(0, 3);
  if (items.length < 3) return off("C09_SCENARIO", "Üç madde için veri yetersiz");
  // Sesli anlatım maddeleri izler; süreye sığmayan madde sesten düşer, ekranda kalır.
  const SPOKEN_BY_ID: Record<string, () => ReturnType<typeof say>> = {
    "scenario.close": () => say(data, "scenario.close", "Denge var: {home} {a}, {away} {b}.", { home: TEAM.home, away: TEAM.away, a: { key: "outcome.home_win", format: "prob" }, b: { key: "outcome.away_win", format: "prob" } }),
    "scenario.lead": () => say(data, "scenario.lead", "{lead} önde, {p}.", { lead: TEAM[lead], p: { key: leadKey, format: "prob" } }),
    "scenario.goals.high": () => say(data, "scenario.goals", "En az üç gol {p}.", { p: { key: "goals.three_plus", format: "prob" } }),
    "scenario.goals.low": () => say(data, "scenario.goals", "En az üç gol {p}.", { p: { key: "goals.three_plus", format: "prob" } }),
    "scenario.both.yes": () => say(data, "scenario.both", "İkisinin de golü {p}.", { p: { key: "both_score", format: "prob" } }),
    "scenario.both.no": () => say(data, "scenario.both", "İkisinin de golü {p}.", { p: { key: "both_score", format: "prob" } }),
    "scenario.first": () => say(data, "scenario.first", "İlk golde {lead} önde: {p}.", { lead: TEAM[lead], p: { key: `first_goal.${lead}`, format: "prob" } }),
  };
  const limit = Math.floor(((frames.C09_SCENARIO ?? 150) / FPS) * WORDS_PER_SECOND);
  const spoken: VoiceLine[] = [];
  for (const item of items) {
    const line = SPOKEN_BY_ID[item.id]?.();
    if (line && wordCount([...spoken.map((part) => part.text), line.text].join(" ")) <= limit) spoken.push(line);
  }
  const voiceover = voiceOf([...spoken, readNote && data.analyst_note ? noteLine(data.analyst_note) : null]);
  return on({ type: "C09_SCENARIO", ...base(frames, "C09_SCENARIO", "checkmatch", "senaryosu", voiceover, BOTH), data: { items, analystNote: data.analyst_note ? noteForScreen(data.analyst_note) : null } });
}

export function evaluateAnalysis(data: MatchData, frames: Frames, handle: string): Entry[] {
  const closeVoice = voiceOf([say(data, "close", "Sence kim kazanır, {home} ya da {away}? Yorumlara yaz, maçtan sonra bak.", { home: TEAM.home, away: TEAM.away })]);
  const close: Entry = on({ type: "S17_CLOSE", ...base(frames, "S17_CLOSE", "Sence kim", "kazanır?", closeVoice, BOTH), data: { options: [data.teams.home.short_name, "Beraberlik", data.teams.away.short_name], prompt: "Cevabını yorumlara yaz.", save: "Kaydet, maçtan sonra tekrar bak.", handle } });
  const ctx = data.context;
  const closedTypes = ["C01_STORY", "C02_FORM", "C03_ABSENCES", "C04_TEAM_HOME", "C05_TEAM_AWAY", "C06_MINUTES", "C07_KEY", "C08_UPSET"] as const;
  const key = ctx ? matchKey(data, ctx, frames) : off("C07_KEY", NO_CONTEXT);
  return [
    monteCarlo(data, frames),
    ...(ctx
      ? [story(data, ctx, frames), formAndStreaks(data, ctx, frames), absences(data, ctx, frames), teamAnalysis(data, ctx, "home", frames), teamAnalysis(data, ctx, "away", frames), goalMinutes(data, ctx, frames), key, upset(data, frames)]
      : closedTypes.map((type) => off(type, NO_CONTEXT))),
    // Tam analist notu bir kez okunur: anahtar kartı kapalıysa senaryo kartında.
    scenario(data, frames, key.scene === null),
    close,
  ];
}
