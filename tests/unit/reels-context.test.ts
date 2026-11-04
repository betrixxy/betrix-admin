import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { before, describe, it } from "node:test";
import { acceptPolishedClaims, analystNoteProblem, auditPolishedClaim } from "@/lib/reels/commentary";
import type { ReelContextDeps } from "@/lib/reels/context-data";
import { leagueGoalsAvg, longestRun, reelAbsenceStatus, reelGoalMinutes, sidelinedOn, reelTeamContext } from "@/lib/reels/context-rule";
import type { ApiFootballPlayerSeason } from "@/lib/services/api-football/player-season-types";
import type { TeamStatisticsRaw } from "@/lib/services/api-football/reel-context";
import type { MatchContext } from "../../reels-video/src/story/match-context";

/** Belgedeki örnek yanıt (API-Football 3.9.3, Manchester United 2019), yalnız kullanılan alanlar. */
const DOC_SAMPLE = {
  form: "WDLDWLDLDWLWDDWWDLWWLWLLDWWDWDWWWWDWDW",
  fixtures: { played: { home: 19, away: 19, total: 38 }, wins: { home: 10, away: 8, total: 18 }, draws: { home: 7, away: 5, total: 12 }, loses: { home: 2, away: 6, total: 8 } },
  goals: {
    for: { total: { home: 40, away: 26, total: 66 }, average: { home: "2.1", away: "1.4", total: "1.7" }, minute: { "0-15": { total: 4, percentage: "6.06%" }, "16-30": { total: 17, percentage: "25.76%" }, "31-45": { total: 11 }, "46-60": { total: 13 }, "61-75": { total: 10 }, "76-90": { total: 8 }, "91-105": { total: 3 }, "106-120": { total: null, percentage: null } } },
    against: { total: { home: 17, away: 19, total: 36 }, average: { home: "0.9", away: "1.0", total: "0.9" }, minute: { "0-15": { total: 6 }, "16-30": { total: 3 }, "31-45": { total: 7 }, "46-60": { total: 9 }, "61-75": { total: 3 }, "76-90": { total: 5 }, "91-105": { total: 3 }, "106-120": { total: null } } },
  },
  biggest: { streak: { wins: 4, draws: 2, loses: 2 } },
  clean_sheet: { home: 7, away: 6, total: 13 },
  failed_to_score: { home: 2, away: 6, total: 8 },
  lineups: [{ formation: "3-4-1-2", played: 4 }, { formation: "4-2-3-1", played: 32 }],
};

/** Bu modüller `lib/env.ts`'i yükler: yer tutucu değerler, gerçek istek yok, bütün kaynaklar enjekte. */
process.env.JWT_SECRET ??= "test-yer-tutucu-test-yer-tutucu-test-yer";
process.env.DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/yok";
let STATS: TeamStatisticsRaw;
let loadReelContext: typeof import("@/lib/reels/context-data").loadReelContext;
let polishReelClaims: typeof import("@/lib/services/anthropic/reel-commentary").polishReelClaims;
before(async () => {
  STATS = (await import("@/lib/services/api-football/reel-context")).teamStatisticsRawSchema.parse(DOC_SAMPLE);
  loadReelContext = (await import("@/lib/reels/context-data")).loadReelContext;
  polishReelClaims = (await import("@/lib/services/anthropic/reel-commentary")).polishReelClaims;
});

const player = (id: number, name: string, goals: number, assists: number, minutes = 900): ApiFootballPlayerSeason => ({ player: { id, name }, statistics: [{ team: { id: 10, name: "T" }, league: { id: 203, name: "L" }, games: { appearences: 10, minutes }, goals: { total: goals, assists } }] });
const ok = <T>(data: T) => ({ ok: true as const, data });

function deps(over: Partial<ReelContextDeps> = {}): ReelContextDeps {
  return {
    season: async () => ok({ current: 2026 }),
    standings: async () => ok([{ rank: 2, team: { id: 10 }, points: 20, goalsDiff: 8, all: { played: 11, goals: { for: 20, against: 10 } }, home: { played: 6, win: 4, draw: 1, lose: 1, goals: { for: 12, against: 5 } } }, { rank: 5, team: { id: 20 }, points: 17, goalsDiff: 2, all: { played: 11, goals: { for: 11, against: 9 } }, away: { played: 5, win: 2, draw: 1, lose: 2, goals: { for: 5, against: 6 } } }]),
    statistics: async () => ok(STATS),
    fixtureInjuries: async () => ok([{ player: { id: 1, name: "D. Costa", type: "Missing Fixture", reason: "Broken ankle" }, team: { id: 10 } }, { player: { id: 3, name: "A. Kurt", type: "Questionable", reason: "Knock" }, team: { id: 20 } }]),
    teamInjuries: async () => ok([]),
    sidelined: async () => ok([]),
    players: async (teamId) => ok(teamId === 10 ? [player(1, "D. Costa", 6, 2), player(2, "M. Yıldız", 2, 0)] : []),
    h2h: async () => ok({ matches: [{ kickoffUtc: "2026-01-01T00:00:00Z", homeTeamName: "A", awayTeamName: "B", homeGoals: 2, awayGoals: 1 }, { kickoffUtc: "2025-01-01T00:00:00Z", homeTeamName: "B", awayTeamName: "A", homeGoals: 0, awayGoals: 0 }], homeWins: 1, draws: 1, awayWins: 0 }),
    xg: async () => ok({ xgForAvg: 1.72, matchesSampled: 8 }),
    ...over,
  };
}
const PROJECT = { matchId: 900, leagueId: 203, homeTeamId: 10, homeName: "Ev", awayTeamId: 20, awayName: "Dış", kickoffUtc: new Date("2026-11-08T17:00:00Z") };
const NOW = new Date("2026-11-08T08:00:00Z");

describe("belge örneği", () => {
  it("gol ortalaması dizgi de olsa okunur, en çok kullanılan diziliş seçilir", () => {
    const team = reelTeamContext(STATS, undefined, "home", null);
    assert.equal(team.goals_for_avg, 1.7);
    assert.deepEqual(team.formation, { name: "4-2-3-1", played: 32 });
    assert.deepEqual(team.streaks, { wins: 4, draws: 2, loses: 2 });
    assert.equal(team.clean_sheet_pct, 34.2);
    assert.equal(team.failed_to_score_pct, 21.1);
  });
  it("dakika: 91–105 son dilime eklenir, golsüz dilim null değil 0", () => {
    assert.deepEqual(reelGoalMinutes(STATS.goals?.for), [4, 17, 11, 13, 10, 11]);
  });
  it("canlı yanıt: dilim toplamı sezon golünden biraz farklı olabilir, boş dilim 0", () => {
    const side = { total: { total: 9 }, minute: { "0-15": { total: 2 }, "16-30": { total: null }, "31-45": { total: 2 }, "46-60": { total: 1 }, "61-75": { total: 2 }, "76-90": { total: null }, "91-105": { total: null }, "106-120": { total: null } } };
    assert.deepEqual(reelGoalMinutes(side), [2, 0, 2, 1, 2, 0]);
  });
  it("canlı yanıt: seri form dizisinden, sağlayıcının biggest.streak alanından değil", () => {
    assert.equal(longestRun("DWLWDLLLLL", "L"), 5);
    const team = reelTeamContext({ ...STATS, form: "DWLWDLLLLL", biggest: { streak: { wins: 1, draws: 1, loses: 1 } } }, undefined, "home", null);
    assert.deepEqual(team.streaks, { wins: 1, draws: 1, loses: 5 });
    assert.equal(longestRun(null, "W"), 0);
  });
  it("dilim toplamı sezon golünü tutmuyorsa hepsi null: sıfır uydurulmaz", () => {
    const side = { total: { total: 70 }, minute: { "0-15": { total: 4 } } };
    assert.deepEqual(reelGoalMinutes(side), [null, null, null, null, null, null]);
    assert.deepEqual(reelGoalMinutes(undefined), [null, null, null, null, null, null]);
  });
});

describe("eksikler", () => {
  it("durum eşlemesi", () => {
    assert.equal(reelAbsenceStatus("Questionable", "Knock"), "doubtful");
    assert.equal(reelAbsenceStatus("Missing Fixture", "Broken ankle"), "injured");
    assert.equal(reelAbsenceStatus("Missing Fixture", "Suspended"), "suspended");
    assert.equal(reelAbsenceStatus("Missing Fixture", "Red Card"), "suspended");
    assert.equal(reelAbsenceStatus("Bilinmeyen", "x"), null);
    assert.equal(reelAbsenceStatus("Missing Fixture", "Off the roster"), null);
  });
  it("sidelined: yalnız maç gününü kapsayan, bitişi bilinen kayıt", () => {
    assert.equal(sidelinedOn([{ type: "Suspended", start: "2026-11-01", end: "2026-11-10" }], "2026-11-08"), "suspended");
    assert.equal(sidelinedOn([{ type: "Knee Injury", start: "2026-10-01", end: "2026-12-01" }], "2026-11-08"), "injured");
    assert.equal(sidelinedOn([{ type: "Knee Injury", start: "2024-01-01", end: "2024-02-01" }], "2026-11-08"), null);
    assert.equal(sidelinedOn([{ type: "Knee Injury", start: "2026-01-01", end: null }], "2026-11-08"), null);
  });
  it("takımdaki pay gol + asist toplamından; kart adı resmi addan değil", async () => {
    const { context } = await loadReelContext(PROJECT, deps(), NOW);
    const costa = context?.absences?.home[0];
    assert.equal(costa?.name, "Costa");
    assert.equal(costa?.involvement_pct, 80);
    assert.equal(costa?.minutes, 900);
    assert.equal(context?.absences?.away[0]?.status, "doubtful");
    assert.equal(context?.absences?.away[0]?.involvement_pct, null);
  });
  it("maç listesi boşsa takım + gün listesi; o da okunamazsa bölüm null, 'eksik yok' denmez", async () => {
    const calls: string[] = [];
    const empty = await loadReelContext(PROJECT, deps({ fixtureInjuries: async () => ok([]), teamInjuries: async (team, _season, day) => { calls.push(`${team}:${day}`); return ok([]); } }), NOW);
    assert.deepEqual(calls, ["10:2026-11-08", "20:2026-11-08"]);
    assert.deepEqual(empty.context?.absences, { home: [], away: [] });
    const failed = await loadReelContext(PROJECT, deps({ fixtureInjuries: async () => ({ ok: false, error: { message: "zaman aşımı" } }) }), NOW);
    assert.equal(failed.context?.absences, null);
    assert.match(failed.warnings.join(" "), /Eksikler: zaman aşımı/);
  });
});

describe("okuma paketi", () => {
  it("video şemasına uyar (tip düzeyinde), fetched_at taşır", async () => {
    const { context } = await loadReelContext(PROJECT, deps(), NOW);
    assert.ok(context);
    const typed: MatchContext = context;
    assert.equal(typed.fetched_at, NOW.toISOString());
    assert.equal(typed.source, "api-football");
    assert.equal(typed.standings.home?.rank, 2);
    assert.equal(typed.teams.home.venue?.win, 4);
    assert.equal(typed.teams.away.venue?.played, 5);
    assert.equal(typed.teams.home.xg_for_avg, 1.72);
    assert.equal(typed.h2h?.avg_goals, 1.5);
    assert.equal(typed.standings.league_goals_avg, leagueGoalsAvg([{ rank: 1, team: { id: 1 }, all: { played: 22, goals: { for: 31 } } }]));
  });
  it("az maçlık xG yazılmaz", async () => {
    const { context } = await loadReelContext(PROJECT, deps({ xg: async () => ok({ xgForAvg: 3, matchesSampled: 4 }) }), NOW);
    assert.equal(context?.teams.home.xg_for_avg, null);
  });
  it("istek sayısı raporlanır, takım başına sidelined sınırlı", async () => {
    const { requests } = await loadReelContext(PROJECT, deps(), NOW);
    assert.deepEqual(requests, { leagues: 1, standings: 1, "teams/statistics": 2, "fixtures/headtohead": 1, "players (sayfa başına)": 2, injuries: 1, sidelined: 2 });
  });
  it("hata dondurmayı durdurmaz: bölüm boş, uyarı var; iki takım istatistiği de yoksa paket yok", async () => {
    const partial = await loadReelContext(PROJECT, deps({ standings: async () => ({ ok: false, error: { message: "yok" } }) }), NOW);
    assert.equal(partial.context?.standings.home, null);
    assert.match(partial.warnings[0] ?? "", /Puan durumu/);
    const none = await loadReelContext(PROJECT, deps({ statistics: async () => ({ ok: false, error: { message: "yok" } }) }), NOW);
    assert.equal(none.context, null);
  });
  it("checkmatch verisi ve zamanlayıcı yok", () => {
    const source = readFileSync("src/lib/reels/context-data.ts", "utf8");
    assert.ok(!/reels-client|checkmatch-core/u.test(source));
    assert.ok(!/lib\/reels|loadReelContext/u.test(readFileSync("src/app/api/internal/metrics/tick/route.ts", "utf8")));
  });
  it("dondurma ve analist notu bağlı", () => {
    const engine = readFileSync("src/lib/reels/reel-engine.ts", "utf8");
    assert.match(engine, /loadReelContext\(/);
    assert.match(engine, /contextFetchedAt/);
    assert.match(engine, /contentLanguageGate\(/);
  });
});

describe("LLM denetimi", () => {
  const template = "{home} maç başına {a} gol atıyor.";
  it("yuva korunur, rakam ve yeni iddia eklenemez", () => {
    assert.equal(auditPolishedClaim("Maç başına {a} gol atan {home} var.", template), null);
    assert.equal(auditPolishedClaim("{home} son 3 maçta {a} gol atıyor.", template), "rakam eklenmiş");
    assert.equal(auditPolishedClaim("{home} gol atıyor.", template), "yuvalar değişmiş");
    assert.equal(auditPolishedClaim("{home} {a} gol, bahis için iyi.", template), "bahis dili");
    assert.equal(auditPolishedClaim("{home} presle {a} gol atıyor.", template), "veride olmayan iddia");
    assert.match(auditPolishedClaim("{home} ile Icardi {a} gol atıyor.", template) ?? "", /yeni özel ad/);
    assert.equal(auditPolishedClaim(`${template} ${"çok ".repeat(10)}`, template), "uzun");
  });
  it("geçen alınır, geçemeyen atılır", () => {
    const result = acceptPolishedClaims([{ id: "a", template }], [{ id: "a", text: "{home} 9 gol {a}" }, { id: "b", text: "x" }]);
    assert.deepEqual(result.polished, {});
    assert.deepEqual(result.rejected.map((item) => item.reason), ["rakam eklenmiş", "bilinmeyen kimlik"]);
  });
  it("anahtar yoksa çağrı yapılmaz; yanıt denetimden geçer", async () => {
    const off = await polishReelClaims([{ id: "a", template }], { configured: () => false, client: () => { throw new Error("çağrılmamalı"); } });
    assert.equal(off.ok, false);
    const parse = async () => ({ stop_reason: "end_turn", parsed_output: { items: [{ id: "a", text: "Maç başına {a} gol atan {home} var." }] } });
    const done = await polishReelClaims([{ id: "a", template }], { configured: () => true, client: () => ({ messages: { parse } }) as never });
    assert.ok(done.ok);
    assert.deepEqual(done.data.polished, { a: "Maç başına {a} gol atan {home} var." });
  });
});

describe("analist notu", () => {
  it("en fazla 3 cümle, 280 karakter", () => {
    assert.equal(analystNoteProblem("Bir. İki. Üç."), null);
    assert.match(analystNoteProblem("Bir. İki. Üç. Dört.") ?? "", /3 cümle/);
    assert.match(analystNoteProblem("a".repeat(281)) ?? "", /280/);
  });
});
