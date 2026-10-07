import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyTeamLineup, lineupIssues, teamDraftFromReference } from "@/lib/dashboard/lineup-draft";
import { formationGroups, formationLines, isValidFormation, pitchPositions } from "@/lib/dashboard/lineup-formations";
import { findTeamLineup, isCompleteLineup, lineupColorHex, lineupStarters, mapSquad } from "@/lib/services/api-football/lineup-mappers";
import type { TeamLineupReference } from "@/types/lineup";
import { LINEUP_TEAM_ID, RAW_LINEUP, RAW_SQUADS } from "../fixtures/api-football/lineup";

describe("diziliş", () => {
  it("yalnızca 10 saha oyunculu dizilişleri kabul eder", () => {
    assert.ok(isValidFormation("4-2-3-1"));
    assert.ok(isValidFormation("3-4-2-1"));
    assert.equal(isValidFormation("4-4-3"), false);
    assert.equal(isValidFormation("4-4-2-x"), false);
    assert.equal(isValidFormation(""), false);
  });

  it("satırları rollere ayırır, orta saha satırlarını tek grupta toplar", () => {
    assert.deepEqual(formationLines("4-2-3-1").map((l) => [l.role, l.start, l.size]), [["G", 0, 1], ["D", 1, 4], ["M", 5, 2], ["M", 7, 3], ["F", 10, 1]]);
    assert.deepEqual(formationGroups("4-2-3-1").map((g) => [g.role, g.indexes.length]), [["G", 1], ["D", 4], ["M", 5], ["F", 1]]);
  });

  it("11 nokta üretir: kaleci en altta, forvet en üstte, satır içinde soldan sağa", () => {
    const points = pitchPositions("4-3-3");
    assert.equal(points.length, 11);
    assert.ok(points.every((p) => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1));
    assert.ok((points[0]?.y ?? 0) > (points[1]?.y ?? 1));
    assert.ok((points[10]?.y ?? 1) < (points[5]?.y ?? 0));
    assert.ok((points[1]?.x ?? 1) < (points[4]?.x ?? 0));
  });
});

describe("API-Football kadro eşleyicileri", () => {
  it("ilk 11'i grid'e göre (satır, sonra sütun) sıralar", () => {
    const starters = lineupStarters(RAW_LINEUP);
    assert.deepEqual(starters.map((s) => s.name), [
      "K. Kaleci", "S. Solbek", "S. Stoper", "S. Stoper2", "S. Sağbek", "O. Ön", "O. Ön2", "O. Kanat", "O. On", "O. Kanat2", "F. Forvet",
    ]);
  });

  it("forma rengini #rrggbb'ye çevirir, 11 kişilik olmayan dizilişi reddeder", () => {
    assert.equal(lineupColorHex(RAW_LINEUP), "#e41e2c");
    assert.equal(findTeamLineup([RAW_LINEUP], LINEUP_TEAM_ID), RAW_LINEUP);
    assert.equal(findTeamLineup([{ ...RAW_LINEUP, startXI: RAW_LINEUP.startXI?.slice(0, 10) ?? null }], LINEUP_TEAM_ID), null);
  });

  it("dizilişi ya da saha konumu eksik ilk 11'i 'tam değil' sayar (kupa maçı verisi)", () => {
    assert.equal(isCompleteLineup(RAW_LINEUP), true);
    assert.equal(isCompleteLineup({ ...RAW_LINEUP, formation: null }), false);
    const noGrid = RAW_LINEUP.startXI?.map(({ player }) => ({ player: { ...player, grid: null } })) ?? null;
    assert.equal(isCompleteLineup({ ...RAW_LINEUP, startXI: noGrid }), false);
  });

  it("kadroyu pozisyon + numara sırasıyla eşler, isimsiz oyuncuyu atar", () => {
    assert.deepEqual(mapSquad(RAW_SQUADS.response, LINEUP_TEAM_ID).map((p) => [p.name, p.position]), [
      ["K. Kaleci", "G"], ["S. Solbek", "D"], ["Y. Yedek", "M"], ["F. Forvet", "F"],
    ]);
  });
});

describe("taslak", () => {
  const reference: TeamLineupReference = {
    teamId: LINEUP_TEAM_ID,
    teamName: "Kurgu SK",
    logoUrl: "",
    formation: "4-2-3-1",
    starters: lineupStarters(RAW_LINEUP),
    coach: "T. Direktör",
    colorHex: "#e41e2c",
    source: { kind: "last-match", date: "2026-10-01", opponent: "Rakip" },
    squad: mapSquad(RAW_SQUADS.response, LINEUP_TEAM_ID),
  };

  it("referanstan formu doldurur; güncel kadro numarası maçtakini ezer", () => {
    const draft = teamDraftFromReference(reference);
    assert.equal(draft.formation, "4-2-3-1");
    assert.equal(draft.slots[0]?.name, "K. Kaleci");
    assert.equal(draft.slots[10]?.number, "99");
    assert.deepEqual(lineupIssues(draft), []);
  });

  it("geçersiz diziliş varsayılana döner, eksik ilk 11 boş başlar", () => {
    const draft = teamDraftFromReference({ ...reference, formation: "4-4-3", starters: [] });
    assert.equal(draft.formation, "4-2-3-1");
    assert.ok(draft.slots.every((slot) => slot.name === ""));
  });

  it("boş pozisyonu ve aynı oyuncunun iki kez seçilmesini yakalar", () => {
    assert.match(lineupIssues(emptyTeamLineup("Boş"))[0] ?? "", /11 pozisyon boş/);
    const draft = teamDraftFromReference(reference);
    const duplicated = { ...draft, slots: draft.slots.map((slot, i) => (i === 1 ? { ...draft.slots[0]! } : slot)) };
    assert.ok(lineupIssues(duplicated).some((issue) => issue.includes("iki kez")));
  });
});
