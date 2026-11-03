import { formatDecimal, splitDots } from "../lib/motion";
import type { QuestionData, QuestionSceneType, ReelScene } from "../schema";
import { barsFromLadder, checkBothScore, checkCards, checkCleanWin, checkComeback, checkComfort, checkCorners, checkDouble, checkFirstGoal, checkFirstHalfGoal, checkFirstHalfResult, checkGoals, checkHalves, checkOutcome, checkPenalty, checkTeamTwoPlus, ladderOf, winOf } from "./market-checks";
import type { MatchData, Side } from "./match-data";
import type { Reason } from "./claims";
import { bothScoreReasons, firstGoalReasons, goalsReasons } from "./reasons";
import { inSquad, squadFreshness } from "./squad";

/**
 * Market → soru. Web sitesindeki market burada bir soruya dönüşür; bahis dili kullanılmaz. Her sahne aynı şablondur:
 * soru başlığı + büyük ana rakam + 2–4 destek istatistiği. Veri eksik ya da şüpheliyse sahne kapanır ve nedenini döner.
 * Tek/çift gol gibi analiz değeri olmayan marketler bilerek yoktur.
 */

export type QuestionEntry = { type: QuestionSceneType; scene: Extract<ReelScene, { data: QuestionData }>; reason: null } | { type: QuestionSceneType; scene: null; reason: string };

const pct = (value: number): number => Math.round(value * 100);
const show = (value: number): string => `%${pct(value)}`;
const BOTH = { photoIds: ["home-1", "away-1"] };
const sideAssets = (side: Side | null) => (side ? { photoIds: [`${side}-1`] } : BOTH);

type Outcome3 = "home" | "draw" | "away";
const leaderOf = (values: Record<Outcome3, number>): Outcome3 => (["home", "draw", "away"] as const).reduce((best, key) => (values[key] > values[best] ? key : best), "home" as Outcome3);

/** 3 sonuçlu sahneler: en yüksek olan ana rakam, diğer ikisi destek. */
function threeWay(values: Record<Outcome3, number>, label: Record<Outcome3, string>, lead: (name: string) => string): Pick<QuestionData, "hero" | "supports"> & { leader: Outcome3 } {
  const leader = leaderOf(values);
  return {
    leader,
    hero: { value: show(values[leader]), percent: pct(values[leader]), label: lead(label[leader]), side: leader },
    supports: (["home", "draw", "away"] as const).filter((key) => key !== leader).map((key) => ({ key, value: show(values[key]), label: label[key], side: key })),
  };
}

export function evaluateQuestions(data: MatchData, options: { durations: Record<QuestionSceneType, number>; allowScorerScene?: boolean; now: Date }): QuestionEntry[] {
  const { home, away } = data.teams;
  const name = (side: Side) => data.teams[side].short_name;
  const other = (side: Side): Side => (side === "home" ? "away" : "home");
  const favourite: Side = data.outcome.home_win >= data.outcome.away_win ? "home" : "away";
  const underdog = other(favourite);
  const sideLabel: Record<Outcome3, string> = { home: home.short_name, draw: "Beraberlik", away: away.short_name };

  const on = (type: QuestionSceneType, line1: string, line2: string, question: Omit<QuestionData, "reasons"> & { reasons?: Reason[] }, assets = sideAssets(question.focus)): QuestionEntry =>
    ({ type, reason: null, scene: { type, durationInFrames: options.durations[type], headline: { line1, line2 }, caption: null, assets, data: { reasons: [], ...question } } as QuestionEntry extends { scene: infer S } ? Exclude<S, null> : never });
  const off = (type: QuestionSceneType, reason: string): QuestionEntry => ({ type, scene: null, reason });
  const guarded = (type: QuestionSceneType, reason: string | null, build: () => QuestionEntry): QuestionEntry => (reason ? off(type, reason) : build());
  const none = { kind: "none" as const };

  const xgSupport = (side: Side) => {
    const value = data.form[side].xg_for;
    return value === null ? [] : [{ key: `xg-${side}`, value: formatDecimal(value), label: `${name(side)} xG`, side }];
  };
  const q = (type: QuestionSceneType, reason: string | null, build: () => QuestionEntry): QuestionEntry => {
    if (data.model.simulations === null) return off(type, "Simülasyon sayısı yok");
    const entry = guarded(type, reason, build);
    // Şablon en az 2 destek ister: eksikse sahne boş kalmaz, kapanır.
    if (entry.scene && entry.scene.data.supports.length < 2) return off(type, "Destek istatistiği yetersiz");
    return entry;
  };

  const { outcome, goals, first_half: half } = data;
  const outcomeValues = { home: outcome.home_win, draw: outcome.draw, away: outcome.away_win };
  const ladder = ladderOf(goals);
  const distribution = goals.distribution;

  return [
    q("Q01_WINNER", checkOutcome(outcome), () => {
      const built = threeWay(outcomeValues, sideLabel, (label) => (label === "Beraberlik" ? "Beraberlik" : label));
      const [dotsHome = 0, dotsDraw = 0, dotsAway = 0] = splitDots([outcome.home_win, outcome.draw, outcome.away_win], 400);
      return on("Q01_WINNER", "Bu maçta", "kim kazanır?", { hero: built.hero, supports: [...built.supports, ...xgSupport(favourite)], viz: { kind: "dots", home: dotsHome, draw: dotsDraw, away: dotsAway }, focus: built.leader === "draw" ? favourite : built.leader }, BOTH);
    }),
    q("Q02_POINTS", checkDouble(data), () => {
      const value = underdog === "home" ? data.outcome_double?.home_or_draw ?? 0 : data.outcome_double?.draw_or_away ?? 0;
      return on("Q02_POINTS", name(underdog), "bu maçtan puanla çıkar mı?", {
        hero: { value: show(value), percent: pct(value), label: `${name(underdog)} puanla ayrılıyor`, side: underdog },
        supports: [{ key: "win", value: show(winOf(data, underdog)), label: "Galibiyet", side: underdog }, { key: "draw", value: show(outcome.draw), label: "Beraberlik", side: "draw" }, { key: "loss", value: show(winOf(data, favourite)), label: "Mağlubiyet", side: favourite }],
        viz: none, focus: underdog,
      });
    }),
    q("Q03_COMFORT", checkComfort(data, favourite), () => {
      const value = data.comfortable_win[favourite] ?? 0;
      const win = winOf(data, favourite);
      return on("Q03_COMFORT", "Rahat bir", "galibiyet mi?", {
        hero: { value: show(value), percent: pct(value), label: `${name(favourite)} 2+ farkla`, side: favourite },
        supports: [{ key: "win", value: show(win), label: "Toplam galibiyet", side: favourite }, { key: "narrow", value: show(Math.max(0, win - value)), label: "Tek farkla", side: favourite }],
        viz: none, focus: favourite,
      });
    }),
    q("Q04_GOALS", checkGoals(goals), () => {
      if (!ladder) return off("Q04_GOALS", "Gol merdiveni eksik");
      const barValues = distribution ?? barsFromLadder(ladder);
      const barLabels = distribution ? ["0", "1", "2", "3", "4", "5+"] : ["0–1", "2", "3", "4", "5+"];
      return on("Q04_GOALS", "Gollü", "maç mı?", {
        hero: { value: show(ladder.three_plus), percent: pct(ladder.three_plus), label: "3 ve üzeri gol", side: null },
        supports: [{ key: "2", value: show(ladder.two_plus), label: "2+", side: null }, { key: "4", value: show(ladder.four_plus), label: "4+", side: null }, { key: "5", value: show(ladder.five_plus), label: "5+", side: null }],
        viz: {
          kind: "ladder",
          steps: [{ label: "2+", percent: pct(ladder.two_plus) }, { label: "3+", percent: pct(ladder.three_plus) }, { label: "4+", percent: pct(ladder.four_plus) }, { label: "5+", percent: pct(ladder.five_plus) }],
          bars: barValues.map((value, index) => ({ label: barLabels[index] ?? "", percent: pct(value) })),
        },
        focus: favourite,
        reasons: goalsReasons(data).slice(0, 2),
      });
    }),
    q("Q05_BOTH_SCORE", checkBothScore(data), () => {
      const value = data.both_score ?? 0;
      const chance = data.team_goal_chance;
      return on("Q05_BOTH_SCORE", "İki takım da", "gol bulur mu?", {
        hero: { value: show(value), percent: pct(value), label: "İki takımın da gol bulma olasılığı", side: null },
        supports: chance
          ? [{ key: "home", value: show(chance.home), label: `${home.short_name} gol buluyor`, side: "home" }, { key: "away", value: show(chance.away), label: `${away.short_name} gol buluyor`, side: "away" }]
          : [...xgSupport("home"), ...xgSupport("away")],
        viz: none, focus: null,
        reasons: bothScoreReasons(data).slice(0, 2),
      });
    }),
    q("Q06_TEAM_GOALS", checkTeamTwoPlus(data, favourite), () => {
      const value = data.team_two_plus[favourite] ?? 0;
      const rival = data.team_two_plus[underdog];
      const average = data.form[favourite].goals_for;
      return on("Q06_TEAM_GOALS", name(favourite), "2 ve üzeri gol atar mı?", {
        hero: { value: show(value), percent: pct(value), label: `${name(favourite)} 2+ gol`, side: favourite },
        supports: [
          ...(rival === null ? [] : [{ key: "rival", value: show(rival), label: `${name(underdog)} 2+ gol`, side: underdog }]),
          ...(average === null ? [] : [{ key: "avg", value: formatDecimal(average), label: "Gol ortalaması", side: favourite }]),
          ...xgSupport(favourite),
        ],
        viz: none, focus: favourite,
      });
    }),
    q("Q07_CLEAN_WIN", checkCleanWin(data, favourite), () => {
      const value = data.clean_win[favourite] ?? 0;
      const rate = data.form[favourite].clean_sheet_rate;
      return on("Q07_CLEAN_WIN", `${name(favourite)} kalesini`, "gole kapatıp kazanır mı?", {
        hero: { value: show(value), percent: pct(value), label: "Gol yemeden galibiyet", side: favourite },
        supports: [{ key: "win", value: show(winOf(data, favourite)), label: "Toplam galibiyet", side: favourite }, ...(rate === null ? [] : [{ key: "rate", value: show(rate), label: "Gol yememe oranı", side: favourite }])],
        viz: none, focus: favourite,
      });
    }),
    q("Q08_HT_LEAD", checkFirstHalfResult(half), () => {
      const built = threeWay({ home: half.home ?? 0, draw: half.draw ?? 0, away: half.away ?? 0 }, sideLabel, (label) => label);
      return on("Q08_HT_LEAD", "İlk yarıda", "kim önde?", { hero: built.hero, supports: built.supports, viz: { kind: "split", parts: (["home", "draw", "away"] as const).map((key) => ({ label: sideLabel[key], percent: pct(half[key] ?? 0), side: key })) }, focus: built.leader === "draw" ? null : built.leader });
    }),
    q("Q09_HT_GOAL", checkFirstHalfGoal(half), () => {
      const value = half.any_goal ?? 0;
      return on("Q09_HT_GOAL", "İlk yarıda", "gol çıkar mı?", {
        hero: { value: show(value), percent: pct(value), label: "İlk yarıda gol", side: null },
        supports: [{ key: "none", value: show(1 - value), label: "Golsüz ilk yarı", side: null }, ...(half.two_plus === null ? [] : [{ key: "two", value: show(half.two_plus), label: "İlk yarıda 2+ gol", side: null }])],
        viz: none, focus: null,
      });
    }),
    q("Q10_HOT_HALF", checkHalves(data.half_most_goals), () => {
      const halves = data.half_most_goals ?? { first: 0, second: 0, equal: 0 };
      const entries = [{ key: "first", label: "İlk yarı", value: halves.first }, { key: "second", label: "İkinci yarı", value: halves.second }, { key: "equal", label: "Eşit", value: halves.equal }];
      const top = entries.reduce((best, item) => (item.value > best.value ? item : best));
      return on("Q10_HOT_HALF", "Goller hangi", "yarıda gelir?", {
        hero: { value: show(top.value), percent: pct(top.value), label: top.label, side: null },
        supports: entries.filter((item) => item !== top).map((item) => ({ key: item.key, value: show(item.value), label: item.label, side: null })),
        viz: { kind: "split", parts: entries.map((item) => ({ label: item.label, percent: pct(item.value), side: null })) }, focus: null,
      });
    }),
    q("Q11_COMEBACK", checkComeback(data), () => {
      const [homeBack, awayBack] = [data.comeback.home ?? 0, data.comeback.away ?? 0];
      const lead: Side = homeBack >= awayBack ? "home" : "away";
      const leadValue = Math.max(homeBack, awayBack);
      return on("Q11_COMEBACK", "Geriden gelip", "kazanma senaryosu", {
        hero: { value: show(leadValue), percent: pct(leadValue), label: `${name(lead)} geri dönüyor`, side: lead },
        supports: [{ key: "other", value: show(Math.min(homeBack, awayBack)), label: `${name(other(lead))} geri dönüyor`, side: other(lead) }, { key: "win", value: show(winOf(data, lead)), label: `${name(lead)} galibiyeti`, side: lead }],
        viz: none, focus: lead,
      });
    }),
    q("Q12_FIRST_GOAL", checkFirstGoal(data.first_goal), () => {
      const first = data.first_goal;
      const [homeFirst, awayFirst, noGoal] = [first.home ?? 0, first.away ?? 0, first.none ?? 0];
      const lead: Side = homeFirst >= awayFirst ? "home" : "away";
      const leadValue = Math.max(homeFirst, awayFirst);
      return on("Q12_FIRST_GOAL", "İlk gol", "kimden?", {
        hero: { value: show(leadValue), percent: pct(leadValue), label: name(lead), side: lead },
        supports: [{ key: "other", value: show(Math.min(homeFirst, awayFirst)), label: name(other(lead)), side: other(lead) }, { key: "none", value: show(noGoal), label: "Hiç gol yok", side: null }],
        viz: { kind: "split", parts: [{ label: home.short_name, percent: pct(homeFirst), side: "home" }, { label: "Gol yok", percent: pct(noGoal), side: null }, { label: away.short_name, percent: pct(awayFirst), side: "away" }] }, focus: lead,
        reasons: firstGoalReasons(data).slice(0, 2),
      });
    }),
    q("Q13_PRESSURE", checkCorners(data.corners), () => {
      const more = data.corners.more ?? { home: 0, away: 0, equal: 0 };
      const lead: Side = more.home >= more.away ? "home" : "away";
      const leadValue = Math.max(more.home, more.away);
      const ten = data.corners.ten_plus;
      return on("Q13_PRESSURE", "Baskı", "kimde?", {
        hero: { value: show(leadValue), percent: pct(leadValue), label: `${name(lead)} daha çok korner`, side: lead },
        supports: [{ key: "other", value: show(Math.min(more.home, more.away)), label: name(other(lead)), side: other(lead) }, { key: "equal", value: show(more.equal), label: "Eşit", side: null }, ...(ten === null ? [] : [{ key: "ten", value: show(ten), label: "Maçta 10+ korner", side: null }])],
        viz: none, focus: lead,
      });
    }),
    q("Q14_CARDS", checkCards(data.cards), () => {
      const { four_plus: four, five_plus: five, six_plus: six, red_card: red } = data.cards;
      return on("Q14_CARDS", "Sert bir", "maç mı?", {
        hero: { value: show(four ?? 0), percent: pct(four ?? 0), label: "4 ve üzeri kart", side: null },
        supports: [{ key: "5", value: show(five ?? 0), label: "5+ kart", side: null }, { key: "6", value: show(six ?? 0), label: "6+ kart", side: null }, ...(red === null ? [] : [{ key: "red", value: show(red), label: "Kırmızı kart", side: null }])],
        viz: none, focus: null,
      });
    }),
    q("Q15_PENALTY", checkPenalty(data.penalty), () => {
      const value = data.penalty ?? 0;
      return on("Q15_PENALTY", "Penaltı çıkma", "ihtimali", {
        hero: { value: show(value), percent: pct(value), label: "Maçta penaltı", side: null },
        supports: [...xgSupport("home"), ...xgSupport("away"), ...(data.cards.red_card === null ? [] : [{ key: "red", value: show(data.cards.red_card), label: "Kırmızı kart", side: null }])],
        viz: none, focus: null,
      });
    }),
    q("Q16_SCORE", !data.score_scene_allowed ? "Skor dağılımı diğer sahnelerle çelişiyor" : data.score_distribution.length < 3 ? "Skor dağılımı yetersiz" : null, () => {
      const [top, ...rest] = [...data.score_distribution].sort((a, b) => b.p - a.p);
      const label = (cell: { home_goals: number; away_goals: number }) => `${cell.home_goals}–${cell.away_goals}`;
      if (!top) return off("Q16_SCORE", "Skor dağılımı yetersiz");
      return on("Q16_SCORE", "En olası", "skor", {
        hero: { value: label(top), percent: null, label: `Tek başına ${show(top.p)}`, side: null },
        supports: rest.slice(0, 4).map((cell) => ({ key: label(cell), value: show(cell.p), label: label(cell), side: null })),
        viz: none, focus: null,
      });
    }),
    q("Q17_SCORER", !options.allowScorerScene ? "Golcü modeli düzeltilene kadar kapalı" : squadFreshness(data.players.squad_checked_at, options.now), () => {
      const verified = data.scorer_chances.filter((item) => inSquad(data.players, item.side, item.player_id)).sort((a, b) => b.p - a.p);
      const [top, ...rest] = verified;
      if (!top || rest.length < 2) return off("Q17_SCORER", "Kadrosu doğrulanan yeterli oyuncu yok");
      return on("Q17_SCORER", "Golü", "kim atar?", {
        hero: { value: show(top.p), percent: pct(top.p), label: top.name, side: top.side },
        supports: rest.slice(0, 3).map((item) => ({ key: String(item.player_id), value: show(item.p), label: item.name, side: item.side })),
        viz: none, focus: top.side,
      });
    }),
  ];
}
