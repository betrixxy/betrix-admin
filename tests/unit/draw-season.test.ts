import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildDrawCard } from "@/lib/dashboard/draw-card";
import { leagueFixturesFromApi, teamsFromApi } from "@/lib/draw/api-mappers";
import { emptyParticipantsReason, mergeSeasonDraws, seasonDrawsSummary, turkishLeagueScope } from "@/lib/draw/season-draws";
import type { ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import type { DrawState } from "@/types/draw";
import { DRAW_KNOCKOUT, DRAW_LEAGUE } from "../fixtures/draw";

/**
 * Kura stüdyosu denetimi (2026-10-29): bitmiş kuralar için tek tık (API lig aşaması → Türk takımlarının
 * rakipleri), boş katılımcı listesinin nedeni, stüdyo formlarında tarayıcı otomatik doldurması kapalı.
 */

const fixture = (id: number, home: [number, string], away: [number, string], iso: string): ApiFootballFixtureRaw =>
  ({
    fixture: { id, date: iso, timestamp: Date.parse(iso) / 1000, venue: { name: null, city: null }, status: { short: "NS", long: "Not Started", elapsed: null } },
    league: { id: 3, name: "UEFA Europa League", season: 2026, round: "League Stage - 1" },
    teams: { home: { id: home[0], name: home[1], logo: null, winner: null }, away: { id: away[0], name: away[1], logo: null, winner: null } },
    goals: { home: null, away: null },
  }) as unknown as ApiFootballFixtureRaw;

const API_LEAGUE = [
  fixture(1, [611, "Fenerbahce"], [560, "Slavia Praha"], "2026-09-24T19:00:00Z"),
  fixture(2, [497, "AS Roma"], [611, "Fenerbahce"], "2026-10-02T19:00:00Z"),
  fixture(3, [497, "AS Roma"], [211, "Benfica"], "2026-10-02T19:00:00Z"),
];
const COUNTRIES = new Map([
  [611, "Turkey"],
  [560, "Czech-Republic"],
  [497, "Italy"],
  [211, "Portugal"],
]);

function apiState(): DrawState {
  return {
    competition: { id: 3, name: "UEFA Avrupa Ligi" },
    season: 2026,
    roundLabel: "Lig Aşaması",
    stage: "LEAGUE_PHASE",
    drawDateUtc: null,
    teams: teamsFromApi(API_LEAGUE, COUNTRIES),
    ties: [],
    fixtures: leagueFixturesFromApi(API_LEAGUE),
    nameOverrides: {},
  };
}

describe("bu sezonun Avrupa kuraları — Türk takımlarına daraltma", () => {
  it("yalnızca Türk takımının rakipleri, iç saha / deplasman ve tarih kalır", () => {
    const scoped = turkishLeagueScope(apiState());
    assert.ok(scoped);
    assert.deepEqual(scoped.fixtures, [
      { teamId: 611, opponentId: 560, venue: "HOME", dateUtc: "2026-09-24T19:00:00.000Z" },
      { teamId: 611, opponentId: 497, venue: "AWAY", dateUtc: "2026-10-02T19:00:00.000Z" },
    ]);
    assert.deepEqual(scoped.teams.map((t) => t.id).sort(), [497, 560, 611]);
  });

  it("Türk takımı yoksa null (kupa atlanır)", () => {
    assert.equal(turkishLeagueScope({ ...apiState(), teams: apiState().teams.map((t) => ({ ...t, country: "Italy" })) }), null);
  });

  it("B (Temsilcilerimiz) ve A (takım odaklı) daraltılmış durumla doğrudan üretilir", () => {
    const scoped = turkishLeagueScope(apiState())!;
    const turkish = buildDrawCard({ variant: "TURKISH", states: [scoped], focusTeamId: null, logos: {}, brandLogo: "" });
    assert.ok(turkish.ok && turkish.data.body.kind === "TURKISH");
    assert.equal(turkish.data.body.rows.length, 1);
    assert.equal(turkish.data.body.rows[0]?.opponents.length, 2);
    const team = buildDrawCard({ variant: "TEAM", states: [scoped], focusTeamId: 611, logos: {}, brandLogo: "" });
    assert.ok(team.ok && team.data.body.kind === "TEAM_LEAGUE");
    assert.deepEqual(team.data.body.cells.map((c) => c.venue), ["HOME", "AWAY"]);
  });

  it("özet: kupa başına Türk takımı sayısı + atlanan kupaların nedeni", () => {
    assert.equal(seasonDrawsSummary([turkishLeagueScope(apiState())!], ["KL: lig aşamasında Türk takımı yok."]), "Getirildi — Avrupa Ligi: 1 Türk takımı. KL: lig aşamasında Türk takımı yok.");
    assert.match(seasonDrawsSummary([], []), /bulunamadı/);
  });
});

describe("API kuraları stüdyo oturumlarına", () => {
  const session = (state: DrawState, roundId: string) => ({ roundId, state });
  const blank: DrawState = { ...DRAW_LEAGUE, teams: [], fixtures: [] };

  it("aynı turnuvanın lig aşaması yenilenir, boş yer tutucu atılır, girişli eleme oturumu korunur", () => {
    const fetched = turkishLeagueScope(apiState())!;
    const merged = mergeSeasonDraws([session(blank, "LEAGUE"), session({ ...DRAW_LEAGUE, competition: { id: 3, name: "UEFA Avrupa Ligi" } }, "LEAGUE"), session(DRAW_KNOCKOUT, "QPO")], [fetched]);
    assert.deepEqual(
      merged.map((s) => [s.state.competition.id, s.roundId]),
      [
        [3, "LEAGUE"],
        [2, "QPO"],
      ],
    );
    assert.equal(merged[0]?.state, fetched);
  });

  it("en fazla 3 oturum", () => {
    const three = [2, 3, 848].map((id) => ({ ...turkishLeagueScope(apiState())!, competition: { id, name: "" } }));
    assert.equal(mergeSeasonDraws([session(DRAW_KNOCKOUT, "QPO")], three).length, 3);
  });
});

describe("katılımcılar 0 gelirse neden ekranda", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  it("sezon API'de yok", () => {
    assert.match(emptyParticipantsReason("UEFA Şampiyonlar Ligi", 2027, { exists: false, current: false, start: null }, now), /UEFA Şampiyonlar Ligi 2027\/28 sezonu yok/);
  });
  it("sezon henüz başlamadı", () => {
    assert.match(emptyParticipantsReason("UEFA Avrupa Ligi", 2027, { exists: true, current: false, start: "2027-07-06" }, now), /henüz başlamadı .*2027-07-06/);
  });
  it("sezon var ama liste boş → elle ekleme ve tek tık önerisi", () => {
    assert.match(emptyParticipantsReason("UEFA Şampiyonlar Ligi", 2026, { exists: true, current: true, start: "2026-07-07" }, now), /boş döndürdü \(hata yok\).*Avrupa kuralarını getir/);
    assert.match(emptyParticipantsReason("UEFA Şampiyonlar Ligi", 2026, null, now), /boş döndürdü/);
  });
});

describe("stüdyo formlarında tarayıcı otomatik doldurması kapalı", () => {
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : f.endsWith(".tsx") ? [join(dir, f)] : []));
  const NON_TEXT = /type=["{]?["']?(hidden|file|checkbox|radio|range|color|submit|button)/;

  it("Input ve Textarea varsayılanı autoComplete=off (login kendi değerini verir)", () => {
    for (const file of ["src/components/ui/input.tsx", "src/components/ui/textarea.tsx"]) {
      const source = readFileSync(file, "utf8");
      assert.ok(source.indexOf('autoComplete="off"') !== -1 && source.indexOf('autoComplete="off"') < source.indexOf("{...props}"), file);
    }
  });

  it("ham <input>/<textarea> metin alanlarında autoComplete belirtilmiş", () => {
    const missing: string[] = [];
    for (const file of [...walk("src/components/features"), ...walk("src/app")]) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<(input|textarea)(?=[\s>])/g)) {
        const end = match[1] === "input" ? source.indexOf("/>", match.index) : source.indexOf(">", match.index);
        const tag = source.slice(match.index, end);
        // Yorumdaki örnek (`<input type=…>`) etiket değildir.
        if (source[match.index - 1] === "`") continue;
        if (!tag.includes("autoComplete") && !NON_TEXT.test(tag)) missing.push(`${file}:${source.slice(0, match.index).split("\n").length}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  it("kura stüdyosu arama/süzgeç alanlarının adı benzersiz", () => {
    const names = [...walk("src/components/features/dashboard/draw")].flatMap((file) => [...readFileSync(file, "utf8").matchAll(/name="([^"]+)"/g)].map((m) => m[1]));
    assert.ok(names.includes("draw-participant-filter") && names.includes("draw-team-search"));
    assert.equal(new Set(names).size, names.length);
  });

  it("otomatik doldurma zemini koyu temayı bozmaz (globals.css)", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    assert.match(css, /input:-webkit-autofill[\s\S]*?-webkit-text-fill-color: var\(--foreground\)[\s\S]*?box-shadow: 0 0 0 1000px var\(--background\) inset/);
  });
});
