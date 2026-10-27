import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDrawCard } from "@/lib/dashboard/draw-card";
import { hasLink, hashtagCount } from "@/lib/dashboard/vitrin-caption";
import { buildDrawCaption } from "@/lib/draw/caption";
import { addLeagueFixture, addTie, emptyDraw } from "@/lib/draw/entry";
import { DRAW_ROUNDS, drawRecordKey, drawRound } from "@/lib/draw/rounds";
import { drawRequestSchema, drawStateSchema } from "@/lib/draw/state-schema";
import { bannedWordsGate } from "@/lib/prediction/banned-words";
import type { DrawState } from "@/types/draw";
import { DRAW_KNOCKOUT, DRAW_LEAGUE } from "../fixtures/draw";

/**
 * Kura stüdyosu (2. aşama): torba girişinin ızgaraya yansıması, gönderi metni kuralı, kayıt şeması
 * (girilen eşleşmeler kayıtta aynen), tur kataloğu.
 */

const card = (state: DrawState, focusTeamId: number) => buildDrawCard({ variant: "TEAM", states: [state], focusTeamId, logos: {}, brandLogo: "" });

describe("torba numarası (elle) A ızgarasında", () => {
  it("torba girilince rakip hücresinde görünür, girilmezse boş", () => {
    const base = emptyDraw({ competition: { id: 2, name: "UEFA Şampiyonlar Ligi" }, season: 2026, roundLabel: "Lig Aşaması", stage: "LEAGUE_PHASE", drawDateUtc: null, teams: DRAW_LEAGUE.teams.map((t) => ({ ...t, pot: null })) });
    const entered = addLeagueFixture(base, { teamId: 611, opponentId: 560, venue: "HOME", dateUtc: null });
    assert.ok(entered.ok);
    const before = card(entered.state, 611);
    assert.ok(before.ok && before.data.body.kind === "TEAM_LEAGUE");
    assert.equal(before.data.body.cells[0]?.potLabel, "");
    // Stüdyodaki torba alanı yalnızca katılımcının `pot`'unu değiştirir.
    const withPot = { ...entered.state, teams: entered.state.teams.map((t) => (t.id === 560 ? { ...t, pot: 3 } : t)) };
    const after = card(withPot, 611);
    assert.ok(after.ok && after.data.body.kind === "TEAM_LEAGUE");
    assert.equal(after.data.body.cells[0]?.potLabel, "3. TORBA");
    assert.equal(after.data.body.cells[0]?.opponent.name, "SLAVIA PRAG");
  });
});

describe("gönderi metni — yalnızca olgu", () => {
  it("A lig aşaması: iç saha / deplasman listesi, yorum ve bahis dili yok, link yok, ≤5 hashtag", () => {
    const caption = buildDrawCaption("TEAM", [DRAW_LEAGUE], 611);
    assert.match(caption, /^Fenerbahçe \| Şampiyonlar Ligi Lig Aşaması rakipleri belli oldu/);
    assert.match(caption, /🏠 İç saha: Borussia Mönchengladbach, Atletico Madrid, Roma, Slavia Prag/);
    assert.match(caption, /✈️ Deplasman: Benfica, Liverpool, Aston Villa, Şahtar Donetsk/);
    assert.equal(bannedWordsGate({ metin: caption }), null);
    assert.doesNotMatch(caption, /zorlu|kolay|şanslı|şanssız/i);
    assert.ok(!hasLink(caption));
    assert.ok(hashtagCount(caption) <= 5);
  });

  it("eksik girişte yalnızca girilenler; eleme sırası", () => {
    const base = emptyDraw({ competition: { id: 3, name: "UEFA Avrupa Ligi" }, season: 2026, roundLabel: "Son 16 Turu", stage: "KNOCKOUT", drawDateUtc: null, teams: DRAW_KNOCKOUT.teams });
    const one = addTie(base, { first: 211, second: 611, firstLegUtc: null, secondLegUtc: null });
    assert.ok(one.ok);
    const caption = buildDrawCaption("ALL", [one.state], null);
    assert.equal(caption.split("\n").filter((line) => line.includes(" – ")).length, 1);
    assert.match(buildDrawCaption("TEAM", [one.state], 611), /Fenerbahçe – Benfica \(ilk maç deplasmanda\)/);
  });

  it("B: Türk takımları turnuva başlığıyla", () => {
    const caption = buildDrawCaption("TURKISH", [DRAW_LEAGUE], null);
    for (const team of ["Fenerbahçe:", "Galatasaray:", "Beşiktaş:", "Trabzonspor:", "Başakşehir:"]) assert.ok(caption.includes(team), team);
    assert.equal(bannedWordsGate({ metin: caption }), null);
  });
});

describe("kayıt şeması — girilen eşleşmeler aynen saklanır", () => {
  it("durum JSON'dan geri okununca aynı (karşılaştırma bu kaydı kullanır)", () => {
    const stored = JSON.parse(JSON.stringify({ ...DRAW_LEAGUE, nameOverrides: { 560: "Slavia" } })) as unknown;
    const parsed = drawStateSchema.safeParse(stored);
    assert.ok(parsed.success, parsed.success ? "" : parsed.error.message);
    assert.deepEqual(parsed.data.fixtures, DRAW_LEAGUE.fixtures);
    assert.equal(parsed.data.nameOverrides["560"], "Slavia");
  });

  it("istek: tanımsız varyant/format reddedilir", () => {
    const request = { variant: "TEAM", format: "IG_PORTRAIT", states: [DRAW_LEAGUE], roundIds: ["LEAGUE"], focusTeamId: 611 };
    assert.ok(drawRequestSchema.safeParse(JSON.parse(JSON.stringify(request))).success);
    assert.ok(!drawRequestSchema.safeParse({ ...request, variant: "ANALYSIS" }).success);
    assert.ok(!drawRequestSchema.safeParse({ ...request, format: "A4" }).success);
  });
});

describe("tur kataloğu", () => {
  it("API tur adları doğru tura düşer, kayıt anahtarı kararlı", () => {
    assert.ok(drawRound("R16")?.apiRound.test("Round of 16"));
    assert.ok(!drawRound("R16")?.apiRound.test("Knockout Round Play-offs"));
    assert.ok(drawRound("KPO")?.apiRound.test("Knockout Round Play-offs"));
    assert.ok(drawRound("QPO")?.apiRound.test("Play-offs"));
    assert.ok(drawRound("LEAGUE")?.apiRound.test("League Stage - 3"));
    assert.equal(new Set(DRAW_ROUNDS.map((round) => round.id)).size, DRAW_ROUNDS.length);
    assert.equal(drawRecordKey(2, 2026, "LEAGUE"), "draw:2:2026:LEAGUE");
  });
});
