import assert from "node:assert/strict";
import { describe, it } from "node:test";
import sharp from "sharp";
import { isCardReady, preferredPickerDefault } from "@/lib/archive/picker-default";
import { studioNotesOf, withStudioNotes } from "@/lib/dashboard/studio-notes";
import { checkPhotoQuality, lowResolutionWarning, MIN_SHARPNESS } from "@/lib/dashboard/match-photo/quality";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { NO_PHOTO_NOTE, resultFallbackPlan } from "@/lib/dashboard/match-result-art";
import { droppedPageNote } from "@/lib/dashboard/set-pages";
import { inspectImageBytes, type UploadedImage } from "@/lib/dashboard/studio-images";
import { jobNotes, reportJobNote, startStudioJob, studioJobView } from "@/lib/jobs/studio-jobs";
import type { ArchivePickerData, PickerPhoto } from "@/types/archive";

/**
 * Dayanıklılık (canlı test 2026-10-31): koşullar eksikken de kart üretilsin — fotoğrafsız yedek tasarım seçimi,
 * Fal yok/hata → büyütmesiz devam (keskinlik kuralı aynen), Anthropic yok/hata → kural tabanlı + sebep, düşen sayfa
 * notu, stüdyo notlarının taslağa taşınması. Ağ yok: büyütücü, kesimci ve Anthropic istemcisi enjekte edilir.
 */

async function photo(width: number, height: number, blur = 0): Promise<UploadedImage> {
  const cells = Array.from({ length: 24 }, (_, i) => `<rect x="${(i % 6) * (width / 6)}" y="${Math.floor(i / 6) * (height / 4)}" width="${width / 12}" height="${height / 8}" fill="${i % 2 ? "#e8e8e8" : "#1a1a1a"}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#6a7a5a"/>${cells}</svg>`;
  const base = sharp(Buffer.from(svg));
  const inspected = await inspectImageBytes(await (blur > 0 ? base.blur(blur) : base).jpeg({ quality: 92 }).toBuffer(), "test");
  assert.ok(inspected.ok);
  return inspected.data;
}

const falDown = async () => ({ ok: false as const, error: { code: "NOT_CONFIGURED", message: "Maç fotoğrafı büyütülemedi (AI Upscale): FAL_KEY tanımlı değil — .env.local dosyasını doldurun." } });

describe("Fal yok/hata: büyütmesiz devam, keskinlik kuralı aynen", () => {
  it("küçük ama net fotoğraf: kart ORİJİNAL çözünürlükle sürer, 'Düşük çözünürlük' uyarısı, ücret 0", async () => {
    const small = await photo(864, 486);
    const result = await checkPhotoQuality(small, falDown);
    assert.ok(result.ok, result.ok ? "" : result.error.message);
    assert.equal(result.data.image, small);
    assert.deepEqual([result.data.upscaled, result.data.paidCalls], [false, 0]);
    assert.equal(result.data.warnings[0], "Düşük çözünürlük: fotoğraf büyütülemedi (FAL_KEY tanımlı değil — .env.local dosyasını doldurun) — kart orijinal çözünürlükle üretildi.");
  });

  it("küçük ve bulanık fotoğraf: büyütülemese de keskinlik kapısı kartı durdurur (MIN_SHARPNESS değişmedi)", async () => {
    assert.equal(MIN_SHARPNESS, 45);
    const result = await checkPhotoQuality(await photo(900, 600, 6), falDown);
    assert.ok(!result.ok);
    assert.equal(result.error.code, "PHOTO_TOO_SOFT");
    assert.doesNotMatch(result.error.message, /AI büyütmeden sonra/u, "büyütme olmadı — mesaj kaynağı söyler");
  });

  it("uyarı metni: önekler atılır, sebep korunur", () => {
    assert.equal(lowResolutionWarning("Ev sahibi oyuncu fotoğrafı büyütülemedi (AI Upscale): TIMEOUT."), "Düşük çözünürlük: fotoğraf büyütülemedi (TIMEOUT) — kart orijinal çözünürlükle üretildi.");
    assert.match(lowResolutionWarning(""), /bilinmeyen hata/u);
  });

  it("iş içinde not düşer (tekrarsız) ve taslağın studioNotes'una taşınır", async () => {
    const started = startStudioJob({
      kind: "test",
      key: `resilience-${Date.now()}`,
      firstStep: "başla",
      run: async () => {
        await checkPhotoQuality(await photo(864, 486), falDown);
        reportJobNote("Düşük çözünürlük: fotoğraf büyütülemedi (FAL_KEY tanımlı değil — .env.local dosyasını doldurun) — kart orijinal çözünürlükle üretildi.");
        return withStudioNotes({ kind: "MATCH_RESULT", studioNotes: ["02 düştü"] }, jobNotes());
      },
      fail: () => null,
    });
    for (let i = 0; i < 200 && studioJobView(started.jobId).status === "running"; i++) await new Promise((resolve) => setTimeout(resolve, 10));
    const view = studioJobView(started.jobId);
    assert.equal(view.status, "done");
    const notes = studioNotesOf(view.status === "done" ? view.value : null);
    assert.equal(notes.length, 2);
    assert.equal(notes[0], "02 düştü");
    assert.match(notes[1] ?? "", /^Düşük çözünürlük/u);
    assert.deepEqual(jobNotes(), [], "iş dışında not yok");
    assert.equal(withStudioNotes(null, ["x"]), null);
  });
});

describe("fotoğrafsız yedek tasarım seçimi", () => {
  const facts = (outcome: "HOME" | "AWAY" | "DRAW") => ({
    outcome,
    competition: { kind: "SUPER_LIG" as const, name: "Trendyol Süper Lig", leagueId: 203, logoUrl: "" },
    home: { id: 607, name: "Konyaspor", logoUrl: "", goals: 0, scorers: [], colorHex: "#0A7A3A" },
    away: { id: 645, name: "Galatasaray", logoUrl: "", goals: 4, scorers: [], colorHex: "#A90432" },
  });

  it("Maç Sonucu: kazanan takım (beraberlikte ev sahibi), arma yazısız bölgede; 16:9'da sol yarı", () => {
    const portrait = resultFallbackPlan({ facts: facts("AWAY"), frame: MATCH_DAY_FRAMES.IG_PORTRAIT, template: "FULL_FRAME", accentHex: "#FDB912" });
    assert.equal(portrait.team, "away");
    assert.equal(portrait.options.side, "center");
    assert.equal(resultFallbackPlan({ facts: facts("DRAW"), frame: MATCH_DAY_FRAMES.IG_PORTRAIT, template: "FULL_FRAME", accentHex: "#FFFFFF" }).team, "home");
    const landscape = resultFallbackPlan({ facts: facts("HOME"), frame: MATCH_DAY_FRAMES.X_LANDSCAPE, template: "BIG_SCORE", accentHex: "#FFFFFF" });
    assert.equal(landscape.options.side, "home");
    assert.ok((landscape.options.focus?.x ?? 1) < 0.5, "yazı sütunu sağda → arma solda");
    assert.match(NO_PHOTO_NOTE, /Gerçek maç fotoğrafı önerilir/u);
  });
});

describe("Fal yokken fotoğraf varsayılanı karta hazır olanı seçer", () => {
  const pic = (id: string, width: number, height: number, upscaled: boolean, bucket: PickerPhoto["bucket"] = "CURRENT_KIT"): PickerPhoto => ({ id, url: `/p/${id}`, caption: "", kind: "CELEBRATION", kitTeamName: "GS", kitTeamId: 645, bucket, width, height, upscaled });
  const data: ArchivePickerData = {
    warnings: [],
    teams: [
      {
        teamId: 645,
        name: "Galatasaray",
        groups: [
          { group: "TEAM", label: "Takım", subjects: [{ key: "team:645", label: "Takım fotoğrafı", personApiId: null, isPlayer: false }] },
          { group: "FW", label: "Forvet", subjects: [{ key: "person:osimhen", label: "Victor Osimhen", personApiId: 2780, isPlayer: true }, { key: "person:batrakov", label: "Batrakov", personApiId: 9, isPlayer: true }] },
        ],
        photos: { "team:645": [pic("takim", 864, 486, false)], "person:osimhen": [pic("osimhen", 480, 640, true)], "person:batrakov": [] },
      },
    ],
  };

  it("canlı test: MVP fotoğrafsız → Fal varken takım fotoğrafı (864×486), Fal yokken büyütülmüş sürümü olan Osimhen", () => {
    assert.equal(isCardReady({ upscaled: false, width: 864, height: 486 }), false);
    assert.equal(isCardReady({ upscaled: false, width: 1920, height: 1080 }), true);
    assert.equal(isCardReady({ upscaled: true, width: 480, height: 640 }), true);
    assert.deepEqual(preferredPickerDefault(data, { teamId: 645, playerId: 9 }), { subjectKey: "team:645", photoId: "takim" });
    assert.deepEqual(preferredPickerDefault(data, { teamId: 645, playerId: 9, falAvailable: false }), { subjectKey: "person:osimhen", photoId: "osimhen" });
  });

  it("karta hazır fotoğraf hiç yoksa normal sıraya döner (kart yine üretilir, düşük çözünürlük uyarısıyla)", () => {
    const none: ArchivePickerData = { ...data, teams: data.teams.map((team) => ({ ...team, photos: { ...team.photos, "person:osimhen": [] } })) };
    assert.deepEqual(preferredPickerDefault(none, { teamId: 645, playerId: 9, falAvailable: false }), { subjectKey: "team:645", photoId: "takim" });
  });
});

describe("sayfa bazında yerleşim: düşen sayfanın notu", () => {
  it("kapı mesajı tekrarsız, 'diğer sayfalar üretildi'", () => {
    assert.equal(
      droppedPageNote("02 · Devre devre", "Maç Analizi 02 · Devre devre (4:5) yerleşimi bozuk — kart üretilmedi: olgu satırı güvenli kenarı 18px aşıyor."),
      "02 · Devre devre sayfası üretilmedi — Maç Analizi 02 · Devre devre (4:5) yerleşimi bozuk: olgu satırı güvenli kenarı 18px aşıyor. Diğer sayfalar üretildi.",
    );
    assert.equal(droppedPageNote("02 · Analiz", "Yasaklı sözcük: bahis — kart üretilmedi."), "02 · Analiz sayfası üretilmedi — Yasaklı sözcük: bahis. Diğer sayfalar üretildi.");
  });
});
