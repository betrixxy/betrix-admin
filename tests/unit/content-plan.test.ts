import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatProductionSummary, summarizeProduction } from "@/lib/calendar/content-progress";
import { buildFixtureProduction, type ProductionRow } from "@/lib/calendar/production-map";
import { CONTENT_TYPES } from "@/lib/dashboard/content-types";
import { FIXTURE_ROW_COLUMNS, fixtureToRow, formatCountdown, groupRowsByDay, watchedToRow } from "@/lib/dashboard/fixture-row";
import { parsePlanCursor, planStartDay } from "@/lib/dashboard/plan-cursor";
import { apiFootballLeagueId, watchSnapshot } from "@/lib/dashboard/watched-snapshot";
import type { Fixture } from "@/types/sports";

const NOW = new Date("2026-10-17T12:00:00Z"); // İstanbul 15:00, Cumartesi
const MIN = 60 * 1000;

function fixture(id: number, kickoffUtc: string, statusShort = "NS", goals: [number | null, number | null] = [null, null]): Fixture {
  return {
    id: `api-football-${id}`,
    providerIds: { apiFootball: id },
    kickoffUtc,
    status: statusShort === "FT" ? "FT" : "SCHEDULED",
    homeTeam: { id: "549", name: "Beşiktaş", shortName: "BJK", primaryColorHex: "#000000", logoUrl: "https://media.api-sports.io/football/teams/549.png" },
    awayTeam: { id: "645", name: "Galatasaray", shortName: "GS", primaryColorHex: "#A90432", logoUrl: "https://media.api-sports.io/football/teams/645.png" },
    competition: { id: "super-lig", name: "Trendyol Süper Lig", shortName: "Süper Lig" },
    derbyIntensity: "NONE",
    progress: { statusShort, elapsed: null, homeGoals: goals[0], awayGoals: goals[1], penalty: null },
  };
}

describe("Maç satırı — ortak grid", () => {
  it("altı sabit sütun: saat/lig · ev · vs · deplasman · durum/sayaç · işlem", () => {
    const columns = /grid-cols-\[(.+)\]/.exec(FIXTURE_ROW_COLUMNS)?.[1]?.split("_") ?? [];
    assert.equal(columns.length, 6);
    assert.equal(columns.at(-1), "var(--fixture-row-actions)");
    // Ev ve deplasman eşit genişlikte — "vs" her satırda aynı yerde.
    assert.equal(columns[1], columns[3]);
  });

  it("biten maçta saat yerine skor, başlamamışta durum boş (sayaç istemcide)", () => {
    assert.deepEqual(fixtureToRow(fixture(1, "2026-10-16T17:00:00Z", "FT", [2, 1])).state, { kind: "finished", phase: "post_match", score: "2 – 1" });
    assert.equal(fixtureToRow(fixture(2, "2026-10-18T17:00:00Z")).state.kind, "upcoming");
  });
});

describe("Geri sayım", () => {
  it("24 saat içindeki maç: saat + dakika", () => {
    assert.equal(formatCountdown(135 * MIN), "2 sa 15 dk");
    assert.equal(formatCountdown(120 * MIN), "2 sa");
    assert.equal(formatCountdown(45 * MIN), "45 dk");
    assert.equal(formatCountdown(20 * 1000), "1 dk'dan az");
  });

  it("başlamış ya da 24 saatten uzak maçta alan boş", () => {
    assert.equal(formatCountdown(0), null);
    assert.equal(formatCountdown(-5 * MIN), null);
    assert.equal(formatCountdown(24 * 60 * MIN + 1), null);
  });
});

describe("Gün grupları", () => {
  it("İstanbul gününe göre; dün 'Biten maçlar' başlığıyla", () => {
    const rows = [fixture(1, "2026-10-16T17:00:00Z", "FT", [1, 0]), fixture(2, "2026-10-17T17:00:00Z"), fixture(3, "2026-10-17T21:30:00Z")].map(fixtureToRow);
    const groups = groupRowsByDay(rows, NOW);
    // 21:30Z = İstanbul 00:30 → ertesi gün.
    assert.deepEqual(groups.map((group) => [group.key, group.rows.length]), [["2026-10-16", 1], ["2026-10-17", 1], ["2026-10-18", 1]]);
    assert.match(groups[0]?.title ?? "", /^Dün · .* — Biten maçlar$/);
  });
});

describe("Yıldız anlık görüntüsü", () => {
  it("desteklenen ligde API-Football kimliği, tur bilgisi", () => {
    assert.equal(apiFootballLeagueId("super-lig"), 203);
    assert.equal(apiFootballLeagueId("848"), 848);
    assert.equal(apiFootballLeagueId("bilinmeyen"), null);
    const snapshot = watchSnapshot({ ...fixture(9, "2026-10-18T17:00:00Z"), details: { venueName: null, venueCity: null, referee: null, round: "Regular Season - 9" } as Fixture["details"] & object });
    assert.equal(snapshot.leagueId, 203);
    assert.equal(snapshot.round, "Regular Season - 9");
    assert.equal(snapshot.homeName, "Beşiktaş");
  });

  it("tazelenmeyen geçmiş maçta skor uydurulmaz", () => {
    const watched = { fixtureId: "api-football-9", kickoffUtc: new Date("2026-10-10T17:00:00Z"), homeName: "A", homeLogo: "", awayName: "B", awayLogo: "", leagueName: "L" };
    assert.deepEqual(watchedToRow(watched, undefined, NOW).state, { kind: "inactive", phase: null, label: "Durum alınamadı" });
    assert.equal(watchedToRow({ ...watched, kickoffUtc: new Date("2026-10-25T17:00:00Z") }, undefined, NOW).state.kind, "upcoming");
  });
});

describe("İçerik paketi ilerlemesi", () => {
  const row = (id: string, contentType: string, status: string, resultImageUrl: string | null = "/api/files/renders/x.png"): ProductionRow => ({ id, fixtureId: "f1", status, contentType, resultImageUrl, publishAt: null });

  it("payda yalnızca aktif türler — 'Yakında' tür kalmadı (2026-10-30), payda bütün katalog", () => {
    const active = CONTENT_TYPES.filter((type) => type.status === "active").length;
    assert.equal(summarizeProduction({}).total, active);
    assert.equal(active, CONTENT_TYPES.length);
  });

  it("onaylı kazanır, placeholder taslak sayılmaz: '1/N hazır · 1 onay bekliyor'", () => {
    const production = buildFixtureProduction([
      row("a", "MATCH_DAY", "DRAFT"),
      row("b", "MATCH_DAY", "APPROVED"),
      row("c", "PROBABLE_LINEUPS", "DRAFT"),
      row("d", "MATCH_RESULT", "DRAFT", null), // planlanmış placeholder
    ]).get("f1") ?? {};
    const summary = summarizeProduction(production);
    assert.equal(summary.approved, 1);
    assert.equal(summary.draft, 1);
    assert.equal(formatProductionSummary(summary), `1/${summary.total} hazır · 1 onay bekliyor`);
    assert.equal(formatProductionSummary({ approved: 3, draft: 0, total: 6 }), "3/6 hazır");
  });

  const carousel = {
    kind: "MATCH_RESULT",
    imageUrl: "/api/files/renders/a.png",
    carousel: [
      { url: "/api/files/renders/a.png", label: "01 · Maç Sonucu" },
      { url: "/api/files/renders/b.png", label: "02 · İstatistikler" },
    ],
  };

  it("carousel'li Maç Sonucu taslağı Maç İstatistikleri'ni de aynı durumla sayar (taslak → taslak, onaylı → onaylı)", () => {
    const draft = buildFixtureProduction([{ ...row("r", "MATCH_RESULT", "DRAFT"), renderOptions: carousel }]).get("f1") ?? {};
    assert.deepEqual([draft.MATCH_RESULT?.status, draft.MATCH_STATS?.status], ["draft", "draft"]);
    assert.equal(draft.MATCH_STATS?.status === "draft" ? draft.MATCH_STATS.draftId : null, "r");
    const approved = buildFixtureProduction([{ ...row("r", "MATCH_RESULT", "APPROVED"), renderOptions: carousel }]).get("f1") ?? {};
    assert.deepEqual([approved.MATCH_RESULT?.status, approved.MATCH_STATS?.status], ["approved", "approved"]);
  });

  it("tek kartlı Maç Sonucu İstatistikleri saymaz; ayrı onaylı 02 taslak carousel'e yenilmez", () => {
    const single = buildFixtureProduction([{ ...row("r", "MATCH_RESULT", "DRAFT"), renderOptions: { kind: "MATCH_RESULT", imageUrl: "/x.png" } }]).get("f1") ?? {};
    assert.equal(single.MATCH_STATS, undefined);
    const mixed = buildFixtureProduction([{ ...row("r", "MATCH_RESULT", "DRAFT"), renderOptions: carousel }, row("s", "MATCH_STATS", "APPROVED")]).get("f1") ?? {};
    assert.equal(mixed.MATCH_STATS?.status, "approved");
  });

  it("02 için planlanmış yayın zamanı carousel taslağına geçince korunur", () => {
    const planned = { ...row("p", "MATCH_STATS", "DRAFT", null), publishAt: new Date("2026-10-18T20:00:00Z") };
    const production = buildFixtureProduction([{ ...row("r", "MATCH_RESULT", "DRAFT"), renderOptions: carousel }, planned]).get("f1") ?? {};
    assert.equal(production.MATCH_STATS?.status, "draft");
    assert.equal(production.MATCH_STATS?.publishAt, "2026-10-18T20:00:00.000Z");
  });
});

describe("Plan imleci", () => {
  it("en erken gün dün; daha eski ya da bozuk imleç reddedilir", () => {
    assert.equal(planStartDay(NOW), "2026-10-16");
    assert.equal(parsePlanCursor("2026-10-23", NOW), "2026-10-23");
    assert.equal(parsePlanCursor("2026-10-15", NOW), null);
    assert.equal(parsePlanCursor("23-10-2026", NOW), null);
    assert.equal(parsePlanCursor(42, NOW), null);
  });
});
