import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { contrastRatio } from "@/lib/dashboard/color-math";
import { planFallbackType, posterTypeBounds, TYPE_HEIGHT_RATIO, TYPE_MIN_SCALE, type FallbackTypePlan } from "@/lib/dashboard/fallback-type";
import { socialFrame } from "@/lib/dashboard/lineup-hero-art";
import { EMBLEM_GAP, EMBLEM_MIN_SCALE, emblemGeometry, placeEmblem } from "@/lib/dashboard/match-day-emblem";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { getMatchDayLayout } from "@/lib/dashboard/match-day-layouts";
import { h2hGeometries } from "@/lib/dashboard/player-h2h-render";
import { fallbackTypePlan } from "@/lib/dashboard/team-fallback-art";
import { fallbackPanelTypeBounds } from "@/lib/dashboard/vitrin-photo";
import { lineupGeometry } from "@/skills/render-engine/templates/lineup/lineup-geometry";
import { fallbackTones, FALLBACK_GLOW_CONTRAST, mixHex } from "@/skills/render-engine/templates/shared/team-fallback";
import { posterGeometry } from "@/skills/render-engine/templates/vitrin/geometry";
import { MATCH_DAY_FORMAT_IDS, MATCH_DAY_TEMPLATE_IDS } from "@/types/match-day";
import { SOCIAL_FORMAT_IDS } from "@/types/studio-formats";
import type { FrameBox } from "@/skills/render-engine/templates/match-result/geometry";

/**
 * Yedek tasarım yerleşimi (canlı test v2, 2026-10-31): dev soluk ad kesilmez ve iki ad üst üste binmez; Maç Günü
 * fotoğrafsız tarafın arması oyuncu kesimine değmez; açık takım renginde (sarı) panel beyaz yazıyı bastırmaz.
 * Ad ölçüsü GERÇEK (Anton, Satori çizimi).
 */

/** Gerçek senaryolardaki uzun adlar (takım ve H2H soyadı). */
const NAMES = ["Göztepe SK", "Borussia Mönchengladbach", "SC Paderborn 07", "Wolverhampton Wanderers", "Fenerbahçe", "Aktürkoğlu", "Pléa", "Galatasaray"];

const toCanvas = (panel: FrameBox, plan: FallbackTypePlan) => ({ left: panel.left + plan.left, right: panel.left + plan.left + plan.width, top: panel.top + plan.top, bottom: panel.top + plan.top + plan.height });
const intersects = (a: { left: number; right: number; top: number; bottom: number }, b: typeof a) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function assertInside(label: string, panel: FrameBox, plan: FallbackTypePlan, frameWidth: number) {
  const box = toCanvas(panel, plan);
  assert.ok(plan.left >= 0 && plan.left + plan.width <= panel.right - panel.left, `${label}: ad panelden taşıyor (${plan.text})`);
  assert.ok(box.left >= 0 && box.right <= frameWidth, `${label}: ad tuvalden taşıyor (${plan.text})`);
  assert.ok(plan.top + plan.height <= panel.bottom - panel.top, `${label}: ad panelin altından taşıyor`);
}

describe("yedek tasarım — dev soluk ad planı", () => {
  test("sığmazsa küçülür, tercihin yarısından küçükse kısa ad, o da sığmazsa hiç", () => {
    const measure = (text: string) => text.length * 0.5;
    const panel = { width: 600, height: 400 };
    const full = planFallbackType(["GÖZTEPE"], panel, measure);
    assert.ok(full);
    assert.equal(full.size, Math.round(Math.min(400 * TYPE_HEIGHT_RATIO, 600 * 0.4)));
    const short = planFallbackType(["BORUSSIA MÖNCHENGLADBACH", "M'GLADBACH"], panel, measure);
    assert.equal(short?.text, "M'GLADBACH");
    assert.ok((short?.size ?? 0) >= Math.round(400 * TYPE_HEIGHT_RATIO) * TYPE_MIN_SCALE);
    assert.equal(planFallbackType(["BORUSSIA MÖNCHENGLADBACH", "M'GLADBACH"], { width: 200, height: 400 }, measure), null);
  });

  test("Kahraman Liste kapağı: ad bütün formatlarda panel ve tuval içinde (gerçek ölçü)", async () => {
    for (const format of SOCIAL_FORMAT_IDS) {
      const { box } = lineupGeometry(format).photo;
      const frame = socialFrame(format);
      const size = { width: box.right - box.left, height: box.bottom - box.top };
      for (const name of NAMES) {
        const plan = await fallbackTypePlan(name, size, fallbackPanelTypeBounds(box, frame.width, undefined));
        if (plan) assertInside(`Kahraman ${format} ${name}`, box, plan, frame.width);
      }
    }
  });

  test("Maç Sonucu tam kadraj: ad bütün formatlarda tuval içinde", async () => {
    for (const format of MATCH_DAY_FORMAT_IDS) {
      const frame = MATCH_DAY_FRAMES[format];
      const panel = { left: 0, top: 0, right: frame.width, bottom: frame.height };
      for (const name of NAMES) {
        const plan = await fallbackTypePlan(name, frame);
        if (plan) assertInside(`Maç Sonucu ${format} ${name}`, panel, plan, frame.width);
      }
    }
  });

  test("Vitrin ve Oyuncu Karşılaştırması posteri: iki ad çizginin kendi tarafında, kesişmez, kesilmez", async () => {
    for (const format of MATCH_DAY_FORMAT_IDS) {
      const frame = MATCH_DAY_FRAMES[format];
      for (const [kind, photo] of [["Vitrin", posterGeometry(frame).photo], ["H2H", h2hGeometries(frame).poster.photo]] as const) {
        for (const [home, away] of [["Borussia Mönchengladbach", "SC Paderborn 07"], ["Aktürkoğlu", "Pléa"], ["Göztepe SK", "Wolverhampton Wanderers"]] as const) {
          const plans = await Promise.all((["home", "away"] as const).map(async (side) => {
            const panel = photo.panels[side];
            const plan = await fallbackTypePlan(side === "home" ? home : away, { width: panel.right - panel.left, height: panel.bottom - panel.top }, fallbackPanelTypeBounds(panel, frame.width, posterTypeBounds(photo, side)));
            if (plan) assertInside(`${kind} ${format} ${side}`, panel, plan, frame.width);
            return plan ? toCanvas(panel, plan) : null;
          }));
          const [a, b] = plans;
          if (a && b) assert.ok(!intersects(a, b), `${kind} ${format}: "${home}" ile "${away}" adları kesişiyor`);
          // Ev sahibi adı çizginin solunda, deplasman sağında (bant boyunca).
          const lineX = (y: number) => photo.topX + ((photo.bottomX - photo.topX) * (y - photo.region.top)) / (photo.region.bottom - photo.region.top);
          if (a) assert.ok(a.right <= Math.min(lineX(a.top), lineX(a.bottom)), `${kind} ${format}: ev sahibi adı çizgiyi aşıyor`);
          if (b) assert.ok(b.left >= Math.max(lineX(b.top), lineX(b.bottom)), `${kind} ${format}: deplasman adı çizgiyi aşıyor`);
        }
      }
    }
  });
});

describe("Maç Günü — fotoğrafsız tarafın arması (yerleşim kapısı)", () => {
  const box = (left: number, right: number) => () => ({ left, right });

  test("engel yoksa arma tam boyda, içerik kutusunun içinde", () => {
    for (const template of MATCH_DAY_TEMPLATE_IDS) {
      for (const format of MATCH_DAY_FORMAT_IDS) {
        const layout = getMatchDayLayout(template, MATCH_DAY_FRAMES[format]);
        const placed = placeEmblem(layout.away, "away", layout.bounds, null);
        assert.ok(placed, `${template} ${format}`);
        assert.equal(placed.scale, 1);
        assert.ok(placed.crest.left >= layout.bounds.left && placed.crest.right <= layout.bounds.right, `${template} ${format}`);
      }
    }
  });

  test("oyuncunun kolu arma satırlarına uzanırsa arma dışa kayar/küçülür ve boşluk bırakır (Data Driven, bütün formatlar)", () => {
    let placedCount = 0;
    for (const format of MATCH_DAY_FORMAT_IDS) {
      const layout = getMatchDayLayout("DATA_DRIVEN", MATCH_DAY_FRAMES[format]);
      const base = emblemGeometry(layout.away, 1);
      const arm = base.crest.left + Math.round((base.crest.right - base.crest.left) * 0.15);
      const placed = placeEmblem(layout.away, "away", layout.bounds, box(layout.home.centerX - 100, arm));
      if (!placed) continue; // sığmıyorsa kapı reddeder (aşağıdaki test)
      assert.ok(placed.crest.left >= arm + EMBLEM_GAP, `${format}: arma kola değiyor`);
      assert.ok(placed.crest.right <= layout.bounds.right && placed.crest.left >= layout.bounds.left, `${format}: arma içerik kutusundan taşıyor`);
      assert.ok(placed.scale >= EMBLEM_MIN_SCALE);
      placedCount += 1;
    }
    assert.ok(placedCount >= 3, "dikey formatların çoğunda arma kaydırılarak yerleşmeli");
  });

  test("ev sahibi fotoğrafsızsa sola kayar", () => {
    const layout = getMatchDayLayout("PREMIUM_BROADCAST", MATCH_DAY_FRAMES.IG_PORTRAIT);
    const base = emblemGeometry(layout.home, 1);
    const reach = base.crest.right - 30;
    const placed = placeEmblem(layout.home, "home", layout.bounds, box(reach, layout.away.centerX + 100));
    assert.ok(placed && placed.crest.right <= reach - EMBLEM_GAP);
  });

  test("hiçbir ölçek ve konumda sığmıyorsa null (kart üretilmez)", () => {
    for (const template of MATCH_DAY_TEMPLATE_IDS) {
      const layout = getMatchDayLayout(template, MATCH_DAY_FRAMES.IG_PORTRAIT);
      assert.equal(placeEmblem(layout.away, "away", layout.bounds, box(layout.bounds.left, layout.bounds.right - 10)), null, template);
    }
  });
});

describe("yedek tasarım tonları — açık renk paneli metni bastırmaz", () => {
  test("derin ton ve ışığın en parlak noktası beyaz yazıda okunur; sarıda doygunluk düşer", () => {
    for (const hex of ["#FFED00", "#FFD200", "#FDE100", "#FFFFFF", "#6CABDD", "#E30613", "#A90432", "#163962", "#4B2A84", "#00843D"]) {
      const { deep, glow, glowAlpha } = fallbackTones(hex);
      assert.ok(contrastRatio("#ffffff", deep) >= 7, `${hex}: derin ton ${deep}`);
      assert.ok(contrastRatio("#ffffff", mixHex(deep, glow, glowAlpha)) >= FALLBACK_GLOW_CONTRAST, `${hex}: ışık noktası`);
    }
    assert.ok(fallbackTones("#FFED00").glowAlpha <= 0.24);
    assert.equal(fallbackTones("#FFFFFF").deep, "#424242", "renksiz renk renk kazanmaz");
  });

  test("koyu renklerde eski değerler korunur", () => {
    assert.deepEqual(fallbackTones("#A90432"), { deep: "#6b001e", glow: "#ef0647", glowAlpha: 0.5 });
  });
});
