import { formatDecimal, formatInt, ofTen, spokenThousands } from "../lib/motion";
import { ACTIVE_DESIGN, type DesignDirection, QuestionSceneType, ReelPhoto, ReelScene, ReelSceneType, ReelScript } from "../schema";

export { MAX_STORY_SCENES, MAX_STORY_SECONDS, MIN_STORY_SCENES, MIN_STORY_SECONDS, pickStory, storyProblems, type StoryAngle, type StoryOptions } from "./story";
import { checkBothScore, checkFirstGoal, checkGoals } from "./market-checks";
import type { MatchData, Side } from "./match-data";
import { compareMetrics, compareRows, effectiveFatigue, formLetters, outcomeLeader, pickKeyGap } from "./metrics";
import { DUEL_SCOPE, duelRows, MIN_DUEL_ROWS, pickStar, VS_SCOPE, vsOpponentStory } from "./players";
import { evaluateAnalysis } from "./analysis";
import { say, TEAM, voiceOf, type Voiceover } from "./claims";
import { evaluateQuestions } from "./questions";
import { inSquad, squadFreshness } from "./squad";
import { decideTrackRecord } from "./track-record";

/**
 * Sahne havuzu: her sahne veriyi kendi denetler. Eksikse devre dışı kalır ve nedenini döner; asla boş ya da sıfırlı
 * kare çizilmez. Hikâye `story.ts`: 17 adımlık akış, 75–100 sn.
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
  Q01_WINNER: 180, Q02_POINTS: 150, Q03_COMFORT: 150, Q04_GOALS: 180, Q05_BOTH_SCORE: 180, Q06_TEAM_GOALS: 150, Q07_CLEAN_WIN: 150, Q08_HT_LEAD: 150,
  Q09_HT_GOAL: 150, Q10_HOT_HALF: 150, Q11_COMEBACK: 150, Q12_FIRST_GOAL: 180, Q13_PRESSURE: 150, Q14_CARDS: 150, Q15_PENALTY: 150, Q16_SCORE: 150, Q17_SCORER: 150,
};

const DURATIONS: Record<ReelSceneType, number> = {
  ...QUESTION_FRAMES,
  S01_COVER: 120, C01_STORY: 180, M02_MONTE_CARLO: 180, C02_FORM: 180, C03_ABSENCES: 180, C04_TEAM_HOME: 180, C05_TEAM_AWAY: 180, C06_MINUTES: 180, C07_KEY: 180, C08_UPSET: 180, C09_SCENARIO: 180,
  P01_DUEL: 180, P02_VS_OPPONENT: 180, S17_CLOSE: 120,
  // Yedek havuzun eski sahneleri: akışa girmez, tasarım seçilince taşınır ya da silinir.
  S02_LOGO: 32, S03_HOOK: 150, S04_COMPARE: 210, S05_H2H: 180, S07_KEY_GAP: 150, S11_FATIGUE: 120, S14_TRACK_RECORD: 180, S15_CHANCE: 150, S16_SUMMARY: 270,
};

const base = (type: ReelSceneType, headline: [string, string] | null, assets = NONE, voiceover: Voiceover | null = null) => ({
  durationInFrames: DURATIONS[type],
  voiceover,
  headline: headline ? { line1: headline[0], line2: headline[1] } : null,
  caption: null,
  assets,
});

export interface PoolOptions {
  allowSampleTrackRecord?: boolean;
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
    type: "P01_DUEL", ...base("P01_DUEL", ["Yıldızların", "düellosu"], BOTH, voiceOf([
      say(data, "duel.home", "{name} bu sezon {g} gol, {a} asist.", { name: { label: home.name }, g: { computed: home.goals ?? 0, from: [`players.candidates.home`], format: "int" }, a: { computed: home.assists ?? 0, from: [`players.candidates.home`], format: "int" } }),
      say(data, "duel.away", "{name} {g} gol, {a} asist.", { name: { label: away.name }, g: { computed: away.goals ?? 0, from: [`players.candidates.away`], format: "int" }, a: { computed: away.assists ?? 0, from: [`players.candidates.away`], format: "int" } }),
    ])),
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
    type: "P02_VS_OPPONENT", ...base("P02_VS_OPPONENT", ["Rakibine karşı", best.player.name], { photoIds: [`${best.side}-1`] }, voiceOf([
      say(data, "vs.total", "{name}, {team} karşısında {m} maçta {g} gol, {a} asist yaptı.", { name: { label: best.player.name }, team: TEAM[best.side === "home" ? "away" : "home"], m: { computed: best.history.matches.length, from: ["players.vs_opponent"], format: "int" }, g: { computed: best.story.goals, from: ["players.vs_opponent"], format: "int" }, a: { computed: best.story.assists, from: ["players.vs_opponent"], format: "int" } }),
    ])),
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

  return [
    on({ type: "S01_COVER", ...base("S01_COVER", [home.name, away.name], BOTH, voiceOf([say(data, "cover", "{home} ile {away} karşılaşıyor. Bu maçı birlikte okuyalım.", { home: TEAM.home, away: TEAM.away })])), data: { seriesLabel: "Maç Önü", league: data.match.league.name, round: data.match.league.round, dateLabel: dateLabel(data.match.kickoff_utc), venue: data.match.venue } }),
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
    ...evaluateAnalysis(data, DURATIONS, brand.handle),
  ];
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

/** Video açıklaması: analist notunun tam hali + senaryo maddeleri. */
export function videoDescription(data: MatchData, scenes: readonly ReelScene[]): string {
  const scenario = scenes.find((scene) => scene.type === "C09_SCENARIO");
  const items = scenario?.type === "C09_SCENARIO" ? scenario.data.items.map((item) => item.text) : [];
  return [`${data.teams.home.name} – ${data.teams.away.name}: maç önü analiz.`, data.analyst_voice_note?.trim() ?? "", ...items, BRAND.handle].filter(Boolean).join("\n");
}

export function buildScript(data: MatchData, scenes: ReelScene[], disabled: { type: string; reason: string }[], design: DesignDirection = ACTIVE_DESIGN): ReelScript {
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
    description: videoDescription(data, scenes),
    disabled,
  };
}
