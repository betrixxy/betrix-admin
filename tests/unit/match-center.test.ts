import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentTypesForPhase, defaultContentTypeId } from "@/lib/dashboard/content-types";
import { isFixtureInStudioWindow, matchCenterRange, upcomingRange } from "@/lib/dashboard/match-center-window";
import { disabledMenu, matchRowState } from "@/lib/dashboard/match-row-state";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { isSettledPastDay } from "@/lib/services/api-football/settled-day";
import { mapApiFootballFixtureToFixture } from "@/lib/services/api-football/mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { Fixture } from "@/types/sports";
import { RAW_HOFFENHEIM_BESIKTAS } from "../fixtures/api-football/match-result";

/** 17 Ekim 00:30 İstanbul = 16 Ekim 21:30 UTC — sunucu UTC'de olsa da "bugün" 17 Ekim'dir. */
const AFTER_MIDNIGHT = new Date("2026-10-16T21:30:00Z");

function withStatus(raw: ApiFootballFixtureResultRaw, short: string, elapsed: number | null, date = raw.fixture.date): ApiFootballFixtureResultRaw {
  return { ...raw, fixture: { ...raw.fixture, date, status: { long: short, short, elapsed } } };
}

describe("Maç Merkezi penceresi (İstanbul günü)", () => {
  it("dün 00:00'dan bugün + 6'ya; İstanbul gece yarısından sonra gün ilerler", () => {
    assert.deepEqual(matchCenterRange(AFTER_MIDNIGHT), { from: "2026-10-16", to: "2026-10-23" });
    assert.deepEqual(upcomingRange(AFTER_MIDNIGHT), { from: "2026-10-17", to: "2026-10-23" });
    assert.deepEqual(matchCenterRange(AFTER_MIDNIGHT, 2).from, "2026-10-15");
  });

  it("sınır: dün 00:00 dahil, önceki gün 23:59 hariç; dün 22:00'de başlayıp gece biten maç dahil", () => {
    assert.equal(isFixtureInStudioWindow("2026-10-15T21:00:00Z", "post_match", AFTER_MIDNIGHT), true); // 16 Ekim 00:00
    assert.equal(isFixtureInStudioWindow("2026-10-15T20:59:59Z", "post_match", AFTER_MIDNIGHT), false); // 15 Ekim 23:59
    assert.equal(isFixtureInStudioWindow("2026-10-16T19:00:00Z", "post_match", AFTER_MIDNIGHT), true); // dün 22:00
  });

  it("maç öncesi türler eski kuralda: dünkü maçı reddeder, bugün + 6 dahil, + 7 hariç", () => {
    assert.equal(isFixtureInStudioWindow("2026-10-16T19:00:00Z", "pre_match", AFTER_MIDNIGHT), false);
    assert.equal(isFixtureInStudioWindow("2026-10-23T17:00:00Z", "pre_match", AFTER_MIDNIGHT), true);
    assert.equal(isFixtureInStudioWindow("2026-10-23T21:00:00Z", "pre_match", AFTER_MIDNIGHT), false); // 24 Ekim 00:00
  });
});

describe("satır durumu → izinli içerik evresi", () => {
  const fixtureWith = (short: string, extra: Partial<NonNullable<Fixture["progress"]>> = {}) =>
    mapApiFootballFixtureToFixture({
      ...withStatus(RAW_HOFFENHEIM_BESIKTAS, short, extra.elapsed ?? null),
      goals: { home: extra.homeGoals ?? 2, away: extra.awayGoals ?? 3 },
      score: extra.penalty ? { penalty: extra.penalty } : null,
    });

  it("FT/AET/PEN → maç sonrası, saat yerine skor; penaltıyla biten maçta (P x-y)", () => {
    for (const short of ["FT", "AET"]) {
      const state = matchRowState(fixtureWith(short));
      assert.deepEqual([state.kind, state.phase], ["finished", "post_match"]);
    }
    const pen = matchRowState(fixtureWith("PEN", { homeGoals: 1, awayGoals: 1, penalty: { home: 4, away: 3 } }));
    assert.equal(pen.kind === "finished" ? pen.score : null, "1 – 1 (P 4-3)");
    const ft = matchRowState(fixtureWith("FT"));
    assert.equal(ft.kind === "finished" ? ft.score : null, "2 – 3");
  });

  it("NS/TBD → maç öncesi", () => {
    for (const short of ["NS", "TBD"]) assert.equal(matchRowState(fixtureWith(short)).phase, "pre_match");
  });

  it("canlı → menü pasif, rozet dakikası; devre arası", () => {
    for (const short of ["1H", "HT", "2H", "ET", "BT", "P"]) {
      const state = matchRowState(fixtureWith(short, { elapsed: 67 }));
      assert.deepEqual([state.kind, state.phase], ["live", null]);
      assert.equal(disabledMenu(state)?.label, "Maç bitince açılır");
    }
    const second = matchRowState(fixtureWith("2H", { elapsed: 67 }));
    assert.equal(second.kind === "live" ? second.minute : null, "67'");
  });

  it("ertelendi/iptal/yarıda kaldı/askıda → durum etiketi, menü pasif", () => {
    const labels = ["PST", "CANC", "ABD", "SUSP"].map((short) => {
      const state = matchRowState(fixtureWith(short));
      assert.equal(state.phase, null);
      return state.kind === "inactive" ? state.label : null;
    });
    assert.deepEqual(labels, ["Ertelendi", "İptal", "Yarıda kaldı", "Askıya alındı"]);
  });

  it("menü türleri katalogdaki evreden gelir; varsayılan: öncesi Maç Günü, sonrası Maç Sonucu", () => {
    assert.ok(contentTypesForPhase("post_match").every((type) => type.phase === "post_match"));
    assert.ok(contentTypesForPhase("pre_match").every((type) => type.phase === "pre_match"));
    assert.equal(defaultContentTypeId("pre_match"), "MATCH_DAY");
    assert.equal(defaultContentTypeId("post_match"), "MATCH_RESULT");
  });
});

describe("Maç Sonucu stüdyo doğrulaması", () => {
  const NEXT_DAY = new Date("2026-10-16T10:00:00Z"); // maç 15 Ekim'de — "dün"

  it("dün biten maçı kabul eder", () => {
    const result = validateMatchResultFixture(RAW_HOFFENHEIM_BESIKTAS, NEXT_DAY);
    assert.equal(result.ok && result.data.away.name, "Beşiktaş");
  });

  it("pencereden eski maçı reddeder", () => {
    const result = validateMatchResultFixture(RAW_HOFFENHEIM_BESIKTAS, new Date("2026-10-17T10:00:00Z"));
    assert.ok(!result.ok && /penceresinin dışında/.test(result.error.message));
  });

  it("bitmemiş maçta net hata verir, kart verisi üretmez", () => {
    const live = validateMatchResultFixture(withStatus(RAW_HOFFENHEIM_BESIKTAS, "2H", 67), NEXT_DAY);
    assert.ok(!live.ok && live.error.message.startsWith("Maç henüz bitmedi (durum: canlı, 67')"));
    const upcoming = validateMatchResultFixture(withStatus(RAW_HOFFENHEIM_BESIKTAS, "NS", null, "2026-10-16T17:00:00Z"), NEXT_DAY);
    assert.ok(!upcoming.ok && /durum: başlamadı/.test(upcoming.error.message));
    assert.equal(validateMatchResultFixture(null, NEXT_DAY).ok, false);
  });
});

describe("dünün fikstürü önbelleği", () => {
  const fixture = (short: string) => mapApiFootballFixtureToFixture(withStatus(RAW_HOFFENHEIM_BESIKTAS, short, null));

  it("geçmiş gün yalnızca tüm maçlar sonuçlanınca uzun önbelleğe girer; bugün asla", () => {
    assert.equal(isSettledPastDay("2026-10-16", [fixture("FT"), fixture("PEN"), fixture("PST")], AFTER_MIDNIGHT), true);
    assert.equal(isSettledPastDay("2026-10-16", [fixture("FT"), fixture("ET")], AFTER_MIDNIGHT), false);
    assert.equal(isSettledPastDay("2026-10-17", [fixture("FT")], AFTER_MIDNIGHT), false);
  });
});
