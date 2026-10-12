import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectSections, standingsCapacity, standingsCaption, standingsColumns, standingsKindLabel, standingsLayout, standingsPlan, standingsStatColumns } from "@/lib/dashboard/standings-layout";
import { standingsResponseRawSchema, standingZone, toStandingsGroups } from "@/lib/services/api-football/standings-mappers";
import { ALL_GROUPS } from "@/types/standings";
import { RAW_GROUPS, RAW_LEAGUE_PHASE, RAW_LEAGUE_TABLE, rawStandingsResponse } from "../fixtures/api-football/standings";

const league = toStandingsGroups([RAW_LEAGUE_TABLE]);
const leaguePhase = toStandingsGroups([RAW_LEAGUE_PHASE]);
const groups = toStandingsGroups(RAW_GROUPS);

describe("puan durumu eşleme", () => {
  it("ham yanıt şemaya uyar; tek tabloda bölüm başlığı boş, satırlar sıralı ve tam", () => {
    assert.ok(standingsResponseRawSchema.safeParse(rawStandingsResponse([RAW_LEAGUE_TABLE])).success);
    assert.equal(league.length, 1);
    assert.equal(league[0]?.label, "");
    const first = league[0]?.rows[0];
    assert.ok(first);
    assert.deepEqual([first.rank, first.played, first.win + first.draw + first.lose, first.goalDiff], [1, 8, 8, first.goalsFor - first.goalsAgainst]);
  });

  it("gruplar harf sırasıyla \"A GRUBU\" olur", () => {
    assert.deepEqual(groups.map((group) => [group.key, group.label]), [["Group A", "A GRUBU"], ["Group B", "B GRUBU"], ["Group C", "C GRUBU"], ["Group D", "D GRUBU"]]);
  });

  it("bölge: play-off önce, sonra Avrupa/terfi, küme düşme", () => {
    assert.equal(standingZone("Promotion - Champions League (Play Offs: 1/16-finals)"), "playoff");
    assert.equal(standingZone("Promotion - Champions League (Round of 16)"), "top");
    assert.equal(standingZone("Promotion - Europa League (Qualification)"), "playoff");
    assert.equal(standingZone("Relegation - 1. Lig"), "relegation");
    assert.equal(standingZone(null), null);
  });
});

describe("puan durumu yerleşimi", () => {
  it("dar formatlarda O · AV · P, yatayda tam tablo", () => {
    assert.deepEqual(standingsStatColumns("post").map((column) => column.label), ["O", "AV", "P"]);
    assert.deepEqual(standingsStatColumns("story").map((column) => column.label), ["O", "AV", "P"]);
    assert.deepEqual(standingsStatColumns("landscape").map((column) => column.label), ["O", "G", "B", "M", "A", "Y", "AV", "P"]);
  });

  it("yatayda 20 takım 1-10 / 11-20 iki sütuna; dikeyde tek sütun", () => {
    const columns = standingsColumns(league, 2);
    assert.deepEqual(columns.map((column) => column.flatMap((section) => section.rows.map((row) => row.rank)).join(",")), ["1,2,3,4,5,6,7,8,9,10", "11,12,13,14,15,16,17,18,19,20"]);
    const plan = standingsPlan(league, standingsLayout("landscape"));
    assert.ok(plan && plan.columns.length === 2);
    assert.equal(standingsPlan(league, standingsLayout("post"))?.columns.length, 1);
  });

  it("20 takım 4:5 ve Story'ye sığar; 36 takımlık lig aşaması sığmaz, aralıkla bölünür", () => {
    for (const format of ["post", "story", "landscape"] as const) assert.ok(standingsPlan(league, standingsLayout(format)), format);
    assert.equal(standingsPlan(leaguePhase, standingsLayout("post")), null);
    assert.ok(standingsCapacity("post") >= 20 && standingsCapacity("post") < 36);
    const firstHalf = selectSections(leaguePhase, { groupKey: "UEFA Champions League", rankFrom: 1, rankTo: 18 });
    assert.ok(firstHalf.ok && standingsPlan(firstHalf.data, standingsLayout("post")));
  });

  it("tüm gruplar ayrı bölüm; tek grup seçilince aralık uygulanır", () => {
    const all = selectSections(groups, { groupKey: ALL_GROUPS, rankFrom: 1, rankTo: 64 });
    assert.ok(all.ok && all.data.length === 4);
    assert.ok(standingsPlan(all.ok ? all.data : [], standingsLayout("post")));
    const top2 = selectSections(groups, { groupKey: "Group B", rankFrom: 1, rankTo: 2 });
    assert.ok(top2.ok);
    assert.deepEqual(top2.ok ? top2.data[0]?.rows.map((row) => row.rank) : [], [1, 2]);
    assert.equal(selectSections(groups, { groupKey: "Group Z", rankFrom: 1, rankTo: 4 }).ok, false);
  });

  it("etiket ve gönderi metni", () => {
    assert.equal(standingsKindLabel("super-lig", league), "8. HAFTA SONU");
    assert.equal(standingsKindLabel("ucl", leaguePhase), "8. MAÇ GÜNÜ SONU");
    assert.equal(standingsKindLabel("ucl", groups), "GRUP AŞAMASI");
    const caption = standingsCaption("Süper Lig", "2026/27", "Puan Durumu", league);
    assert.ok(caption.startsWith("Süper Lig 2026/27 | Puan Durumu"));
    assert.match(caption, /^1\. Kurgu Takım 1 — \d+ P \(8 O, \+\d+ AV\)$/m);
  });
});
