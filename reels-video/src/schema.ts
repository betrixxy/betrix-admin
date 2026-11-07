import { z } from "zod";

/**
 * ReelScript: videonun tek girdisi. Senaryo motoru bunu üretir, render bunu tüketir. Bilinmeyen alan hatadır.
 * Görsel yolları `public/` altına göredir.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Renk #RRGGBB olmalı.");
const percent = z.number().int().min(0).max(100);
const box = z.strictObject({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() });

/** Betrix `Photo.processingMeta` ile aynı oransal değerler (0–1). */
export const reelPhotoSchema = z.strictObject({
  src: z.string().min(1),
  aspect: z.number().positive(),
  side: z.enum(["home", "away"]),
  focus: z.strictObject({ x: z.number(), y: z.number() }),
  faces: z.array(box),
  crops: z.strictObject({ vertical: box, square: box }),
});

const team = z.strictObject({
  id: z.number().int(),
  name: z.string().min(1),
  shortName: z.string().min(1),
  logo: z.string().min(1),
  colors: z.strictObject({ primary: hex, secondary: hex }),
});

/** Seslendirme: ekrandaki maddelerden uzun, rakamlar yazıyla, her cümle veri anahtarlarına bağlı (`story/claims.ts::say`). */
export const voiceLineSchema = z.strictObject({ id: z.string(), template: z.string(), text: z.string().min(1), sources: z.array(z.string()).min(1) });
export const voiceoverSchema = z.strictObject({ text: z.string().min(1), lines: z.array(voiceLineSchema).min(1) });

const sceneBase = {
  durationInFrames: z.number().int().positive(),
  /** Akıştaki her sahnede dolu; null yalnız akış dışı eski sahnelerde. Boşsa render durur (`story/readability.ts`). */
  voiceover: voiceoverSchema.nullable(),
  headline: z.strictObject({ line1: z.string().min(1), line2: z.string().min(1) }).nullable(),
  caption: z.string().nullable(),
  assets: z.strictObject({ photoIds: z.array(z.string()) }),
};
const scene = <T extends string, D extends z.ZodType>(type: T, data: D) => z.strictObject({ type: z.literal(type), ...sceneBase, data });

const side = z.enum(["home", "away"]);
const pair = <T extends z.ZodType>(value: T) => z.strictObject({ home: value, away: value });

export const compareRowSchema = z.strictObject({
  key: z.string(),
  label: z.string(),
  home: z.string(),
  away: z.string(),
  /** Üstün taraf; eşitse null. */
  better: side.nullable(),
});

/** Veri sahnesi şablonu: soru başlığı + büyük ana rakam + 2–4 destek istatistiği. Simülasyon rozeti HUD'dadır (N veriden). */
const heroSchema = z.strictObject({
  value: z.string().min(1),
  /** Sayaç için; skor gibi yüzde olmayan rakamda null. */
  percent: percent.nullable(),
  label: z.string().min(1),
  side: side.or(z.literal("draw")).nullable(),
});
const supportSchema = z.strictObject({ key: z.string(), value: z.string().min(1), label: z.string().min(1), side: side.or(z.literal("draw")).nullable() });
const vizSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("none") }),
  z.strictObject({ kind: z.literal("dots"), home: z.number().int(), draw: z.number().int(), away: z.number().int() }),
  z.strictObject({ kind: z.literal("split"), parts: z.array(z.strictObject({ label: z.string(), percent, side: side.or(z.literal("draw")).nullable() })).min(2) }),
  z.strictObject({ kind: z.literal("ladder"), steps: z.array(z.strictObject({ label: z.string(), percent })).length(4), bars: z.array(z.strictObject({ label: z.string(), percent })).min(5) }),
]);
/** Yorum cümlesi: rakamlar kodla eklenir, her cümle veri anahtarlarına bağlıdır (`story/claims.ts`). */
export const reasonSchema = z.strictObject({ id: z.string(), template: z.string(), text: z.string().min(1), sources: z.array(z.string()).min(1), figures: z.array(z.string()) });
const reasons = z.array(reasonSchema);
const questionData = z.strictObject({ hero: heroSchema, supports: z.array(supportSchema).min(2).max(4), viz: vizSchema, focus: side.nullable(), reasons: reasons.max(2) });

export const QUESTION_SCENE_TYPES = ["Q01_WINNER", "Q02_POINTS", "Q03_COMFORT", "Q04_GOALS", "Q05_BOTH_SCORE", "Q06_TEAM_GOALS", "Q07_CLEAN_WIN", "Q08_HT_LEAD", "Q09_HT_GOAL", "Q10_HOT_HALF", "Q11_COMEBACK", "Q12_FIRST_GOAL", "Q13_PRESSURE", "Q14_CARDS", "Q15_PENALTY", "Q16_SCORE", "Q17_SCORER"] as const;

const standingLine = z.strictObject({ rank: z.number().int(), points: z.number().int(), played: z.number().int(), goalsDiff: z.number().int() });
const formBlock = z.strictObject({
  last5: z.array(z.enum(["G", "B", "M"])).min(3),
  venueLabel: z.string(),
  venue: z.strictObject({ win: z.number().int(), draw: z.number().int(), lose: z.number().int(), goalsFor: z.number().int(), goalsAgainst: z.number().int() }),
  streaks: z.strictObject({ wins: z.number().int(), draws: z.number().int(), loses: z.number().int() }),
});
const absence = z.strictObject({ name: z.string(), status: z.enum(["injured", "suspended", "doubtful"]), minutes: z.string().nullable(), goals: z.number().int().nullable(), assists: z.number().int().nullable(), share: z.string().nullable() });
const teamAnalysis = z.strictObject({
  side,
  stats: z.array(z.strictObject({ key: z.string(), value: z.string(), label: z.string() })).min(2).max(5),
  /** Son maç verisi yoksa yedek: en sık diziliş. */
  formation: z.strictObject({ name: z.string(), played: z.number().int() }).nullable(),
  lineup: z.strictObject({
    formation: z.string(),
    source: z.enum(["last_match", "editor"]),
    sourceLabel: z.string().min(1),
    /** Kaleciden forvete 11 yer. `name` null: "?" görünür. */
    slots: z.array(z.strictObject({ line: z.number().int(), index: z.number().int(), lineSize: z.number().int(), number: z.string().nullable(), name: z.string().nullable() })).length(11),
  }).nullable(),
  /** Tahtadaki yön: lig ortalamasıyla kıyas. */
  board: z.strictObject({ attack: z.enum(["strong", "weak"]).nullable(), defence: z.enum(["strong", "weak"]).nullable() }),
  points: z.array(z.strictObject({ label: z.string(), reason: reasonSchema })).length(2),
});

const duelPlayer = z.strictObject({ name: z.string().min(1), team: z.string().min(1), logo: z.string().min(1) });

export const reelSceneSchema = z.discriminatedUnion("type", [
  scene("Q01_WINNER", questionData), scene("Q02_POINTS", questionData), scene("Q03_COMFORT", questionData), scene("Q04_GOALS", questionData),
  scene("Q05_BOTH_SCORE", questionData), scene("Q06_TEAM_GOALS", questionData), scene("Q07_CLEAN_WIN", questionData), scene("Q08_HT_LEAD", questionData),
  scene("Q09_HT_GOAL", questionData), scene("Q10_HOT_HALF", questionData), scene("Q11_COMEBACK", questionData), scene("Q12_FIRST_GOAL", questionData),
  scene("Q13_PRESSURE", questionData), scene("Q14_CARDS", questionData), scene("Q15_PENALTY", questionData), scene("Q16_SCORE", questionData), scene("Q17_SCORER", questionData),
  scene("M02_MONTE_CARLO", z.strictObject({
    simulations: z.number().int().positive(),
    shares: z.strictObject({ home: z.number(), draw: z.number(), away: z.number() }),
    final: z.strictObject({ home: percent, draw: percent, away: percent }),
    /** Skorborddan akan örnek maçlar: sonuç payları simülasyonla aynı dağılımdan. */
    samples: z.array(z.strictObject({ home: z.number().int(), away: z.number().int() })).min(8),
  })),
  scene("C01_STORY", z.strictObject({ home: standingLine, away: standingLine, reasons: reasons.min(1).max(2) })),
  scene("C02_FORM", z.strictObject({ home: formBlock, away: formBlock, reasons: reasons.max(1) })),
  scene("C03_ABSENCES", z.strictObject({ home: z.array(absence).max(3), away: z.array(absence).max(3), reasons: reasons.max(1) })),
  scene("C04_TEAM_HOME", teamAnalysis), scene("C05_TEAM_AWAY", teamAnalysis),
  scene("C06_MINUTES", z.strictObject({ slots: z.array(z.string()).length(6), rows: z.array(z.strictObject({ side, label: z.string(), cells: z.array(z.number().int()).length(6) })).length(4), reasons: reasons.max(2) })),
  scene("C07_KEY", z.strictObject({ metric: z.string(), focus: z.enum(["attack", "defence"]), leader: side, leaderValue: z.string(), otherValue: z.string(), reasons: reasons.max(1), analystNote: z.string().nullable() })),
  scene("C08_UPSET", z.strictObject({ side, team: z.string(), hero: z.strictObject({ value: z.string(), percent }), reasons: reasons.min(1).max(3) })),
  scene("C09_SCENARIO", z.strictObject({ items: reasons.length(3), analystNote: z.string().nullable() })),
  scene("S17_CLOSE", z.strictObject({ options: z.array(z.string()).length(3), prompt: z.string(), save: z.string(), handle: z.string() })),
  scene("S18_ENGAGE", z.strictObject({ calls: z.array(z.enum(["like", "comment", "share", "save"])).length(4), prompt: z.string(), more: z.string(), handle: z.string() })),
  scene("P01_DUEL", z.strictObject({ home: duelPlayer, away: duelPlayer, rows: z.array(compareRowSchema).min(5), scope: z.string() })),
  scene("P02_VS_OPPONENT", z.strictObject({
    side,
    player: z.string().min(1),
    opponent: z.string().min(1),
    /** Eski → yeni. Başka kulüpteyken oynanan maçta `otherClub` true: kulüp adı ve arması görünür. */
    timeline: z.array(z.strictObject({ date: z.string(), club: z.string(), clubLogo: z.string().nullable(), otherClub: z.boolean(), score: z.string(), goals: z.number().int(), assists: z.number().int() })).min(3),
    totals: z.strictObject({ matches: z.number().int(), goals: z.number().int(), assists: z.number().int() }),
    per90: z.strictObject({ opponent: z.string(), season: z.string() }),
    scope: z.string(),
  })),
  scene("S01_COVER", z.strictObject({ seriesLabel: z.string(), league: z.string(), round: z.string().nullable(), dateLabel: z.string(), venue: z.string().nullable() })),
  scene("S02_LOGO", z.strictObject({})),
  scene("S03_HOOK", z.strictObject({ simulations: z.number().int().positive(), wins: z.strictObject({ home: z.number().int(), draw: z.number().int(), away: z.number().int() }) })),
  scene("S04_COMPARE", z.strictObject({ form: pair(z.array(z.enum(["G", "B", "M"]))), rows: z.array(compareRowSchema).min(1), summary: z.string() })),
  scene("S05_H2H", z.strictObject({
    matches: z.array(z.strictObject({ date: z.string(), home: z.string(), away: z.string(), score: z.string() })).min(1),
    avgGoals: z.number(), played: z.number().int(), homeWins: z.number().int(), draws: z.number().int(), awayWins: z.number().int(),
  })),
  scene("S07_KEY_GAP", z.strictObject({ metric: z.string(), leader: side, leaderValue: z.string(), otherValue: z.string(), sentence: z.string() })),
  scene("S11_FATIGUE", z.strictObject({ days: pair(z.number().int().nullable()), sentence: z.string() })),
  scene("S14_TRACK_RECORD", z.strictObject({
    focus: z.strictObject({ range: z.string(), hitRate: percent, matches: z.number().int() }),
    buckets: z.array(z.strictObject({ range: z.string(), mid: percent, hitRate: percent, matches: z.number().int(), active: z.boolean() })).min(1),
  })),
  scene("S15_CHANCE", z.strictObject({ percent, hitsOfTen: z.number().int().min(0).max(10), statement: z.string() })),
  scene("S16_SUMMARY", z.strictObject({
    outcome: z.strictObject({ home: percent, draw: percent, away: percent }),
    threePlus: percent, bothScore: percent, firstGoal: z.strictObject({ home: percent, away: percent }),
    xg: pair(z.number()), h2hAvg: z.number().nullable(),
    question: z.string(), prompt: z.string(), handle: z.string(),
  })),
]);

export const DESIGN_DIRECTIONS = ["A", "B", "C", "D", "E"] as const;
/** Seçilen tema (11-03): D poster kimliği + analiz kartlarında tahta öğeleri. Diğer şablonlar duruyor, video okunurluk denetiminden geçirilmedi. */
export const ACTIVE_DESIGN = "D" as const;

export const reelScriptSchema = z.strictObject({
  /** Tasarım yönü: A Yayın, B Dergi, C Veri laboratuvarı, D Maç günü posteri + tahta (aktif), E Taktik tahtası. */
  design: z.enum(DESIGN_DIRECTIONS),
  meta: z.strictObject({
    match: z.strictObject({ id: z.number().int(), kickoffUtc: z.iso.datetime({ offset: true }), kickoffLabel: z.string(), round: z.string().nullable(), venue: z.string().nullable() }),
    league: z.strictObject({ id: z.number().int(), name: z.string().min(1) }),
    teams: z.strictObject({ home: team, away: team }),
    snapshot: z.strictObject({ version: z.number().int().positive(), contractVersion: z.string(), modelVersion: z.string(), computedAt: z.iso.datetime({ offset: true }), computedLabel: z.string(), simulations: z.number().int().positive(), squadCheckedAt: z.iso.datetime({ offset: true }).nullable() }),
  }),
  brand: z.strictObject({ accent: hex, logo: z.string().min(1), mark: z.string().min(1), handle: z.string().min(1) }),
  photos: z.record(z.string(), reelPhotoSchema),
  /** Sahne başına seslendirme klibi (sahne sırasıyla; null = sessiz). `frames` ölçülen ses süresi: kart süresi bundan kurulur. */
  voice: z.array(z.strictObject({ src: z.string().min(1), frames: z.number().int().positive() }).nullable()).optional(),
  /** Sahne türü → bulanık zemin fotoğrafı (`public/` altında). Kontrast denetimini geçemeyen sahnede verilmez. */
  backdrops: z.record(z.string(), z.string().min(1)).optional(),
  scenes: z.array(reelSceneSchema).min(1),
  /** Video açıklama metni: analist notunun tam hali burada. */
  description: z.string().min(1),
  /** Havuzda olup kullanılmayan sahneler ve nedeni: stüdyoda gösterilir. */
  disabled: z.array(z.strictObject({ type: z.string(), reason: z.string() })),
});

export type ReelScript = z.infer<typeof reelScriptSchema>;
export type ReelScene = z.infer<typeof reelSceneSchema>;
export type ReelSceneType = ReelScene["type"];
export type ReelPhoto = z.infer<typeof reelPhotoSchema>;
export type ReelTeam = z.infer<typeof team>;
export type ReelCropBox = z.infer<typeof box>;
export type CompareRow = z.infer<typeof compareRowSchema>;
export type QuestionData = z.infer<typeof questionData>;
export type ReasonData = z.infer<typeof reasonSchema>;
export type QuestionSceneType = (typeof QUESTION_SCENE_TYPES)[number];
export type DesignDirection = (typeof DESIGN_DIRECTIONS)[number];
