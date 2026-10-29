import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { setDateLabel } from "@/lib/dashboard/checkmatch-set";
import { dayLabel, shortDate as weeklyShortDate } from "@/lib/dashboard/weekly-fixtures-layout";
import { clock, dayHeading, fullDate, normalizeClock, shortDate } from "@/lib/format/dates";
import { asOfDay } from "@/lib/player-h2h/checks";
import { toWeeklyMatch } from "@/lib/services/api-football/weekly-mappers";
import type { ApiFootballFixtureRaw } from "@/lib/services/api-football/types";

/** Ortak tarih/saat kuralı (denetim 2026-10-29): Konyaspor–Galatasaray, 30.10.2026 20:00 İstanbul. */

const KICKOFF = "2026-10-30T17:00:00Z";

describe("tarih/saat tek kural", () => {
  it("künye, kısa, saat, gün başlığı", () => {
    assert.equal(fullDate(KICKOFF), "30.10.2026");
    assert.equal(shortDate(KICKOFF), "30.10");
    assert.equal(clock(KICKOFF), "20:00");
    assert.equal(dayHeading(KICKOFF), "30 EKİM CUMA");
  });

  it("gün anahtarı (yyyy-MM-dd) günü kaydırmaz; gece yarısı sonrası maç İstanbul gününde", () => {
    assert.equal(dayHeading("2026-10-30"), "30 EKİM CUMA");
    assert.equal(shortDate("2026-10-30T21:30:00Z"), "31.10");
    assert.equal(clock("2026-10-30T21:30:00Z"), "00:30");
  });

  it("kartlar aynı yardımcıdan: Haftanın Maçları, set künyesi, Oyuncu Karşılaştırması", () => {
    assert.equal(dayLabel("2026-10-30"), "30 EKİM CUMA");
    assert.equal(weeklyShortDate("2026-10-30"), "30.10");
    assert.equal(setDateLabel(KICKOFF), "30.10.2026");
    assert.equal(asOfDay("2026-10-26T16:00:00Z"), "26.10");
    const raw = {
      fixture: { id: 1, date: KICKOFF, timestamp: Date.parse(KICKOFF) / 1000, venue: { name: null, city: null }, status: { short: "NS", long: "Not Started", elapsed: null } },
      league: { id: 203, name: "Süper Lig", season: 2026, round: "Regular Season - 11" },
      teams: { home: { id: 607, name: "Konyaspor", logo: "", winner: null }, away: { id: 645, name: "Galatasaray", logo: "", winner: null } },
      goals: { home: null, away: null },
    } as unknown as ApiFootballFixtureRaw;
    assert.equal(toWeeklyMatch(raw).time, "20:00");
  });

  it("Muhtemel 11 künyesi '30/10' değil: tr-TR gün+ay biçimi kullanılmıyor", () => {
    const source = readFileSync("src/app/dashboard/studio/lineup/actions.ts", "utf8");
    assert.doesNotMatch(source, /Intl\.DateTimeFormat/);
    assert.match(source, /shortDate\(fixture\.kickoffUtc\)} · \$\{clock\(fixture\.kickoffUtc\)/);
  });

  it("elle yazılan saat normalleşir", () => {
    assert.equal(normalizeClock("20.00"), "20:00");
    assert.equal(normalizeClock("9:05"), "09:05");
    assert.equal(normalizeClock("TBD"), "TBD");
  });
});
