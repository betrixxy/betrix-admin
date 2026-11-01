import { formatInt, ofTen, splitDots, spokenThousands } from "../lib/motion";
import { reelScriptSchema, type ReelPhoto, type ReelScript } from "../schema";

/**
 * Örnek veri → ReelScript. Asıl senaryo motoru Aşama 4'te gelecek; buradaki sıra ve metinler prototip içindir.
 * Girdi reels-service sözleşme v1 biçimindedir (betrix `reels-schema.ts`). Kurgusaldır.
 */

export interface ContractSample {
  contract_version: "1.0";
  match: { id: number; kickoff_utc: string; league: { id: number; name: string; round: string | null }; referee: string | null };
  teams: { home: { id: number; name: string; logo_url: string | null }; away: { id: number; name: string; logo_url: string | null } };
  model: { version: string; computed_at: string; simulations: number };
  outcome: { home_win: number; draw: number; away_win: number };
  goals: { three_plus: number };
  both_score: number;
  first_goal: { home: number; away: number; none: number };
}

export interface SampleExtras {
  colors: { home: { primary: string; secondary: string }; away: { primary: string; secondary: string } };
  logos: { home: string; away: string };
}

const pct = (value: number): number => Math.round(value * 100);

const BRAND = { accent: "#2EA537", logo: "brand/checkmatch-logo.png", mark: "brand/checkmatch-mark.png", handle: "@checkmatch_tr" };

/** Yer tutucu siluet: betrix `Photo.processingMeta` biçiminde oransal yüz kutusu ve kırpma önerisi. */
const placeholderPhoto = (side: "home" | "away"): ReelPhoto => ({
  src: "placeholders/silhouette.svg",
  aspect: 0.75,
  side,
  focus: { x: 0.5, y: 0.2 },
  faces: [{ x: 0.37, y: 0.09, width: 0.26, height: 0.2 }],
  crops: { vertical: { x: 0, y: 0, width: 1, height: 1 }, square: { x: 0, y: 0, width: 1, height: 0.75 } },
});

const PHOTOS = { "home-1": placeholderPhoto("home"), "away-1": placeholderPhoto("away") };
const BOTH = { photoIds: ["home-1", "away-1"] };
const NONE = { photoIds: [] as string[] };

export function buildSampleScript(sample: ContractSample, extras: SampleExtras): ReelScript {
  const { home, away } = sample.teams;
  const outcome = sample.outcome;
  const [dotsHome = 0, dotsDraw = 0, dotsAway = 0] = splitDots([outcome.home_win, outcome.draw, outcome.away_win], 1000);
  const leader = [
    { share: outcome.home_win, subject: home.name, statement: `${home.name} kazanır` },
    { share: outcome.draw, subject: "Beraberlik", statement: "Maç beraber biter" },
    { share: outcome.away_win, subject: away.name, statement: `${away.name} kazanır` },
  ].sort((a, b) => b.share - a.share)[0];
  if (!leader) throw new Error("Sonuç yok.");
  const leaderPercent = pct(leader.share);
  const perDot = formatInt(Math.round(sample.model.simulations / 1000));
  const simulations = spokenThousands(sample.model.simulations);
  const hits = Math.round(leaderPercent / 10);

  const script: ReelScript = {
    meta: {
      match: { id: sample.match.id, kickoffUtc: sample.match.kickoff_utc, round: sample.match.league.round },
      league: { id: sample.match.league.id, name: sample.match.league.name },
      teams: {
        home: { id: home.id, name: home.name, logo: extras.logos.home, colors: extras.colors.home },
        away: { id: away.id, name: away.name, logo: extras.logos.away, colors: extras.colors.away },
      },
      snapshot: { version: 1, contractVersion: sample.contract_version, modelVersion: sample.model.version, computedAt: sample.model.computed_at },
    },
    brand: BRAND,
    photos: PHOTOS,
    scenes: [
      { type: "K0_COVER", durationInFrames: 15, headline: null, caption: null, assets: BOTH, data: { seriesLabel: "Maç Günü" } },
      { type: "K1_LOGO", durationInFrames: 30, headline: null, caption: null, assets: NONE, data: {} },
      {
        type: "M1_HOOK", durationInFrames: 180, headline: { line1: "Bu akşamki maçı", line2: `${simulations} kez oynattık.` },
        caption: `Her nokta ${perDot} simülasyon.`, assets: BOTH, data: { simulations: sample.model.simulations },
      },
      {
        type: "M3_WINNER", durationInFrames: 240, headline: { line1: "Bu maçta", line2: "kim kazanır?" },
        caption: `1 nokta = ${perDot} simülasyon. Toplam ${simulations} maç.`, assets: NONE,
        data: { home: pct(outcome.home_win), draw: pct(outcome.draw), away: pct(outcome.away_win), dots: { home: dotsHome, draw: dotsDraw, away: dotsAway } },
      },
      {
        type: "M4_GOALS", durationInFrames: 180, headline: { line1: "Gollü", line2: "maç mı?" }, caption: `İki takımın da gol bulma olasılığı %${pct(sample.both_score)}.`, assets: NONE,
        data: { percent: pct(sample.goals.three_plus), label: "3 ve üzeri gol olasılığı" },
      },
      {
        type: "M6_FIRST_GOAL", durationInFrames: 180, headline: { line1: "İlk gol", line2: "kimden?" }, caption: `Gol olmama ihtimali %${pct(sample.first_goal.none)}.`, assets: NONE,
        data: { home: pct(sample.first_goal.home), away: pct(sample.first_goal.away), none: pct(sample.first_goal.none) },
      },
      {
        type: "K9_CHANCE_NOTE", durationInFrames: 180, headline: { line1: "İhtimal,", line2: "kesinlik değil." },
        caption: `Kalan ${10 - hits} maçta başka sonuç çıkıyor.`, assets: NONE,
        data: { percent: leaderPercent, hitsOfTen: hits, subject: leader.subject, statement: `${leader.statement}: %${leaderPercent} = 10 maçın yaklaşık ${ofTen(hits)}` },
      },
      { type: "K11_PROMPT", durationInFrames: 150, headline: { line1: "Senin skorun", line2: "ne?" }, caption: null, assets: NONE, data: { prompt: "Yorumlara yaz." } },
      { type: "K12_CLOSE", durationInFrames: 60, headline: null, caption: null, assets: NONE, data: { handle: BRAND.handle } },
    ],
  };
  return reelScriptSchema.parse(script);
}
