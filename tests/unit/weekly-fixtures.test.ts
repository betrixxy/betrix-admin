import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayLabel, matchCenter, splitTitle, weeklyGrouping, weeklyKindLabel, weeklyRowHeight, weeklySections } from "@/lib/dashboard/weekly-fixtures-layout";
import { matchStatus, roundKeyOf, roundLabel, roundOptions, standingsGroupMap, toWeeklyMatch } from "@/lib/services/api-football/weekly-mappers";
import { WEEKLY_MAX_MATCHES } from "@/types/weekly-fixtures";
import { RAW_FINISHED, RAW_LATE, RAW_LIVE, RAW_POSTPONED, RAW_TBD, rawFixture } from "../fixtures/api-football/weekly";

describe("tur etiketleri", () => {
  it("lig haftası, lig aşaması, grup aşaması ve eleme turları Türkçe", () => {
    assert.equal(roundLabel("Regular Season - 7"), "7. Hafta");
    assert.equal(roundLabel("League Stage - 2"), "Lig Aşaması · 2. Maç Günü");
    assert.equal(roundLabel("Group C - 3"), "Grup Aşaması · 3. Maç Günü");
    assert.equal(roundLabel("Quarter-finals"), "Çeyrek Final");
    assert.equal(roundLabel("Bilinmeyen Tur"), "Bilinmeyen Tur");
  });

  it("eski kupa formatında grupların turları tek maç gününde birleşir, harf sırasıyla", () => {
    const options = roundOptions(["Play-offs", "Group F - 1", "Group A - 1", "Group B - 2", "Group A - 2"]);
    assert.deepEqual(
      options.map((option) => [option.key, option.rounds]),
      [
        ["Play-offs", ["Play-offs"]],
        ["group-stage-1", ["Group A - 1", "Group F - 1"]],
        ["group-stage-2", ["Group A - 2", "Group B - 2"]],
      ],
    );
    assert.equal(roundKeyOf("Group D - 2"), "group-stage-2");
    assert.equal(roundKeyOf("Regular Season - 3"), "Regular Season - 3");
  });
});

describe("maç eşleme (Türkiye saati)", () => {
  it("UTC saatini İstanbul'a çevirir; gece yarısını geçen maç ertesi güne düşer", () => {
    const finished = toWeeklyMatch(RAW_FINISHED);
    assert.deepEqual([finished.dateKey, finished.time, finished.status], ["2026-10-09", "20.00", "finished"]);
    const late = toWeeklyMatch(RAW_LATE);
    assert.deepEqual([late.dateKey, late.time], ["2026-10-11", "00.30"]);
    assert.equal(toWeeklyMatch(RAW_TBD).time, "");
  });

  it("durum kodları: oynanmamış/canlı/bitmiş/ertelenmiş", () => {
    assert.deepEqual(["NS", "TBD", "HT", "FT", "PEN", "AWD", "PST", "CANC", "ABD"].map(matchStatus), [
      "scheduled",
      "scheduled",
      "live",
      "finished",
      "finished",
      "finished",
      "postponed",
      "cancelled",
      "abandoned",
    ]);
  });

  it("grup harfi turdan, yoksa puan durumundan (iki takım aynı gruptaysa)", () => {
    assert.equal(toWeeklyMatch(rawFixture(9, { date: "2023-10-24T17:00:00Z", short: "FT", round: "Group A - 3" })).group, "A");
    const groups = standingsGroupMap([
      { group: "Group B", teamId: 10 },
      { group: "Group B", teamId: 20 },
      { group: "Group C", teamId: 30 },
    ]);
    assert.equal(toWeeklyMatch(rawFixture(9, { date: "2023-10-24T17:00:00Z", short: "NS", round: "Group Stage - 3" }), groups).group, "B");
    // Tek tablolu lig aşaması (36 takım tek "grup") gruplamaya yol açmaz.
    assert.equal(standingsGroupMap([{ group: "UEFA Champions League", teamId: 10 }]).size, 0);
  });
});

describe("kart yerleşimi", () => {
  const matches = [RAW_FINISHED, RAW_LATE, RAW_LIVE, RAW_POSTPONED].map((raw) => toWeeklyMatch(raw));

  it("günlere böler, başlık Türkçe; admin sırası korunur", () => {
    assert.equal(dayLabel("2026-08-14"), "14 AĞUSTOS CUMA");
    const reordered = [matches[2], matches[0], matches[1]].filter((match) => match !== undefined);
    assert.deepEqual(
      weeklySections(reordered, "date").map((section) => section.label),
      ["11 EKİM PAZAR", "9 EKİM CUMA"],
    );
  });

  it("grup aşamasında gruplar harf sırasıyla", () => {
    const grouped = ["C", "A", "B"].map((group, i) => ({ ...toWeeklyMatch(rawFixture(30 + i, { date: "2023-10-24T17:00:00Z", short: "NS" })), group }));
    assert.equal(weeklyGrouping(grouped), "group");
    assert.deepEqual(weeklySections(grouped, "group").map((section) => section.label), ["A GRUBU", "B GRUBU", "C GRUBU"]);
  });

  it("oynanmamışta saat, oynananda skor, ertelenende kısa durum", () => {
    const [finished, late, live, postponed] = matches;
    assert.ok(finished && late && live && postponed);
    assert.deepEqual(matchCenter(finished, "date"), { primary: "3 - 1", kind: "score", note: "" });
    assert.deepEqual(matchCenter(late, "date"), { primary: "00.30", kind: "time", note: "" });
    assert.deepEqual(matchCenter(live, "date"), { primary: "0 - 0", kind: "score", note: "CANLI 62'" });
    assert.equal(matchCenter(postponed, "date").primary, "ERT.");
    assert.equal(weeklyKindLabel(matches), "FİKSTÜR & SONUÇLAR");
  });

  it("sığmayan kart reddedilir; uzun başlık ikiye bölünür", () => {
    assert.ok((weeklyRowHeight(4, 9) ?? 0) >= 54);
    assert.equal(weeklyRowHeight(WEEKLY_MAX_MATCHES, WEEKLY_MAX_MATCHES), null);
    assert.deepEqual(splitTitle("Lig Aşaması · 2. Maç Günü"), { kicker: "LİG AŞAMASI", main: "2. MAÇ GÜNÜ" });
    assert.deepEqual(splitTitle("7. Hafta"), { kicker: "", main: "7. HAFTA" });
  });
});
