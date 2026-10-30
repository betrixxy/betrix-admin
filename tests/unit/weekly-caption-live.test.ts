import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { weeklyCaption, weeklyCaptionLine } from "@/lib/dashboard/weekly-fixtures-layout";
import type { WeeklyMatch } from "@/types/weekly-fixtures";

/**
 * Haftanın Maçları gönderi metni (2026-10-30): canlı maçın o anki skoru bitmiş skor gibi yazılıyordu
 * ("Konyaspor 0 - 4 Galatasaray" maç sürerken; kartta "CANLI 78'"). Karar: canlı maçta skor YAZILMAZ,
 * satır "Ev - Dep (canlı)". Kurgusal maçlar.
 */

const match = (status: WeeklyMatch["status"], home: number | null, away: number | null, elapsed: number | null = null): WeeklyMatch => ({
  id: "api-football-1",
  kickoffUtc: "2026-10-30T17:00:00Z",
  dateKey: "2026-10-30",
  time: "20.00",
  status,
  elapsed,
  home: { name: "Konyaspor", logoUrl: "", goals: home },
  away: { name: "Galatasaray", logoUrl: "", goals: away },
  group: null,
});

describe("Haftanın Maçları gönderi metni — canlı skor", () => {
  it("canlı maç: skor yok, '(canlı)' ibaresi", () => {
    const line = weeklyCaptionLine(match("live", 0, 4, 78), "date");
    assert.equal(line, "Konyaspor - Galatasaray (canlı)");
    assert.doesNotMatch(line, /\d - \d/u);
  });

  it("bitmiş maç skorla, oynanmamış maç saatle, yarıda kalan notla", () => {
    assert.equal(weeklyCaptionLine(match("finished", 0, 4), "date"), "Konyaspor 0 - 4 Galatasaray");
    assert.equal(weeklyCaptionLine(match("scheduled", null, null), "date"), "20.00 Konyaspor - Galatasaray");
    assert.equal(weeklyCaptionLine(match("abandoned", 1, 0), "date"), "Konyaspor 1 - 0 Galatasaray (yarıda kaldı)");
  });

  it("tam metinde canlı maçın skoru geçmez", () => {
    const caption = weeklyCaption("Trendyol Süper Lig", "10. Hafta", [match("live", 0, 4, 78)], "date");
    assert.doesNotMatch(caption, /0 - 4/u);
    assert.match(caption, /Konyaspor - Galatasaray \(canlı\)/u);
  });
});
