import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { clubColors } from "@/lib/dashboard/club-colors";
import { isSimilarColor, nearReadable, toHsl } from "@/lib/dashboard/color-math";
import { logoSwatches } from "@/lib/dashboard/logo-swatches";
import { logoTeamColors } from "@/lib/dashboard/team-color-pick";
import { extractLeagueTeamColors, warmWithStore, type TeamColorRef, type TeamColorRow, type TeamColors, type TeamColorStore } from "@/lib/dashboard/team-color-warm";
import { sideColors } from "@/lib/dashboard/vitrin-card";

/**
 * Canlı test 2026-10-31, madde 11: Fiorentina mor yerine kırmızı (logodan otomatik renk küçük kırmızı zambağı
 * seçti), Göztepe kırmızısı Fenerbahçe karşısında nötr gümüşe düştü, kapsanan liglerin bütün takımları için
 * logodan renk → admin onay listesi. Testler DB'siz (bellek içi depo) ve ağsız (sentetik logo).
 */

const FB = 611;
const GS = 645;
const GOZTEPE = 994;
const hue = (hex: string) => toHsl(hex)[0] * 360;

/** Fiorentina'ya benzeyen sentetik arma: şeffaf zemin, mor kalkan (geniş alan), ortada küçük kırmızı zambak. */
async function fiorentinaLikeLogo(): Promise<string> {
  const size = 128;
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const inShield = x >= 14 && x < 114 && y >= 8 && y < 120;
      const inLily = x >= 50 && x < 78 && y >= 44 && y < 76;
      const [r, g, b, a] = !inShield ? [0, 0, 0, 0] : inLily ? [228, 38, 30, 255] : [92, 52, 140, 255];
      pixels.set([r, g, b, a], i);
    }
  }
  const png = await sharp(pixels, { raw: { width: size, height: size, channels: 4 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

describe("logodan otomatik renk — baskın alan önce", () => {
  it("Fiorentina benzeri arma: mor alan kırmızı zambağı geçer (gerçek Vibrant hattı)", async () => {
    const swatches = await logoSwatches("test:fiorentina-like", await fiorentinaLikeLogo());
    assert.ok(swatches?.populations, "swatch nüfusu çıkarılır");
    const colors = logoTeamColors(swatches);
    assert.ok(colors);
    assert.ok(hue(colors.primary) > 250 && hue(colors.primary) < 290, `birincil mor olmalı: ${colors.primary}`);
  });

  it("gerçek Fiorentina logosunun swatch'ları (2026-10-31 okuması): nüfusla mor, nüfussuz eski sırada kırmızı", () => {
    const real = { chromaticShare: 0.74, vibrant: "#e4261e", darkVibrant: "#5c348c", lightVibrant: "#f49c94", muted: "#795ca1", darkMuted: "#643c8c", lightMuted: "#cdafc8" };
    const populations = { vibrant: 748, darkVibrant: 2485, lightVibrant: 6, muted: 330, darkMuted: 7, lightMuted: 188 };
    assert.equal(logoTeamColors({ ...real, populations })?.primary, "#5C348C");
    assert.equal(logoTeamColors({ ...real, populations })?.secondary, "#E4261E");
    assert.equal(logoTeamColors(real)?.primary, "#E4261E", "nüfus yoksa eski sıra (geri uyum)");
  });

  it("Fiorentina kulüp tablosunda: mor / beyaz", () => {
    assert.deepEqual(clubColors(502), { name: "Fiorentina", primary: "#4B2A84", secondary: "#FFFFFF" });
  });
});

describe("renk çakışması — ton farkı", () => {
  it("Göztepe kırmızısı Fenerbahçe sarısı/lacivertiyle çakışmaz; iki doygun kırmızı ve iki sarı çakışır", () => {
    assert.equal(isSimilarColor("#E30613", "#FFED00"), false);
    assert.equal(isSimilarColor("#E30613", "#163962"), false);
    assert.equal(isSimilarColor("#E30613", "#FDB912"), false, "GS sarısı");
    assert.equal(isSimilarColor("#E30613", "#A90432"), true, "GS kırmızısı (Gençlerbirliği 0-1 Galatasaray vakası)");
    assert.equal(isSimilarColor("#FFD200", "#FFED00"), true, "Göztepe sarısı = FB sarısı");
    assert.equal(isSimilarColor("#FFD200", "#FDB912"), true, "Göztepe sarısı = GS sarısı");
  });

  it("vitrin: Göztepe kırmızısı sınırın hemen altında (4,10) — az yükseltilip kullanılır, nötr gümüşe düşmez", () => {
    const [fb, goztepe] = sideColors(FB, GOZTEPE);
    assert.equal(fb, "#FFED00");
    assert.ok(hue(goztepe) < 10 || hue(goztepe) > 350, `Göztepe kırmızı olmalı: ${goztepe}`);
    const [gs, goztepeVsGs] = sideColors(GS, GOZTEPE);
    assert.equal(gs, "#FDB912", "GS bordosu çok koyu — sarıya geçer (bordo → pembe yok)");
    assert.ok(hue(goztepeVsGs) < 10 || hue(goztepeVsGs) > 350, `GS sarısına karşı Göztepe kırmızısı: ${goztepeVsGs}`);
  });

  it("nearReadable: okunur renk aynen, sınır altı az yükseltilir, koyu bordo düşer", () => {
    assert.equal(nearReadable("#FFED00"), "#FFED00");
    const red = nearReadable("#E30613");
    assert.ok(red && toHsl(red)[2] - toHsl("#E30613")[2] <= 0.06 + 1e-9);
    assert.equal(nearReadable("#A90432"), null);
    assert.equal(nearReadable("#163962"), null);
  });
});

/** Bellek içi depo: kayıtlar + çıkarılan renkler; logo çıkarma sabit tablodan. */
function memoryStore(rows: TeamColorRow[], logos: Record<number, TeamColors | null>): TeamColorStore & { created: TeamColorRow[]; extracted: number[] } {
  const created: TeamColorRow[] = [];
  const extracted: number[] = [];
  return {
    created,
    extracted,
    rows: async (ids) => rows.filter((row) => ids.includes(row.teamId)),
    extract: async (team: TeamColorRef) => {
      extracted.push(team.id);
      return logos[team.id] ?? null;
    },
    create: async (team, colors) => {
      created.push({ teamId: team.id, teamName: team.name, ...colors, status: "AUTO" });
    },
  };
}

describe("bütün liglerin takım renkleri — admin işi (DB'siz)", () => {
  it("tablo ve kayıtlı takıma dokunulmaz (onaylı ezilmez); kalan logodan AUTO; ligler arası tekrar bir kez", async () => {
    const store = memoryStore([{ teamId: 910002, teamName: "Onaylı FK", primary: "#123456", secondary: "#FFFFFF", status: "APPROVED" }], { 910001: { primary: "#1E5AA8", secondary: "#FFFFFF" }, 910003: null });
    const teams: Record<number, TeamColorRef[]> = {
      135: [{ id: 502, name: "Fiorentina", logoUrl: "l/502" }, { id: 910001, name: "Oto FK", logoUrl: "l/1" }, { id: 910002, name: "Onaylı FK", logoUrl: "l/2" }],
      3: [{ id: 910001, name: "Oto FK", logoUrl: "l/1" }, { id: 910003, name: "Logosuz FK", logoUrl: "l/3" }],
    };
    const steps: string[] = [];
    const report = await extractLeagueTeamColors(
      [135, 3, 999],
      { season: async (leagueId) => (leagueId === 999 ? null : 2026), teams: async (leagueId) => teams[leagueId] ?? null },
      store,
      (step) => steps.push(step.kind),
    );
    assert.deepEqual(report, { teams: 4, table: 1, existing: 1, created: 1, noColor: 1, failedLeagues: [999] });
    assert.deepEqual(store.created.map((row) => row.teamId), [910001]);
    assert.deepEqual(store.extracted.sort(), [910001, 910003], "tablodaki ve kayıtlı takım için logo okunmaz");
    assert.deepEqual(steps, ["league", "league", "league", "extract"]);
    assert.equal(clubColors(910001)?.primary, "#1E5AA8", "yeni AUTO renk kartlara hemen geçer");
  });

  it("kart akışı (warmTeamColors) aynı çekirdekten: logosuz takım için çıkarma denenmez", async () => {
    const store = memoryStore([], {});
    const outcomes = await warmWithStore([{ id: 910004, name: "Adres yok", logoUrl: null }], store);
    assert.equal(outcomes.get(910004), "no-color");
    assert.deepEqual(store.extracted, []);
  });
});
