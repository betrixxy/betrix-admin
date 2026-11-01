import { formatInt, ofTen, splitDots, spokenThousands } from "../lib/motion";
import type { ReelPhoto, ReelScene, ReelSceneType, ReelScript } from "../schema";
import type { MatchData } from "./match-data";
import { decideTrackRecord } from "./track-record";
import { compareMetrics, compareRows, effectiveFatigue, formLetters, outcomeLeader, pickKeyGap } from "./metrics";

/**
 * Sahne havuzu: her sahne veriyi kendi denetler. Eksikse devre dışı kalır ve nedenini döner; asla boş ya da sıfırlı
 * kare çizilmez. Hikâye açısı havuzdan 12–14 sahne seçer.
 */

export type PoolEntry = { type: ReelSceneType; scene: ReelScene; reason: null } | { type: ReelSceneType; scene: null; reason: string };

const PERCENT = (value: number): number => Math.round(value * 100);
const NONE = { photoIds: [] as string[] };
const BOTH = { photoIds: ["home-1", "away-1"] };

const off = (type: ReelSceneType, reason: string): PoolEntry => ({ type, scene: null, reason });
const on = (scene: ReelScene): PoolEntry => ({ type: scene.type, scene, reason: null });

const DATE = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", weekday: "long" });
const TIME = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const SHORT = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DAY = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit" });
const part = (format: Intl.DateTimeFormat, at: Date, type: Intl.DateTimeFormatPartTypes) => format.formatToParts(at).find((item) => item.type === type)?.value ?? "";

export const kickoffTime = (iso: string): string => TIME.format(new Date(iso));
export const shortStamp = (iso: string): string => {
  const at = new Date(iso);
  return `${part(SHORT, at, "day")}.${part(SHORT, at, "month")} ${part(SHORT, at, "hour")}:${part(SHORT, at, "minute")}`;
};
const dayStamp = (iso: string): string => {
  const at = new Date(iso);
  return `${part(DAY, at, "day")}.${part(DAY, at, "month")}`;
};
const dateLabel = (iso: string): string => {
  const at = new Date(iso);
  return `${part(DATE, at, "day")} ${part(DATE, at, "month")} ${part(DATE, at, "weekday")}, ${kickoffTime(iso)}`;
};

const DURATIONS: Record<ReelSceneType, number> = {
  // S02: 8 kare geçişe gider, ekranda net 0,8 sn kalır.
  S01_COVER: 45, S02_LOGO: 32, S03_HOOK: 150, S04_COMPARE: 210, S05_H2H: 180, S06_WINNER: 210, S07_KEY_GAP: 150, S08_GOALS: 180,
  S09_BOTH_SCORE: 150, S10_FIRST_GOAL: 150, S11_FATIGUE: 120, S12_SCORE: 150, S13_SCORER: 150, S14_TRACK_RECORD: 180, S15_CHANCE: 150, S16_SUMMARY: 330,
};

const base = (type: ReelSceneType, headline: [string, string] | null, assets = NONE) => ({
  durationInFrames: DURATIONS[type],
  headline: headline ? { line1: headline[0], line2: headline[1] } : null,
  caption: null,
  assets,
});

export function evaluatePool(data: MatchData, brand: { handle: string }, options: { allowSampleTrackRecord?: boolean } = {}): PoolEntry[] {
  const { home, away } = data.teams;
  const outcome = { home: PERCENT(data.outcome.home_win), draw: PERCENT(data.outcome.draw), away: PERCENT(data.outcome.away_win) };
  const leader = outcomeLeader(data.outcome);
  const metrics = compareMetrics(data.form);
  const keyGap = pickKeyGap(metrics);
  const formHome = formLetters(data.form.home.last5);
  const formAway = formLetters(data.form.away.last5);
  const h2h = data.h2h;
  const sim = data.model.simulations;
  const xgReady = data.form.home.xg_for !== null && data.form.away.xg_for !== null;
  const xg = { home: data.form.home.xg_for ?? 0, away: data.form.away.xg_for ?? 0 };
  const fatigue = { home: effectiveFatigue(data.form.home.euro_fatigue_days), away: effectiveFatigue(data.form.away.euro_fatigue_days) };
  const { first_goal: firstGoal } = data;
  const leaders = data.season_xg_leaders;
  const scorerSide = (leaders.home[0]?.season_xg ?? -1) >= (leaders.away[0]?.season_xg ?? -1) ? "home" : "away";
  const scorer = leaders[scorerSide][0];
  const otherScorer = leaders[scorerSide === "home" ? "away" : "home"][0] ?? null;
  const leaderShare = leader === "home" ? outcome.home : leader === "away" ? outcome.away : outcome.draw;
  const leaderName = leader === "home" ? home.name : away.name;
  const statement = leader === "draw" ? "Maç beraber biter" : `${leaderName} kazanır`;
  const hits = Math.round(leaderShare / 10);
  const track = decideTrackRecord(data.model_track_record, leaderShare, { allowSample: options.allowSampleTrackRecord ?? false });
  const [dotsHome = 0, dotsDraw = 0, dotsAway = 0] = splitDots([data.outcome.home_win, data.outcome.draw, data.outcome.away_win], 1000);

  return [
    on({ type: "S01_COVER", ...base("S01_COVER", [home.name, away.name], BOTH), data: { seriesLabel: "Maç Günü", league: data.match.league.name, round: data.match.league.round, dateLabel: dateLabel(data.match.kickoff_utc), venue: data.match.venue } }),
    on({ type: "S02_LOGO", ...base("S02_LOGO", null), data: {} }),
    sim === null
      ? off("S03_HOOK", "Simülasyon sayısı yok")
      : on({
          type: "S03_HOOK", ...base("S03_HOOK", [`Maçı ${spokenThousands(sim)}`, "kez oynattık."], BOTH),
          data: { simulations: sim, wins: { home: Math.round(sim * data.outcome.home_win), draw: Math.round(sim * data.outcome.draw), away: Math.round(sim * data.outcome.away_win) } },
        }),
    metrics.length < 3 || formHome.length < 3 || formAway.length < 3
      ? off("S04_COMPARE", "Form ya da karşılaştırma verisi eksik")
      : on({
          type: "S04_COMPARE", ...base("S04_COMPARE", ["İki takım,", "son 5 maç."]),
          data: {
            form: { home: formHome, away: formAway },
            rows: compareRows(metrics),
            summary: (() => {
              const rows = compareRows(metrics);
              const homeWins = rows.filter((row) => row.better === "home").length;
              const awayWins = rows.filter((row) => row.better === "away").length;
              return `${home.short_name} ${homeWins} başlıkta, ${away.short_name} ${awayWins} başlıkta önde.`;
            })(),
          },
        }),
    (h2h.played ?? 0) < 3 || h2h.matches.length < 3 || h2h.avg_goals === null || h2h.home_wins === null || h2h.draws === null || h2h.away_wins === null
      ? off("S05_H2H", "Kafa kafaya en az 3 maç gerekli")
      : on({
          type: "S05_H2H", ...base("S05_H2H", ["Kafa kafaya", `son ${h2h.played} maç.`]),
          data: {
            matches: h2h.matches.slice(0, 5).map((match) => ({ date: dayStamp(match.date), home: match.home, away: match.away, score: `${match.home_score}–${match.away_score}` })),
            avgGoals: h2h.avg_goals, played: h2h.played ?? 0, homeWins: h2h.home_wins, draws: h2h.draws, awayWins: h2h.away_wins,
          },
        }),
    on({ type: "S06_WINNER", ...base("S06_WINNER", ["Bu maçta", "kim kazanır?"], BOTH), data: { ...outcome, leader, dots: { home: dotsHome, draw: dotsDraw, away: dotsAway } } }),
    keyGap === null
      ? off("S07_KEY_GAP", "İki takım arasında belirgin fark yok")
      : (() => {
          const leadSide = (keyGap.home > keyGap.away) !== keyGap.lowerIsBetter ? "home" as const : "away" as const;
          const [a, b] = leadSide === "home" ? [keyGap.home, keyGap.away] : [keyGap.away, keyGap.home];
          const leadTeam = data.teams[leadSide];
          const otherTeam = data.teams[leadSide === "home" ? "away" : "home"];
          return on({
            type: "S07_KEY_GAP", ...base("S07_KEY_GAP", ["Kilit fark:", keyGap.headline], { photoIds: [`${leadSide}-1`] }),
            data: { metric: keyGap.label, leader: leadSide, leaderValue: keyGap.format(a), otherValue: keyGap.format(b), sentence: keyGap.sentence(leadTeam.short_name, keyGap.format(a), otherTeam.short_name, keyGap.format(b)) },
          });
        })(),
    data.goals.three_plus === null || !xgReady
      ? off("S08_GOALS", "3+ gol ya da xG verisi yok")
      : on({ type: "S08_GOALS", ...base("S08_GOALS", ["Gollü", "maç mı?"]), data: { percent: PERCENT(data.goals.three_plus), xg, h2hAvg: h2h.avg_goals } }),
    data.both_score === null || data.form.home.clean_sheet_rate === null || data.form.away.clean_sheet_rate === null
      ? off("S09_BOTH_SCORE", "İki takım da gol verisi eksik")
      : on({
          type: "S09_BOTH_SCORE", ...base("S09_BOTH_SCORE", ["İki takım da", "gol bulur mu?"]),
          data: {
            percent: PERCENT(data.both_score),
            teamChance: data.team_goal_chance ? { home: PERCENT(data.team_goal_chance.home), away: PERCENT(data.team_goal_chance.away) } : null,
            cleanSheet: { home: PERCENT(data.form.home.clean_sheet_rate), away: PERCENT(data.form.away.clean_sheet_rate) },
          },
        }),
    firstGoal.home === null || firstGoal.away === null || firstGoal.none === null
      ? off("S10_FIRST_GOAL", "İlk gol verisi eksik")
      : on({ type: "S10_FIRST_GOAL", ...base("S10_FIRST_GOAL", ["İlk gol", "kimden?"]), data: { home: PERCENT(firstGoal.home), away: PERCENT(firstGoal.away), none: PERCENT(firstGoal.none) } }),
    fatigue.home === null && fatigue.away === null
      ? off("S11_FATIGUE", "İki takım da Avrupa'da oynamadı")
      : on({
          type: "S11_FATIGUE", ...base("S11_FATIGUE", ["Takvim ve", "yorgunluk"]),
          data: {
            days: fatigue,
            sentence: fatigue.home !== null && fatigue.away !== null
              ? `${fatigue.home < fatigue.away ? home.short_name : away.short_name} ${Math.abs(fatigue.home - fatigue.away)} gün daha az dinlendi.`
              : `${fatigue.home !== null ? home.short_name : away.short_name} Avrupa dönüşü sahada.`,
          },
        }),
    !data.score_scene_allowed || data.score_distribution.length === 0
      ? off("S12_SCORE", "Skor dağılımı diğer sahnelerle çelişiyor")
      : on({ type: "S12_SCORE", ...base("S12_SCORE", ["En olası", "skor"]), data: { scores: data.score_distribution.slice(0, 5).map((cell) => ({ label: `${cell.home_goals}–${cell.away_goals}`, percent: PERCENT(cell.p) })) } }),
    !scorer
      ? off("S13_SCORER", "Bu takımlar için sezon xG verisi yok")
      : !data.season_xg_fresh
        ? off("S13_SCORER", "Sezon xG verisi güncel değil")
        : on({
            type: "S13_SCORER", ...base("S13_SCORER", ["Golcü adayı", "kim?"], { photoIds: [`${scorerSide}-1`] }),
            data: {
              leader: scorerSide, name: scorer.name, goals: scorer.season_goals, xg: scorer.season_xg, games: scorer.season_games,
              other: otherScorer ? { name: otherScorer.name, goals: otherScorer.season_goals, xg: otherScorer.season_xg, games: otherScorer.season_games } : null,
              updated: dayStamp(leaders.data_updated_at[scorerSide] ?? data.model.computed_at),
            },
          }),
    track.bucket === null
      ? off("S14_TRACK_RECORD", track.reason)
      : on({
          type: "S14_TRACK_RECORD", ...base("S14_TRACK_RECORD", ["Modelin", "karnesi"]),
          data: {
            focus: { range: `%${track.bucket.from}–${track.bucket.to}`, hitRate: PERCENT(track.bucket.hit_rate), matches: track.bucket.matches },
            buckets: (data.model_track_record?.buckets ?? []).map((item) => ({ range: `%${item.from}–${item.to}`, mid: Math.round((item.from + item.to) / 2), hitRate: PERCENT(item.hit_rate), matches: item.matches, active: item === track.bucket })),
          },
        }),
    on({
      type: "S15_CHANCE", ...base("S15_CHANCE", ["İhtimal,", "kesinlik değil."]),
      data: { percent: leaderShare, hitsOfTen: hits, statement: `${statement}: %${leaderShare} = 10 maçın yaklaşık ${ofTen(hits)}. Kalan ${formatInt(10 - hits)} maçta başka sonuç.` },
    }),
    data.goals.three_plus === null || data.both_score === null || firstGoal.home === null || firstGoal.away === null || !xgReady
      ? off("S16_SUMMARY", "Özet için ana rakamlar eksik")
      : on({
          type: "S16_SUMMARY", ...base("S16_SUMMARY", ["Bir bakışta", "bu maç"], BOTH),
          data: {
            outcome, threePlus: PERCENT(data.goals.three_plus), bothScore: PERCENT(data.both_score),
            firstGoal: { home: PERCENT(firstGoal.home), away: PERCENT(firstGoal.away) }, xg, h2hAvg: h2h.avg_goals,
            question: "Senin skorun ne?", prompt: "Yorumlara yaz.", handle: brand.handle,
          },
        }),
  ];
}

export type StoryAngle = "derby" | "favourite";

/** Hikâye açısına göre sıra; önce ana liste, sahne kapalıysa yedekten tamamlanır. */
const STORIES: Record<StoryAngle, { main: ReelSceneType[]; reserve: ReelSceneType[] }> = {
  derby: {
    main: ["S01_COVER", "S02_LOGO", "S03_HOOK", "S04_COMPARE", "S05_H2H", "S06_WINNER", "S07_KEY_GAP", "S08_GOALS", "S09_BOTH_SCORE", "S10_FIRST_GOAL", "S12_SCORE", "S14_TRACK_RECORD", "S15_CHANCE", "S16_SUMMARY"],
    reserve: ["S11_FATIGUE", "S13_SCORER"],
  },
  favourite: {
    main: ["S01_COVER", "S02_LOGO", "S03_HOOK", "S04_COMPARE", "S06_WINNER", "S07_KEY_GAP", "S11_FATIGUE", "S08_GOALS", "S10_FIRST_GOAL", "S13_SCORER", "S14_TRACK_RECORD", "S15_CHANCE", "S16_SUMMARY"],
    reserve: ["S09_BOTH_SCORE", "S05_H2H", "S12_SCORE"],
  },
};

export const MIN_STORY_SCENES = 12;
export const MAX_STORY_SCENES = 14;

export function pickStory(pool: readonly PoolEntry[], angle: StoryAngle): ReelScene[] {
  const { main, reserve } = STORIES[angle];
  const ready = new Map(pool.flatMap((entry) => (entry.scene ? [[entry.type, entry.scene] as const] : [])));
  const chosen = main.filter((type) => ready.has(type));
  for (const type of reserve) {
    if (chosen.length >= MIN_STORY_SCENES) break;
    if (!ready.has(type)) continue;
    // Yedek, özetten önceki veri sahnelerinin arasına girer.
    chosen.splice(Math.max(0, chosen.length - 3), 0, type);
  }
  return chosen.slice(0, MAX_STORY_SCENES).flatMap((type) => {
    const scene = ready.get(type);
    return scene ? [scene] : [];
  });
}

export const BRAND = { accent: "#2EA537", logo: "brand/checkmatch-logo.png", mark: "brand/checkmatch-mark.png", handle: "@checkmatch_tr" };

/** Yer tutucu siluet: `Photo.processingMeta` biçiminde oransal yüz kutusu ve kırpma önerisi. */
const placeholderPhoto = (side: "home" | "away"): ReelPhoto => ({
  src: "placeholders/silhouette.svg",
  aspect: 0.75,
  side,
  focus: { x: 0.5, y: 0.2 },
  faces: [{ x: 0.355, y: 0.09, width: 0.29, height: 0.21 }],
  crops: { vertical: { x: 0, y: 0, width: 1, height: 1 }, square: { x: 0, y: 0, width: 1, height: 0.75 } },
});
export const PHOTOS: Record<string, ReelPhoto> = { "home-1": placeholderPhoto("home"), "away-1": placeholderPhoto("away") };

export function buildScript(data: MatchData, scenes: ReelScene[], disabled: { type: string; reason: string }[]): ReelScript {
  const team = (side: "home" | "away") => {
    const item = data.teams[side];
    return { id: item.id, name: item.name, shortName: item.short_name, logo: item.logo, colors: item.colors };
  };
  return {
    meta: {
      match: { id: data.match.id, kickoffUtc: data.match.kickoff_utc, kickoffLabel: kickoffTime(data.match.kickoff_utc), round: data.match.league.round, venue: data.match.venue },
      league: { id: data.match.league.id, name: data.match.league.name },
      teams: { home: team("home"), away: team("away") },
      snapshot: { version: 1, contractVersion: data.contract_version, modelVersion: data.model.version, computedAt: data.model.computed_at, computedLabel: shortStamp(data.model.computed_at), simulations: data.model.simulations ?? 0 },
    },
    brand: BRAND,
    photos: PHOTOS,
    scenes,
    disabled,
  };
}
