import { formatDecimal, formatInt, ofTen, spokenThousands } from "../lib/motion";
import type { DesignDirection, QuestionSceneType, ReelPhoto, ReelScene, ReelSceneType, ReelScript } from "../schema";
import { checkBothScore, checkFirstGoal, checkGoals } from "./market-checks";
import type { MatchData, Side } from "./match-data";
import { compareMetrics, compareRows, effectiveFatigue, formLetters, outcomeLeader, pickKeyGap } from "./metrics";
import { unknownNames } from "./name-guard";
import { DUEL_SCOPE, duelRows, MIN_DUEL_ROWS, pickStar, VS_SCOPE, vsOpponentStory } from "./players";
import { evaluateQuestions } from "./questions";
import { inSquad, squadFreshness } from "./squad";
import { decideTrackRecord } from "./track-record";

/**
 * Sahne havuzu: her sahne veriyi kendi denetler. Eksikse devre dışı kalır ve nedenini döner; asla boş ya da sıfırlı
 * kare çizilmez. Hikâye açısı havuzdan 12–16 sahne seçer (60–90 sn).
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
const DAY = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric" });
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
/** "14.03.2026": zaman şeridinde yıl da görünür. */
const fullDay = (iso: string): string => {
  const at = new Date(iso);
  return `${part(DAY, at, "day")}.${part(DAY, at, "month")}.${part(DAY, at, "year")}`;
};
const dateLabel = (iso: string): string => {
  const at = new Date(iso);
  return `${part(DATE, at, "day")} ${part(DATE, at, "month")} ${part(DATE, at, "weekday")}, ${kickoffTime(iso)}`;
};

const QUESTION_FRAMES: Record<QuestionSceneType, number> = {
  Q01_WINNER: 180, Q02_POINTS: 180, Q03_COMFORT: 180, Q04_GOALS: 210, Q05_BOTH_SCORE: 180, Q06_TEAM_GOALS: 180, Q07_CLEAN_WIN: 180, Q08_HT_LEAD: 180,
  Q09_HT_GOAL: 180, Q10_HOT_HALF: 180, Q11_COMEBACK: 180, Q12_FIRST_GOAL: 180, Q13_PRESSURE: 180, Q14_CARDS: 180, Q15_PENALTY: 180, Q16_SCORE: 180, Q17_SCORER: 180,
};

const DURATIONS: Record<ReelSceneType, number> = {
  ...QUESTION_FRAMES,
  // S02: 8 kare geçişe gider, ekranda net 0,8 sn kalır. M01: 5 sn, kancadan hemen sonra.
  S01_COVER: 45, S02_LOGO: 32, S03_HOOK: 150, M01_METHOD: 150, S04_COMPARE: 210, S05_H2H: 180, S07_KEY_GAP: 150, S11_FATIGUE: 120, S14_TRACK_RECORD: 180, S15_CHANCE: 150, S16_SUMMARY: 270,
  P01_DUEL: 240, P02_VS_OPPONENT: 240,
};

const base = (type: ReelSceneType, headline: [string, string] | null, assets = NONE) => ({
  durationInFrames: DURATIONS[type],
  headline: headline ? { line1: headline[0], line2: headline[1] } : null,
  caption: null,
  assets,
});

export interface PoolOptions {
  allowSampleTrackRecord?: boolean;
  /** Örnek veri grubu listesi: gerçek liste gelene kadar yalnız örneklerde. */
  allowSampleInputs?: boolean;
  /** Golcü şablonu: golcü modeli düzeltilene kadar gerçek akışta kapalı. */
  allowScorerScene?: boolean;
  /** Kadro yaşının ölçüldüğü an; varsayılan hesabın yapıldığı an (saf ve tekrarlanabilir). */
  now?: Date;
}

/** Düello: iki takımın yıldızı, kimlik üzerinden kadroda doğrulanmış olmalı. */
function evaluateDuel(data: MatchData, now: Date): PoolEntry {
  const { players, teams } = data;
  const fresh = squadFreshness(players.squad_checked_at, now);
  if (fresh) return off("P01_DUEL", fresh);
  const verified = (side: Side) => players.candidates[side].filter((player) => inSquad(players, side, player.id));
  const [home, away] = [pickStar(verified("home")), pickStar(verified("away"))];
  if (!home || !away) return off("P01_DUEL", `Doğrulanmış oyuncu yok: ${!home ? teams.home.short_name : teams.away.short_name}`);
  const rows = duelRows(home, away);
  if (rows.length < MIN_DUEL_ROWS) return off("P01_DUEL", "Oyuncu istatistiği yetersiz");
  return on({
    type: "P01_DUEL", ...base("P01_DUEL", ["Yıldızların", "düellosu"], BOTH),
    data: { home: { name: home.name, team: teams.home.short_name, logo: teams.home.logo }, away: { name: away.name, team: teams.away.short_name, logo: teams.away.logo }, rows, scope: DUEL_SCOPE },
  });
}

/** Rakibine karşı: yalnız gerçek hikâye varsa. Tahmin cümlesi kurulmaz, geçmiş ve sezon kıyası yazılır. */
function evaluateVsOpponent(data: MatchData, now: Date): PoolEntry {
  const { players, teams } = data;
  const fresh = squadFreshness(players.squad_checked_at, now);
  if (fresh) return off("P02_VS_OPPONENT", fresh);
  const options = (["home", "away"] as const).flatMap((side) => players.candidates[side].filter((player) => inSquad(players, side, player.id)).flatMap((player) => {
    const history = players.vs_opponent.find((item) => item.player_id === player.id);
    const story = history ? vsOpponentStory(history, player) : null;
    return history && story ? [{ side, player, history, story }] : [];
  }));
  const best = options.sort((a, b) => b.story.streak - a.story.streak || b.story.vsPer90 - a.story.vsPer90)[0];
  if (!best) return off("P02_VS_OPPONENT", "Rakibe karşı gerçek bir hikâye yok");
  const opponent = teams[best.side === "home" ? "away" : "home"];
  const teamId = teams[best.side].id;
  return on({
    type: "P02_VS_OPPONENT", ...base("P02_VS_OPPONENT", ["Rakibine karşı", best.player.name], { photoIds: [`${best.side}-1`] }),
    data: {
      side: best.side, player: best.player.name, opponent: opponent.short_name,
      timeline: [...best.history.matches].sort((a, b) => a.date.localeCompare(b.date)).slice(-5).map((match) => ({ date: fullDay(match.date), club: match.club_name, clubLogo: match.club_logo, otherClub: match.club_id !== teamId, score: match.score, goals: match.goals, assists: match.assists })),
      totals: { matches: best.history.matches.length, goals: best.story.goals, assists: best.story.assists },
      per90: { opponent: formatDecimal(best.story.vsPer90, 2), season: formatDecimal(best.story.seasonPer90, 2) },
      scope: VS_SCOPE,
    },
  });
}

export function evaluatePool(data: MatchData, brand: { handle: string }, options: PoolOptions = {}): PoolEntry[] {
  const now = options.now ?? new Date(data.model.computed_at);
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
  const leaderShare = leader === "home" ? outcome.home : leader === "away" ? outcome.away : outcome.draw;
  const leaderName = leader === "home" ? home.name : away.name;
  const statement = leader === "draw" ? "Maç beraber biter" : `${leaderName} kazanır`;
  const hits = Math.round(leaderShare / 10);
  const track = decideTrackRecord(data.model_track_record, leaderShare, { allowSample: options.allowSampleTrackRecord ?? false });
  const questions = evaluateQuestions(data, { durations: QUESTION_FRAMES, allowScorerScene: options.allowScorerScene ?? false, now });
  const inputs = data.model_inputs;
  const inputsReason = sim === null ? "Simülasyon sayısı yok" : !inputs || inputs.groups.length < 3 ? "Modele giren veri listesi yok" : inputs.source === "sample" && !options.allowSampleInputs ? "Gerçek veri grubu listesi henüz yok, örnek liste yayına girmez" : null;

  return [
    on({ type: "S01_COVER", ...base("S01_COVER", [home.name, away.name], BOTH), data: { seriesLabel: "Maç Günü", league: data.match.league.name, round: data.match.league.round, dateLabel: dateLabel(data.match.kickoff_utc), venue: data.match.venue } }),
    on({ type: "S02_LOGO", ...base("S02_LOGO", null), data: {} }),
    sim === null
      ? off("S03_HOOK", "Simülasyon sayısı yok")
      : on({
          type: "S03_HOOK", ...base("S03_HOOK", [`Maçı ${spokenThousands(sim)}`, "kez oynattık."], BOTH),
          data: { simulations: sim, wins: { home: Math.round(sim * data.outcome.home_win), draw: Math.round(sim * data.outcome.draw), away: Math.round(sim * data.outcome.away_win) } },
        }),
    inputsReason
      ? off("M01_METHOD", inputsReason)
      : on({
          type: "M01_METHOD", ...base("M01_METHOD", ["Nasıl", "hesapladık?"]),
          data: {
            groups: inputs?.groups ?? [],
            piles: [
              { label: home.short_name, share: data.outcome.home_win, side: "home" },
              { label: "Beraberlik", share: data.outcome.draw, side: "draw" },
              { label: away.short_name, share: data.outcome.away_win, side: "away" },
            ],
          },
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
    // Özet, kapanan sahnelerin rakamını geri getirmez: şüpheli değer özette de görünmez.
    checkGoals(data.goals) || checkBothScore(data) || checkFirstGoal(firstGoal) || !xgReady
      ? off("S16_SUMMARY", "Özet için ana rakamlar eksik ya da şüpheli")
      : on({
          type: "S16_SUMMARY", ...base("S16_SUMMARY", ["Bir bakışta", "bu maç"], BOTH),
          data: {
            outcome, threePlus: PERCENT(data.goals.three_plus ?? 0), bothScore: PERCENT(data.both_score ?? 0),
            firstGoal: { home: PERCENT(firstGoal.home ?? 0), away: PERCENT(firstGoal.away ?? 0) }, xg, h2hAvg: h2h.avg_goals,
            question: "Senin skorun ne?", prompt: "Yorumlara yaz.", handle: brand.handle,
          },
        }),
    ...questions,
    evaluateDuel(data, now),
    evaluateVsOpponent(data, now),
  ];
}

export type StoryAngle = "derby" | "favourite";

/** Hikâye açısına göre sıra; önce ana liste, sahne kapalıysa yedekten tamamlanır. Kanca → "Nasıl hesapladık?" → veri. */
const STORIES: Record<StoryAngle, { main: ReelSceneType[]; reserve: ReelSceneType[] }> = {
  derby: {
    main: ["S01_COVER", "S02_LOGO", "S03_HOOK", "M01_METHOD", "Q01_WINNER", "S04_COMPARE", "P01_DUEL", "Q04_GOALS", "Q05_BOTH_SCORE", "Q12_FIRST_GOAL", "Q08_HT_LEAD", "Q13_PRESSURE", "Q14_CARDS", "Q16_SCORE", "P02_VS_OPPONENT", "S16_SUMMARY"],
    reserve: ["Q02_POINTS", "Q10_HOT_HALF", "Q15_PENALTY", "S05_H2H", "Q09_HT_GOAL", "S15_CHANCE", "S11_FATIGUE"],
  },
  favourite: {
    main: ["S01_COVER", "S02_LOGO", "S03_HOOK", "M01_METHOD", "Q01_WINNER", "Q03_COMFORT", "Q07_CLEAN_WIN", "P01_DUEL", "Q06_TEAM_GOALS", "Q04_GOALS", "Q10_HOT_HALF", "Q11_COMEBACK", "Q12_FIRST_GOAL", "S07_KEY_GAP", "P02_VS_OPPONENT", "S16_SUMMARY"],
    reserve: ["Q02_POINTS", "Q05_BOTH_SCORE", "Q09_HT_GOAL", "Q15_PENALTY", "S11_FATIGUE", "S15_CHANCE", "S05_H2H"],
  },
};

export const MIN_STORY_SCENES = 12;
export const MAX_STORY_SCENES = 16;
export const MIN_STORY_SECONDS = 60;
export const MAX_STORY_SECONDS = 90;

export interface StoryOptions {
  /** Aynı hafta içindeki önceki videoların dizilimleri: aynısı tekrarlanmaz. */
  avoid?: readonly (readonly ReelSceneType[])[];
}

const sameSequence = (a: readonly ReelSceneType[], b: readonly ReelSceneType[]): boolean => a.length === b.length && a.every((type, index) => type === b[index]);

export function pickStory(pool: readonly PoolEntry[], angle: StoryAngle, options: StoryOptions = {}): ReelScene[] {
  const { main, reserve } = STORIES[angle];
  const ready = new Map(pool.flatMap((entry) => (entry.scene ? [[entry.type, entry.scene] as const] : [])));
  const chosen = main.filter((type) => ready.has(type));
  for (const type of reserve) {
    if (chosen.length >= MIN_STORY_SCENES) break;
    if (!ready.has(type)) continue;
    // Yedek, kapanıştan önceki veri sahnelerinin arasına girer.
    const closing = chosen.at(-1) === "S16_SUMMARY" ? 1 : 0;
    chosen.splice(chosen.length - closing, 0, type);
  }
  let sequence = chosen.slice(0, MAX_STORY_SCENES);
  // Aynı dizilim bu hafta kullanıldıysa veri sahneleri komşu takasla değişir. Açılış ve kapanış yerinde kalır.
  const avoid = options.avoid ?? [];
  if (avoid.some((used) => sameSequence(used, sequence))) {
    const start = sequence.indexOf("M01_METHOD") + 1;
    const end = sequence.at(-1) === "S16_SUMMARY" ? sequence.length - 1 : sequence.length;
    for (let index = start; index < end - 1; index += 1) {
      const swapped = [...sequence];
      [swapped[index], swapped[index + 1]] = [sequence[index + 1] as ReelSceneType, sequence[index] as ReelSceneType];
      if (!avoid.some((used) => sameSequence(used, swapped))) {
        sequence = swapped;
        break;
      }
    }
  }
  return sequence.flatMap((type) => {
    const scene = ready.get(type);
    return scene ? [scene] : [];
  });
}

/**
 * Yayın öncesi engeller; panelde gösterilir. Boş dizi = video üretilebilir. "Nasıl hesapladık?" ve Düello her videoda
 * zorunludur; ad bekçisi veride olmayan özel adı burada yakalar.
 */
export function storyProblems(story: readonly ReelScene[], data: MatchData, seconds: number): string[] {
  const types = story.map((scene) => scene.type);
  const problems: string[] = [];
  if (!types.includes("M01_METHOD")) problems.push('"Nasıl hesapladık?" sahnesi yok');
  else if (types.indexOf("M01_METHOD") !== types.indexOf("S03_HOOK") + 1) problems.push('"Nasıl hesapladık?" kancadan hemen sonra gelmeli');
  if (!types.includes("P01_DUEL")) problems.push("Düello sahnesi yok");
  if (story.length < MIN_STORY_SCENES || story.length > MAX_STORY_SCENES) problems.push(`Sahne sayısı ${story.length}: ${MIN_STORY_SCENES}–${MAX_STORY_SCENES} olmalı`);
  if (seconds < MIN_STORY_SECONDS || seconds > MAX_STORY_SECONDS) problems.push(`Süre ${seconds.toFixed(1)} sn: ${MIN_STORY_SECONDS}–${MAX_STORY_SECONDS} olmalı`);
  const names = unknownNames(story, data);
  if (names.length) problems.push(`Veride olmayan özel ad: ${names.join(", ")}`);
  return problems;
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

export function buildScript(data: MatchData, scenes: ReelScene[], disabled: { type: string; reason: string }[], design: DesignDirection = "A"): ReelScript {
  const team = (side: "home" | "away") => {
    const item = data.teams[side];
    return { id: item.id, name: item.name, shortName: item.short_name, logo: item.logo, colors: item.colors };
  };
  return {
    design,
    meta: {
      match: { id: data.match.id, kickoffUtc: data.match.kickoff_utc, kickoffLabel: kickoffTime(data.match.kickoff_utc), round: data.match.league.round, venue: data.match.venue },
      league: { id: data.match.league.id, name: data.match.league.name },
      teams: { home: team("home"), away: team("away") },
      snapshot: { version: 1, contractVersion: data.contract_version, modelVersion: data.model.version, computedAt: data.model.computed_at, computedLabel: shortStamp(data.model.computed_at), simulations: data.model.simulations ?? 0, squadCheckedAt: data.players.squad_checked_at },
    },
    brand: BRAND,
    photos: PHOTOS,
    scenes,
    disabled,
  };
}
