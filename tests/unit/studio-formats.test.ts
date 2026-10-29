import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { weeklyColumns, weeklyLayout, weeklyPlan } from "@/lib/dashboard/weekly-fixtures-layout";
import { lineupGeometry } from "@/skills/render-engine/templates/lineup/lineup-geometry";
import { SOCIAL_FORMAT_IDS, SOCIAL_FORMATS, isSocialFormatId, socialFormatCaption } from "@/types/studio-formats";
import type { WeeklyMatch } from "@/types/weekly-fixtures";

const match = (id: number, dateKey: string): WeeklyMatch => ({
  id: `api-football-${id}`,
  kickoffUtc: `${dateKey}T17:00:00Z`,
  dateKey,
  time: "20:00",
  status: "scheduled",
  elapsed: null,
  home: { name: `Ev ${id}`, logoUrl: "", goals: null },
  away: { name: `Dep ${id}`, logoUrl: "", goals: null },
  group: null,
});

/** 12 maç, 4 güne dağılmış (3-3-3-3). */
const twelve = Array.from({ length: 12 }, (_, i) => match(i + 1, `2026-10-${String(9 + Math.floor(i / 3)).padStart(2, "0")}`));

describe("küresel format kaydı", () => {
  it("dört format, CLAUDE.md 3.3 ölçüleri ve güvenli alanları", () => {
    assert.deepEqual(
      SOCIAL_FORMAT_IDS.map((id) => [id, SOCIAL_FORMATS[id].width, SOCIAL_FORMATS[id].height]),
      [
        ["post", 1080, 1350],
        ["story", 1080, 1920],
        ["landscape", 1920, 1080],
        ["square", 1080, 1080],
      ],
    );
    assert.deepEqual([SOCIAL_FORMATS.story.safeTop, SOCIAL_FORMATS.story.safeBottom], [250, 320]);
    assert.equal(socialFormatCaption("story"), "1080×1920 · IG Story / Reels / TikTok (9:16)");
    assert.ok(isSocialFormatId("square"));
    assert.ok(!isSocialFormatId("IG_FEED"));
  });
});

describe("Haftanın Maçları yerleşimi", () => {
  it("4:5 ilk tasarımın ölçüleriyle aynı", () => {
    const post = weeklyLayout("post");
    assert.deepEqual([post.headerTop, post.bodyTop, post.bodyBottom, post.footerTop, post.columns], [64, 300, 1196, 1222, 1]);
  });

  it("Story'de içerik platform bantlarının içinde kalır, gövde 4:5'ten uzun ve ortalanır", () => {
    const story = weeklyLayout("story");
    const post = weeklyLayout("post");
    assert.ok(story.bodyBottom - story.bodyTop > post.bodyBottom - post.bodyTop);
    assert.ok(story.centerBody && !post.centerBody);
    assert.ok(story.headerTop >= SOCIAL_FORMATS.story.safeTop);
    assert.ok(story.footerTop + story.footerHeight <= story.height - SOCIAL_FORMATS.story.safeBottom);
  });

  it("yatayda maçlar iki sütuna eşit dağılır, sınırdaki gün bölünür", () => {
    const sections = [
      { key: "a", label: "A", matches: twelve.slice(0, 5) },
      { key: "b", label: "B", matches: twelve.slice(5, 9) },
    ];
    const columns = weeklyColumns(sections, 2);
    assert.deepEqual(
      columns.map((column) => column.map((section) => [section.key, section.matches.length])),
      [
        [["a", 5]],
        [["b", 4]],
      ],
    );
    const split = weeklyColumns([{ key: "a", label: "A", matches: twelve.slice(0, 7) }], 2);
    assert.deepEqual(
      split.map((column) => column.map((section) => [section.key, section.label, section.matches.length])),
      [[["a", "A", 4]], [["a:1", "A", 3]]],
    );
  });

  it("4 güne yayılmış 12 maç yatay (iki sütun) ve Story'ye sığar; 4:5 ve kareye sığmaz", () => {
    const landscape = weeklyPlan(twelve, "date", weeklyLayout("landscape"));
    assert.ok(landscape && landscape.columns.length === 2 && landscape.rowHeight >= 54);
    // Story: sıkılaştırılmış başlık/imza bandıyla güvenli alanın gövdesi 4:5'ten uzun.
    assert.ok(weeklyPlan(twelve, "date", weeklyLayout("story")));
    for (const id of ["post", "square"] as const) assert.equal(weeklyPlan(twelve, "date", weeklyLayout(id)), null, id);
    assert.ok(weeklyPlan(twelve.slice(0, 9), "date", weeklyLayout("post")));
  });
});

describe("Muhtemel 11 geometrisi", () => {
  it("4:5 ilk tasarımın ölçüleriyle aynı; Story aynı yerleşimi güvenli alana kaydırır", () => {
    const post = lineupGeometry("post");
    assert.deepEqual(post.content, { left: 60, top: 316, width: 960, height: 794 });
    assert.deepEqual([post.footerTop, post.footerInset, post.horizontalPitch], [1120, 50, false]);
    const story = lineupGeometry("story");
    assert.equal(story.content.top - post.content.top, SOCIAL_FORMATS.story.safeTop);
    assert.equal(story.footerInset - post.footerInset, SOCIAL_FORMATS.story.safeBottom);
  });

  it("geniş-basık içerik alanında (kare, yatay) saha yatay çizilir ve kanvasın içinde kalır", () => {
    for (const id of ["square", "landscape"] as const) {
      const g = lineupGeometry(id);
      assert.ok(g.horizontalPitch);
      assert.ok(g.content.left + g.content.width <= g.width && g.content.top + g.content.height <= g.height);
      assert.ok(g.panel.left + g.panel.width <= g.width);
    }
  });
});
