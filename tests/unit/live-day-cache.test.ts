import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_DAY_TTL_MS, dayCacheTtlMs, isLiveOrNear, LIVE_DAY_TTL_MS, SETTLED_DAY_TTL_MS } from "@/lib/services/api-football/settled-day";
import type { Fixture } from "@/types/sports";

/**
 * Maç Merkezi gün önbelleği (2026-10-30): canlı maç varken 15 dk önbellek dakikayı donduruyordu ("CANLI 85'"
 * 21:50–22:04). Canlı / başlamak üzere / başlamış ama sonuçlanmamış maçı olan gün ≤ 60 sn; diğerleri eskisi gibi.
 */

const NOW = new Date("2026-10-30T19:00:00Z"); // 22:00 İstanbul
const at = (minutesFromNow: number) => new Date(NOW.getTime() + minutesFromNow * 60_000).toISOString();
const fixture = (statusShort: string, kickoffUtc: string): Fixture =>
  ({ kickoffUtc, progress: { statusShort, elapsed: null, homeGoals: null, awayGoals: null, penalty: null } }) as unknown as Fixture;

describe("gün önbelleği süresi (saf)", () => {
  it("canlı maçı olan gün 60 sn (ilk/ikinci yarı, devre arası, uzatma, penaltı, askı)", () => {
    for (const status of ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "SUSP", "INT"]) {
      assert.equal(dayCacheTtlMs("2026-10-30", [fixture("FT", at(-180)), fixture(status, at(-85))], NOW), LIVE_DAY_TTL_MS, status);
    }
    assert.ok(LIVE_DAY_TTL_MS <= 60_000);
  });

  it("başlamak üzere (≤ 15 dk) ya da saati geçmiş ama 'NS' kalan maç → 60 sn", () => {
    assert.equal(dayCacheTtlMs("2026-10-30", [fixture("NS", at(10))], NOW), LIVE_DAY_TTL_MS);
    assert.equal(dayCacheTtlMs("2026-10-30", [fixture("NS", at(-5))], NOW), LIVE_DAY_TTL_MS);
  });

  it("yalnızca ileride başlayacak maçlar → 15 dk; bitmiş + ileride → 15 dk", () => {
    assert.equal(dayCacheTtlMs("2026-10-30", [fixture("NS", at(120))], NOW), DEFAULT_DAY_TTL_MS);
    assert.equal(dayCacheTtlMs("2026-10-30", [fixture("FT", at(-200)), fixture("NS", at(90))], NOW), DEFAULT_DAY_TTL_MS);
  });

  it("tamamen sonuçlanmış geçmiş gün → 12 sa (eskisi gibi)", () => {
    assert.equal(dayCacheTtlMs("2026-10-29", [fixture("FT", at(-1500)), fixture("PST", at(-1400))], NOW), SETTLED_DAY_TTL_MS);
  });

  it("sağlayıcıda takılı kalmış eski 'canlı' (başlamadan 4 sa+ sonra) günü 60 sn'de tutmaz", () => {
    assert.equal(isLiveOrNear(fixture("2H", at(-300)), NOW), false);
    assert.equal(dayCacheTtlMs("2026-10-30", [fixture("2H", at(-300))], NOW), DEFAULT_DAY_TTL_MS);
  });
});
