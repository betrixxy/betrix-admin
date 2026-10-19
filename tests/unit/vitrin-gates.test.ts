import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement, isValidElement, type ReactElement } from "react";
import { kitTeamOf, ownKitOnly } from "@/lib/archive/picker-order";
import { cardTeamColor, DRAW_HEX, sideColors, vitrinAccentHex } from "@/lib/dashboard/vitrin-card";
import { kickoffGate } from "@/lib/prediction/kickoff";
import { selectFinishedBefore } from "@/lib/services/api-football/form-mappers";
import { tight, tightenTree, wrapLines } from "@/skills/render-engine/satori-text";

/**
 * Vitrin kapıları (kurucu kararları, 2026-10-19): zaman kapısı, kart takım rengi (açıklık yükseltme
 * yok), "yalnızca kendi forması" süzgeci, kickoff öncesi form, Satori metin katmanı.
 */

describe("zaman kapısı", () => {
  const fixture = { kickoffUtc: "2026-10-24T17:00:00Z", status: "SCHEDULED" as const };

  it("başlamamış maç geçer", () => {
    assert.equal(kickoffGate(fixture, new Date("2026-10-24T16:59:59Z")), null);
  });

  it("kickoff anı ve sonrası reddedilir (onay anı < kickoff)", () => {
    assert.match(kickoffGate(fixture, new Date("2026-10-24T17:00:00Z")) ?? "", /Maç başladı/);
    assert.match(kickoffGate(fixture, new Date("2026-10-25T10:00:00Z")) ?? "", /Maç başladı/);
  });

  it("planlı olmayan maç (ertelendi, iptal) reddedilir; saat okunamazsa reddedilir", () => {
    assert.match(kickoffGate({ ...fixture, status: "POSTPONED" }, new Date("2026-10-20T10:00:00Z")) ?? "", /planlı değil/);
    assert.match(kickoffGate({ ...fixture, kickoffUtc: "?" }, new Date("2026-10-20T10:00:00Z")) ?? "", /okunamadı/);
  });

  it("form yalnızca kickoff'tan ÖNCE bitmiş maçlardan (kickoff anındaki/sonraki maç girmez)", () => {
    const at = (iso: string, short = "FT") => ({ fixture: { id: Date.parse(iso), timestamp: Date.parse(iso) / 1000, status: { short } } });
    const rows = [at("2026-10-01T17:00:00Z"), at("2026-10-10T17:00:00Z"), at("2026-10-24T17:00:00Z"), at("2026-10-30T17:00:00Z"), at("2026-10-20T17:00:00Z", "PST")];
    const picked = selectFinishedBefore(rows as never[], "2026-10-24T17:00:00Z", 5) as typeof rows;
    assert.deepEqual(picked.map((row) => new Date(row.fixture.timestamp * 1000).toISOString()), ["2026-10-01T17:00:00.000Z", "2026-10-10T17:00:00.000Z"]);
  });
});

describe("kart takım rengi: ana renk okunmuyorsa ikincil, açıklık yükseltilmez", () => {
  it("Trabzonspor: bordo okunmaz → açık mavi (pembe yok)", () => {
    assert.equal(cardTeamColor(998, [DRAW_HEX]), "#5AB4E5");
  });

  it("Galatasaray: kırmızı okunmaz → altın; Beşiktaş: beyaz okunur → beyaz", () => {
    assert.equal(cardTeamColor(645, [DRAW_HEX]), "#FDB912");
    assert.equal(cardTeamColor(549, [DRAW_HEX]), "#FFFFFF");
  });

  it("çubuk, manşet, vurgu tek renk: vurgu favorinin kart rengi", () => {
    const colors = sideColors(998, 549);
    assert.deepEqual(colors, ["#5AB4E5", "#FFFFFF"]);
    assert.equal(vitrinAccentHex({ favourite: "HOME", home: 43, away: 35 }, colors), "#5AB4E5");
    assert.equal(vitrinAccentHex({ favourite: "AWAY", home: 30, away: 45 }, colors), "#FFFFFF");
    assert.equal(vitrinAccentHex({ favourite: null, home: 36, away: 34 }, colors), "#5AB4E5");
  });
});

describe("arşiv seçicisi: yalnızca kendi forması", () => {
  it("forma takımı; yoksa klasörün takımı", () => {
    assert.equal(kitTeamOf({ kitTeamId: 549, teamId: 998 }), 549);
    assert.equal(kitTeamOf({ kitTeamId: null, teamId: 998 }), 998);
  });

  it("eski forma ve başka takımın forması elenir", () => {
    const photos = [
      { id: "a", kitTeamId: 998, teamId: 998 },
      { id: "b", kitTeamId: 549, teamId: 998 },
      { id: "c", kitTeamId: null, teamId: 998 },
      { id: "d", kitTeamId: 777, teamId: 998 },
    ];
    assert.deepEqual(ownKitOnly(photos, 998).map((photo) => photo.id), ["a", "c"]);
  });
});

describe("Satori metin katmanı (çift boşluk düzeltmesi)", () => {
  const NBSP = " ";

  it("tek satırlık metin bölünmez boşlukla; data-wrap paragrafı dokunulmaz", () => {
    const Name = ({ text }: { text: string }) => createElement("span", null, text);
    const tree = tightenTree(createElement("div", null, createElement(Name, { text: "TRENDYOL SÜPER LİG" }), createElement("span", { "data-wrap": "" }, "uzun bir paragraf satır kaydırır"))) as ReactElement<{ children: ReactElement<{ children: string[] }>[] }>;
    const [first, second] = tree.props.children;
    assert.ok(isValidElement(first) && isValidElement(second));
    assert.deepEqual([first.props.children].flat(), [`TRENDYOL${NBSP}SÜPER${NBSP}LİG`]);
    assert.deepEqual([second.props.children].flat(), ["uzun bir paragraf satır kaydırır"]);
  });

  it("wrapLines satırlara böler, her satır sıkı", () => {
    const lines = wrapLines("Beşiktaş son 5 maçın 4'ünde iki takım da gol buldu.", 300, 30);
    assert.ok(lines.length >= 2);
    assert.ok(lines.every((line) => !line.includes(" ")));
    assert.equal(tight("a b"), `a${NBSP}b`);
  });
});
