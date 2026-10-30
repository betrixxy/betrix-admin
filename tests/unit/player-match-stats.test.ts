import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFixtureProduction } from "@/lib/calendar/production-map";
import { keeperConceded } from "@/lib/player-stats/keeper";
import { setPages, withPlayerSlide } from "@/lib/dashboard/set-pages";
import { playerPagePlan } from "@/lib/player-stats/plan";
import { assemblePlayerStatsFacts } from "@/lib/player-stats/assemble";
import { spotlightFact } from "@/lib/player-stats/facts";
import { defaultSpotlightId, TOP_MIN_MINUTES, topPlayers } from "@/lib/player-stats/picks";
import { highlightText, spotlightRows, statRows } from "@/lib/player-stats/rows";
import { playerDataSettlement, settledAt } from "@/lib/player-stats/settle";
import { withSportmonksXg } from "@/lib/player-stats/xg";
import { countedGoals, pickMvp, toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import { toPlayerMatchLines } from "@/lib/services/api-football/player-match-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { PlayerMatchLine, PlayerMatchNumbers, PlayerPosition } from "@/types/player-match-stats";
import { RAW_MILAN_BOLOGNA, SM_MILAN_BOLOGNA_IDS, SM_MILAN_BOLOGNA_LINEUP } from "../fixtures/api-football/player-match-stats";

/**
 * Oyuncu İstatistikleri kuralları (2026-10-30): mevki önceliği + yedek, eksik veri satır düşürür (0 yazılmaz),
 * A'nın varsayılanı Maç Sonucu MVP'si (aynı fonksiyon), B'de ≥ 30 dk ve puan eşitliğinde dakika, xG yalnızca
 * Sportmonks dakikası birebir tutarsa, olgu kuralları, veri kesinleşmedi durumu, carousel kapsamı.
 */

const LATER = new Date("2026-10-30T12:00:00Z");

const EMPTY: PlayerMatchNumbers = {
  goals: null, assists: null, shotsTotal: null, shotsOn: null, keyPasses: null, passesTotal: null, passesAccurate: null, dribblesAttempts: null,
  dribblesSuccess: null, duelsTotal: null, duelsWon: null, tackles: null, interceptions: null, blocks: null, saves: null, conceded: null, penaltySaved: null, foulsDrawn: null,
};

function line(id: number, position: PlayerPosition | null, numbers: Partial<PlayerMatchNumbers>, extra: Partial<PlayerMatchLine> = {}): PlayerMatchLine {
  return { playerId: id, name: `P. Oyuncu${id}`, side: "HOME", teamId: 1, position, minutes: 90, rating: 7, numbers: { ...EMPTY, ...numbers }, xg: null, ...extra };
}

const keys = (l: PlayerMatchLine) => statRows(l).map((row) => row.key);

describe("mevki önceliği ve eksik veri", () => {
  it("forvet: gol, asist, şut, xG… sırasıyla; API'de olmayan büyük fırsat / dokunuş düşer, yedekten sıradaki gelir", () => {
    const forward = line(1, "F", { goals: 2, assists: 1, shotsTotal: 4, shotsOn: 3, dribblesAttempts: 3, dribblesSuccess: 2, keyPasses: 1, duelsTotal: 10, duelsWon: 6, passesTotal: 20, passesAccurate: 15, foulsDrawn: 2 }, { xg: 1.2 });
    assert.deepEqual(keys(forward), ["goals", "assists", "shots", "xg", "dribbles", "keyPasses", "duels", "passAccuracy"]);
  });

  it("defans: top kesme, ikili mücadele %, pas isabeti %, blok; top uzaklaştırma / hava topu düşer → yedek (top çalma…)", () => {
    const defender = line(2, "D", { interceptions: 3, duelsTotal: 8, duelsWon: 6, passesTotal: 50, passesAccurate: 45, blocks: 2, tackles: 4, goals: 0, assists: 0 });
    assert.deepEqual(keys(defender).slice(0, 6), ["interceptions", "duels", "passAccuracy", "blocks", "tackles", "goals"]);
  });

  it("orta saha / defans gol attıysa gol satırı başa gelir", () => {
    assert.equal(keys(line(3, "M", { goals: 2, assists: 0, keyPasses: 1 }))[0], "goals");
    assert.notEqual(keys(line(4, "M", { goals: 0, assists: 1, keyPasses: 1 }))[0], "goals");
  });

  it("kaleci: yenilen gol boşsa (sağlayıcı null) satır düşer — 0 yazılmaz; penaltı kurtarışı yalnızca olduysa", () => {
    const keeper = line(5, "G", { saves: 4, conceded: null, penaltySaved: 0, passesTotal: 30, passesAccurate: 20 });
    assert.deepEqual(keys(keeper), ["saves", "passAccuracy", "passes"]);
    assert.deepEqual(keys(line(6, "G", { saves: 4, conceded: 0, penaltySaved: 1 })), ["saves", "conceded", "penaltySaved"]);
  });

  it("hiç denemesi olmayan oran satırı (0/0 şut, 0 pas) yazılmaz; gerçek sıfır sayım yazılır", () => {
    const rows = statRows(line(7, "F", { goals: 0, shotsTotal: 0, shotsOn: 0, passesTotal: 0, passesAccurate: 0, dribblesAttempts: 0, dribblesSuccess: 0 }));
    assert.deepEqual(rows.map((row) => row.key), ["goals"]);
    assert.equal(rows[0]?.value, "0");
  });

  it("kahraman: ilk 2–3 SIFIR OLMAYAN satır (6+ satırda 3); sıfır satır kompakt listede kalır", () => {
    const l = line(8, "F", { goals: 0, assists: 1, shotsTotal: 2, shotsOn: 1, keyPasses: 2, dribblesAttempts: 2, dribblesSuccess: 1, duelsTotal: 5, duelsWon: 2 }, { xg: 0.3 });
    const { hero, rows } = spotlightRows(l);
    assert.deepEqual(hero.map((row) => row.key), ["assists", "shots", "xg"]);
    assert.ok(rows.some((row) => row.key === "goals"));
  });

  it("gerçek maçta pas isabeti = isabetli pas SAYISI / pas (API-Football maç ucu); xG Sportmonks kaynaklı", () => {
    const facts = assemblePlayerStatsFacts(RAW_MILAN_BOLOGNA, LATER, { players: SM_MILAN_BOLOGNA_LINEUP, ids: SM_MILAN_BOLOGNA_IDS });
    const mbangula = facts?.lines.find((l) => l.playerId === 346866);
    assert.ok(mbangula);
    const rows = statRows(mbangula);
    assert.equal(rows.find((row) => row.key === "passAccuracy")?.value, "%92");
    assert.equal(rows.find((row) => row.key === "xg")?.source, "SPORTMONKS");
    assert.equal(highlightText(mbangula), "3 gol · 3/4 isabetli şut");
  });
});

describe("oyuncu seçimi", () => {
  it("A'nın varsayılanı Maç Sonucu'nun MAÇIN OYUNCUSU kuralıyla AYNI (Milan 2-4 Bologna → Mbangula)", () => {
    const facts = toMatchResultFacts(RAW_MILAN_BOLOGNA);
    assert.ok(facts);
    const mvp = pickMvp(RAW_MILAN_BOLOGNA, facts.outcome, countedGoals(RAW_MILAN_BOLOGNA.events));
    assert.equal(defaultSpotlightId(facts), mvp?.playerId);
    assert.equal(defaultSpotlightId(facts), 346866);
  });

  it("beraberlikte iki takımdan en yüksek puan (Maç Sonucu kuralı)", () => {
    const draw: ApiFootballFixtureResultRaw = { ...RAW_MILAN_BOLOGNA, goals: { home: 2, away: 2 }, teams: { home: { ...RAW_MILAN_BOLOGNA.teams.home, winner: null }, away: { ...RAW_MILAN_BOLOGNA.teams.away, winner: null } } };
    const facts = toMatchResultFacts(draw);
    assert.equal(facts?.outcome, "DRAW");
    assert.equal(defaultSpotlightId(facts ?? { mvp: null }), 346866);
  });

  it(`B: en az ${TOP_MIN_MINUTES} dakika; puan eşitliğinde dakikası fazla olan önce`, () => {
    const lines = [line(1, "F", {}, { rating: 8.4, minutes: 25 }), line(2, "M", {}, { rating: 7.5, minutes: 60 }), line(3, "D", {}, { rating: 7.5, minutes: 90 }), line(4, "G", {}, { rating: null })];
    assert.deepEqual(topPlayers(lines, 3).map((l) => l.playerId), [3, 2]);
    assert.ok(topPlayers(lines, 3).every((l) => (l.minutes ?? 0) >= TOP_MIN_MINUTES));
  });

  it("gerçek maçta B (5): Mbangula, Cissè, Odgaard, Tomori, Zortea — 3 dk oynayan Comotto yok", () => {
    const lines = toPlayerMatchLines(RAW_MILAN_BOLOGNA);
    assert.deepEqual(topPlayers(lines, 5).map((l) => l.name), ["S. Mbangula", "A. Cissè", "J. Odgaard", "F. Tomori", "N. Zortea"]);
  });
});

describe("xG eşleşmesi", () => {
  const sm = (name: string, minutes: number | null, xg: number | null, teamId = 10) => ({ teamId, name, jersey: null, minutes, xg });
  const ids = { home: 10, away: 20 };

  it("aynı takım + ad + dakika birebir → xG; dakika farklı → yok (tahmin edilmez)", () => {
    const base = line(1, "F", {}, { name: "S. Mbangula", minutes: 90 });
    assert.equal(withSportmonksXg([base], [sm("Samuel Mbangula", 90, 0.87)], ids).lines[0]?.xg, 0.87);
    assert.equal(withSportmonksXg([base], [sm("Samuel Mbangula", 89, 0.87)], ids).lines[0]?.xg, null);
    assert.equal(withSportmonksXg([base], [sm("Samuel Mbangula", 90, 0.87, 20)], ids).lines[0]?.xg, null);
    assert.equal(withSportmonksXg([base], [sm("Samuel Mbangula", 90, null)], ids).lines[0]?.xg, null);
  });

  it("gerçek maç: Tomori'de iki kaynağın dakikası farklı (45 ↔ 46) → xG yok; Mbangula 0,8655", () => {
    const facts = assemblePlayerStatsFacts(RAW_MILAN_BOLOGNA, LATER, { players: SM_MILAN_BOLOGNA_LINEUP, ids: SM_MILAN_BOLOGNA_IDS });
    assert.equal(facts?.lines.find((l) => l.name === "F. Tomori")?.xg, null);
    assert.equal(facts?.lines.find((l) => l.name === "S. Mbangula")?.xg, 0.8655);
    assert.equal(facts?.xgMatched, 10);
  });
});

describe("olgu satırı", () => {
  const all = [line(1, "F", { goals: 3, shotsTotal: 4 }), line(2, "M", { keyPasses: 4 }), line(3, "D", { interceptions: 5 }), line(4, "D", { interceptions: 5 }), line(5, "G", { saves: 6, conceded: 0 })];

  it("çok gol → 'N şutta M gol' (3 golde hat-trick öneki)", () => {
    assert.equal(spotlightFact(all[0]!, all), "Hat-trick · 4 şutta 3 gol");
    assert.equal(spotlightFact(line(9, "F", { goals: 2, shotsTotal: 2 }), all), "2 şutta 2 gol");
  });

  it("maçın tek lideri (≥ 3) → olgu; eşitlik lider saymaz", () => {
    assert.equal(spotlightFact(all[1]!, all), "Maçın en çok kilit pas veren oyuncusu (4)");
    assert.equal(spotlightFact(all[2]!, all), null);
  });

  it("kaleci: tek lider kurtarış; gol yemediyse ve lider değilse 'Gol yemedi'", () => {
    assert.equal(spotlightFact(all[4]!, all), "Maçın en çok kurtarış yapan oyuncusu (6)");
    assert.equal(spotlightFact(line(6, "G", { saves: 2, conceded: 0 }), all), "Gol yemedi · 2 kurtarış");
    assert.equal(spotlightFact(line(7, "G", { saves: 2, conceded: null }), all), null);
  });

  it("pas isabeti ≥ %90 ve ≥ 30 pas", () => {
    assert.equal(spotlightFact(line(8, "M", { passesTotal: 54, passesAccurate: 50 }), all), "54 pasta %93 isabet");
  });
});

describe("veri kesinleşmedi", () => {
  const raw = RAW_MILAN_BOLOGNA;
  const lines = toPlayerMatchLines(raw);

  it("maçtan yeterince sonra, iki takımda puanlar tam → kesinleşti", () => {
    assert.deepEqual(playerDataSettlement({ kickoffUtc: raw.fixture.date, statusShort: "FT", lines, now: LATER }), { settled: true });
  });

  it("maç yeni bitti → kesinleşmedi (en erken saat yazılır)", () => {
    const now = new Date(Date.parse(raw.fixture.date) + 120 * 60 * 1000);
    const result = playerDataSettlement({ kickoffUtc: raw.fixture.date, statusShort: "FT", lines, now });
    assert.equal(result.settled, false);
    assert.ok(now < settledAt(raw.fixture.date, "FT"));
  });

  it("oyuncu bloğu boş ya da puanlar eksik → kesinleşmedi", () => {
    assert.equal(playerDataSettlement({ kickoffUtc: raw.fixture.date, statusShort: "FT", lines: [], now: LATER }).settled, false);
    const unrated = lines.map((l, index) => (l.side === "AWAY" && index % 2 === 0 ? { ...l, rating: null } : l));
    const result = playerDataSettlement({ kickoffUtc: raw.fixture.date, statusShort: "FT", lines: unrated, now: LATER });
    assert.equal(result.settled, false);
    assert.match(result.settled ? "" : result.reason, /deplasman/);
  });

  it("assemble: puanlar boşsa facts kesinleşmemiş döner", () => {
    const empty = { ...raw, players: raw.players.map((team) => ({ ...team, players: team.players.map((p) => ({ ...p, statistics: p.statistics.map((s) => ({ ...s, games: { ...s.games, rating: null } })) })) })) };
    assert.equal(assemblePlayerStatsFacts(empty, LATER, null)?.settlement.settled, false);
  });
});

describe("kart ve carousel kapsamı", () => {
  it("Maç Sonucu carousel'i 03 oyuncu sayfasıyla Oyuncu İstatistikleri'ni de karşılar; eski 01+02 carousel yalnızca İstatistikler", () => {
    const pages = { carousel: [{ url: "/a", label: "01" }, { url: "/b", label: "02" }, { url: "/c", label: "03" }], pages: ["MATCH_RESULT", "MATCH_STATS", "PLAYER_STATS"] };
    assert.deepEqual(setPages("MATCH_RESULT", pages), ["MATCH_RESULT", "MATCH_STATS", "PLAYER_STATS"]);
    assert.deepEqual(setPages("MATCH_RESULT", { carousel: pages.carousel.slice(0, 2) }), ["MATCH_RESULT", "MATCH_STATS"]);
    assert.deepEqual(setPages("MATCH_RESULT", { carousel: [{ url: "/a", label: "01" }, { url: "/c", label: "02" }], pages: ["MATCH_RESULT", "PLAYER_STATS"] }), ["MATCH_RESULT", "PLAYER_STATS"]);
    const production = buildFixtureProduction([{ id: "r", fixtureId: "f", status: "DRAFT", contentType: "MATCH_RESULT", resultImageUrl: "/a", publishAt: null, renderOptions: pages }]).get("f") ?? {};
    assert.equal(production.PLAYER_STATS?.status, "draft");
  });
});

describe("kaleci: yenilen gol maç olaylarından", () => {
  const raw = RAW_MILAN_BOLOGNA;
  const MILAN = raw.teams.home.id;
  const BOLOGNA = raw.teams.away.id;
  const goal = (minute: number, teamId: number, detail = "Normal Goal") => ({ time: { elapsed: minute, extra: null }, team: { id: teamId }, player: { id: 1, name: "G" }, assist: null, type: "Goal", detail, comments: null });
  const subst = (minute: number, teamId: number, out: number, into: number) => ({ time: { elapsed: minute, extra: null }, team: { id: teamId }, player: { id: out, name: "Out" }, assist: { id: into, name: "In" }, type: "subst", detail: "Substitution 1", comments: null });

  it("90 dk oynayan kaleci: rakibin bütün golleri, kendi kalesine gol dahil (Maignan 4, Skorupski 2)", () => {
    assert.equal(keeperConceded(raw, 22221, MILAN), 4);
    assert.equal(keeperConceded(raw, 2998, BOLOGNA), 2);
    const lines = toPlayerMatchLines(raw);
    assert.equal(lines.find((l) => l.playerId === 22221)?.numbers.conceded, 4);
    assert.equal(lines.find((l) => l.playerId === 2998)?.numbers.conceded, 2);
  });

  it("oyundan çıkan kaleci yalnızca çıkmadan önceki golleri, sonradan giren yalnızca sonrakileri yer", () => {
    const events = [goal(10, BOLOGNA), subst(50, MILAN, 22221, 999), goal(50, BOLOGNA), goal(70, MILAN), goal(80, BOLOGNA, "Own Goal")];
    const custom = { ...raw, events };
    assert.equal(keeperConceded(custom, 22221, MILAN), 1);
    assert.equal(keeperConceded(custom, 999, MILAN), 2);
  });

  it("kaçan penaltı ve VAR iptali sayılmaz; giriş olayı yoksa yedek kaleci için null (tahmin yok)", () => {
    const events = [goal(20, BOLOGNA, "Missed Penalty"), goal(30, BOLOGNA), { ...goal(30, BOLOGNA), type: "Var", detail: "Goal cancelled" }];
    const custom = { ...raw, events };
    assert.equal(keeperConceded(custom, 22221, MILAN), 0);
    assert.equal(keeperConceded(custom, 12345, MILAN), null);
  });
});

describe("03 seti kilitlemez (2026-10-30)", () => {
  const settled = { settled: true } as const;
  const waiting = { settled: false, reason: "Maç yeni bitti", readyAt: "2026-10-28T20:55:00.000Z" } as const;

  it("kesinleştiyse şimdi çizilir; kesinleşmediyse varsayılan 'hazır olunca ekle' (01 + 02 şimdi, 03 bekler)", () => {
    assert.deepEqual(playerPagePlan(true, settled, "WHEN_READY"), { action: "RENDER", provisional: false });
    assert.deepEqual(playerPagePlan(true, waiting, "WHEN_READY"), { action: "DEFER", reason: "Maç yeni bitti", readyAt: "2026-10-28T20:55:00.000Z" });
    assert.deepEqual(playerPagePlan(false, waiting, "WHEN_READY"), { action: "NONE" });
  });

  it("'şimdi üret (veriler değişebilir)' kesinleşmeden geçici olarak çizer", () => {
    assert.deepEqual(playerPagePlan(true, waiting, "NOW"), { action: "RENDER", provisional: true });
    assert.deepEqual(playerPagePlan(true, settled, "NOW"), { action: "RENDER", provisional: false });
  });

  it("geri sayım: süreye bağlı beklemede hazır olma anı verilir, puan eksikse verilmez", () => {
    const now = new Date(Date.parse(RAW_MILAN_BOLOGNA.fixture.date) + 60 * 60 * 1000);
    const early = playerDataSettlement({ kickoffUtc: RAW_MILAN_BOLOGNA.fixture.date, statusShort: "FT", lines: toPlayerMatchLines(RAW_MILAN_BOLOGNA), now });
    assert.equal(early.settled ? null : early.readyAt, settledAt(RAW_MILAN_BOLOGNA.fixture.date, "FT").toISOString());
    const empty = playerDataSettlement({ kickoffUtc: RAW_MILAN_BOLOGNA.fixture.date, statusShort: "FT", lines: [], now: LATER });
    assert.equal(empty.settled ? "x" : empty.readyAt, null);
  });

  it("sonradan ekleme: carousel'in sonuna, bekleyen kayıt silinir, kapsam PLAYER_STATS'ı da sayar", () => {
    const base = { url: "/01", label: "01 · Maç Sonucu" };
    const slide = { url: "/03", label: "03 · Maçın oyuncusu" };
    const withStats = { kind: "MATCH_RESULT", carousel: [base, { url: "/02", label: "02 · İstatistikler" }], pages: ["MATCH_RESULT", "MATCH_STATS"], pendingPlayerPage: { template: "SPOTLIGHT", count: null, playerId: 1 } };
    const next = withPlayerSlide(withStats, base, slide, false);
    assert.deepEqual((next.carousel as { url: string }[]).map((s) => s.url), ["/01", "/02", "/03"]);
    assert.equal(next.pendingPlayerPage, undefined);
    assert.equal(next.provisionalPlayerPage, undefined);
    assert.deepEqual(setPages("MATCH_RESULT", next), ["MATCH_RESULT", "MATCH_STATS", "PLAYER_STATS"]);
    const single = withPlayerSlide({ kind: "MATCH_RESULT", imageUrl: "/01" }, base, { ...slide, label: "02 · Maçın oyuncusu" }, true);
    assert.deepEqual((single.carousel as { url: string }[]).map((s) => s.url), ["/01", "/03"]);
    assert.equal(single.provisionalPlayerPage, true);
    assert.deepEqual(setPages("MATCH_RESULT", single), ["MATCH_RESULT", "PLAYER_STATS"]);
  });
});
