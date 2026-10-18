import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { CONTENT_TYPES } from "@/lib/dashboard/content-types";
import { describeLayoutIssues, findLayoutIssues, layoutGate, layoutSafeArea, opaqueBounds } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { buildMatchStatsCaption } from "@/lib/dashboard/match-stats-caption";
import { renderMatchStatsImage } from "@/lib/dashboard/match-stats-render";
import { carouselUrls, publishMediaOf } from "@/lib/dashboard/publish-caption";
import { toMatchStatsFacts } from "@/lib/services/api-football/post-match-stats-mappers";
import { SET_PAGE_LABELS } from "@/types/checkmatch-set";
import { RAW_GENCLERBIRLIGI_GALATASARAY } from "../fixtures/api-football/match-result";

const STATS = toMatchStatsFacts(RAW_GENCLERBIRLIGI_GALATASARAY, null);
const FRAME = MATCH_DAY_FRAMES.IG_PORTRAIT;

/** Saydam kart üstünde tek opak dikdörtgen — blok ölçümü için. */
async function block(left: number, top: number, width: number, height: number): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FRAME.width}" height="${FRAME.height}"><rect x="${left}" y="${top}" width="${width}" height="${height}" fill="#fff"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe("katalog", () => {
  it("Maç İstatistikleri aktif, kendi stüdyosu var, maç sonrası", () => {
    const type = CONTENT_TYPES.find((entry) => entry.id === "MATCH_STATS");
    assert.ok(type);
    assert.deepEqual([type.status, type.route, type.phase], ["active", "/dashboard/studio/match-stats", "post_match"]);
  });
});

describe("yerleşim çakışma kontrolü", () => {
  const safe = layoutSafeArea(FRAME);

  it("çakışan iki blok ve güvenli kenarı aşan blok raporlanır; kenar teması (≤2px) sayılmaz", () => {
    const issues = findLayoutIssues(
      [
        { id: "strip", left: 100, top: 900, right: 900, bottom: 1100 },
        { id: "scorers", left: 600, top: 1080, right: 1030, bottom: 1140 },
        { id: "footer-text", left: 64, top: 1140, right: 500, bottom: 1170 },
      ],
      safe,
    );
    assert.deepEqual(
      issues.map((issue) => issue.kind),
      ["OVERLAP", "OUTSIDE_SAFE"],
    );
    assert.match(describeLayoutIssues(issues), /skor şeridi ↔ golcüler çakışıyor \(300×20px\); golcüler güvenli kenarı 14px aşıyor/);
  });

  it("opak sınır kutusu piksellerden ölçülür; boş blok null", async () => {
    assert.deepEqual(await opaqueBounds(await block(120, 300, 40, 25)), { left: 120, top: 300, right: 160, bottom: 325 });
    assert.equal(await opaqueBounds(await sharp({ create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()), null);
  });

  it("üretim kapısı: çakışma varsa kart üretilmez, sebep yazılır", async () => {
    const empty = sharp({ create: { width: FRAME.width, height: FRAME.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const gate = await layoutGate("Maç İstatistikleri", FRAME, (only) => (only === "panel" ? block(64, 120, 952, 700) : only === "strip" ? block(64, 800, 952, 200) : empty));
    assert.ok(!gate.ok);
    assert.equal(gate.error.code, "LAYOUT_OVERLAP");
    assert.match(gate.error.message, /skor şeridi ↔ istatistik paneli çakışıyor \(952×20px\)/);
  });
});

describe("02 görseli (üretim yolu)", () => {
  it("Gençlerbirliği 0-1 Galatasaray: 01 zeminli 02 çizilir, yerleşim kapısından geçer", async () => {
    assert.ok(STATS);
    const resultImage = await sharp({ create: { width: FRAME.width, height: FRAME.height, channels: 3, background: "#3a4660" } }).png().toBuffer();
    const images = { homeLogo: null, awayLogo: null, leagueLogo: null, brandLogo: await loadBrandLogo() };
    const rendered = await renderMatchStatsImage({ stats: STATS, frame: FRAME, page: "SUMMARY", side: "right", resultImage, pageLabel: SET_PAGE_LABELS.STATS, images });
    assert.ok(rendered.ok, rendered.ok ? "" : rendered.error.message);
    const meta = await sharp(rendered.data).metadata();
    assert.deepEqual([meta.width, meta.height], [FRAME.width, FRAME.height]);
  });

  it("gönderi metni: başlık, turnuva, kart değerleriyle aynı biçimde ilk satırlar", () => {
    assert.ok(STATS);
    const lines = buildMatchStatsCaption(STATS).split("\n");
    assert.equal(lines[0], "MAÇ İSTATİSTİKLERİ | Gençlerbirliği 0-1 Galatasaray");
    assert.equal(lines[1], "Trendyol Süper Lig · 8. Hafta");
    assert.ok(lines.some((line) => /Top hakimiyeti.*%31 – %69/i.test(line)), lines.join(" / "));
    assert.ok(lines.length <= 6);
  });
});

describe("Yayın Merkezi — set carousel'i", () => {
  const options = {
    kind: "MATCH_RESULT",
    imageUrl: "/api/files/renders/a.png",
    carousel: [
      { url: "/api/files/renders/a.png", label: "01 · Maç Sonucu" },
      { url: "/api/files/renders/b.png", label: "02 · İstatistikler" },
    ],
  };

  it("iki görsel yayın sırasıyla gelir (01 sonra 02)", () => {
    assert.deepEqual(
      publishMediaOf(options, "/api/files/renders/a.png").map((media) => [media.url, media.label]),
      [
        ["/api/files/renders/a.png", "01 · Maç Sonucu"],
        ["/api/files/renders/b.png", "02 · İstatistikler"],
      ],
    );
    assert.deepEqual(carouselUrls(options), ["/api/files/renders/a.png", "/api/files/renders/b.png"]);
  });

  it("carousel yoksa tek kart (eski Maç Sonucu taslakları dahil)", () => {
    assert.deepEqual(publishMediaOf({ imageUrl: "/api/files/renders/a.png" }, null), [{ url: "/api/files/renders/a.png", label: "Kart" }]);
    assert.deepEqual(carouselUrls({ imageUrl: "/api/files/renders/a.png" }), []);
  });
});
