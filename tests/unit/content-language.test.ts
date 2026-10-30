import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { CONTENT_TYPES } from "@/lib/dashboard/content-types";
import { cardTexts, contentLanguageGate } from "@/lib/prediction/content-language";

/**
 * Bahis dili kapısı BÜTÜN kartlarda (denetim 2026-10-30: Maç Günü, Muhtemel 11, Haftanın Maçları, Puan
 * Durumu, Maç Sonucu ve 02'de yoktu). Tek giriş `contentLanguageGate`: kart metni + gönderi metni; üretimde,
 * onayda (her tür) ve yayında. Bekçi: aktif her içerik türünün üretim yolu kapıyı çağırır; yeni tür eklenip
 * bağlanmazsa bu test kırılır.
 */

const ROOT = process.cwd();
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

/** İçerik türü → kartı ve gönderi metnini üreten dosyalar (hepsi kapıyı çağırmalı). */
const PRODUCTION_PATHS: Record<string, string[]> = {
  MATCH_DAY: ["src/lib/dashboard/match-day-engine.ts"],
  WEEKLY_FIXTURES: ["src/lib/dashboard/weekly-fixtures-engine.ts"],
  PROBABLE_LINEUPS: ["src/lib/dashboard/lineup-engine.ts"],
  AI_MARKET_PREDICTION: ["src/lib/dashboard/vitrin-engine.ts"],
  PLAYER_H2H: ["src/lib/dashboard/player-h2h-engine.ts"],
  DRAWS_AND_PAIRINGS: ["src/lib/dashboard/draw-engine.ts"],
  MATCH_RESULT: ["src/lib/dashboard/match-result-engine.ts", "src/lib/dashboard/match-stats-render.ts", "src/lib/dashboard/player-stats-render.tsx", "src/lib/dashboard/match-analysis-render.tsx", "src/lib/dashboard/prediction-scorecard-render.tsx"],
  MATCH_STATS: ["src/lib/dashboard/match-stats-engine.ts", "src/lib/dashboard/match-stats-render.ts"],
  PLAYER_STATS: ["src/lib/dashboard/player-stats-engine.ts", "src/lib/dashboard/player-stats-render.tsx"],
  STANDINGS: ["src/lib/dashboard/standings-engine.ts"],
  MATCH_ANALYSIS: ["src/lib/dashboard/match-analysis-engine.ts", "src/lib/dashboard/match-analysis-render.tsx"],
  PREDICTION_SCORECARD: ["src/lib/dashboard/prediction-scorecard-engine.ts", "src/lib/dashboard/prediction-scorecard-render.tsx"],
};

describe("bahis dili — ortak tek kapı", () => {
  it("kart metni ve gönderi metni birlikte denetlenir; görsel/renk/adres alanları metin sayılmaz", () => {
    const card = { headline: "MUHTEMEL 11", homeLogo: "data:image/png;base64,AAAA", colorHex: "#ff0000", heroPhotoId: "abc", team: { teamName: "Kasımpaşa", slots: [{ name: "E. Demir" }] } };
    assert.deepEqual(cardTexts(card), { "kart.headline": "MUHTEMEL 11", "kart.team.teamName": "Kasımpaşa", "kart.team.slots.0.name": "E. Demir" });
    assert.equal(contentLanguageGate({ card, caption: "Muhtemel 11'ler hazır. Üst üste 3 galibiyet!" }), null);
    assert.match(contentLanguageGate({ card: { ...card, headline: "BANKO 11" } }) ?? "", /kart\.headline: banko/u);
    assert.match(contentLanguageGate({ card, caption: "Kuponunu hazırla" }) ?? "", /gönderi metni: kupon/u);
  });

  it("aktif her içerik türünün üretim yolu kapıyı çağırır", () => {
    const active = CONTENT_TYPES.filter((type) => type.status === "active").map((type) => type.id);
    assert.deepEqual(active.filter((id) => !PRODUCTION_PATHS[id]), [], "kapı haritasında olmayan aktif tür");
    for (const [id, files] of Object.entries(PRODUCTION_PATHS)) {
      for (const file of files) assert.ok(read(file).includes("contentLanguageGate("), `${id}: ${file} kapıyı çağırmıyor`);
    }
  });

  it("onay her türde, yayın platforma gitmeden önce denetler", () => {
    const approval = read("src/lib/prediction/approval.ts");
    const gate = approval.indexOf("contentLanguageGate(");
    assert.ok(gate > 0 && gate < approval.indexOf("AI_MARKET_PREDICTION"), "onay kapısı tür dallarından önce");
    assert.ok(!approval.includes("DRAWS_AND_PAIRINGS"), "Kura'ya özel hashtag dalı yok — sınır ortak kapıda (caption-format.ts)");
    const publish = read("src/lib/dashboard/publish-engine.ts");
    assert.ok(publish.indexOf("contentLanguageGate(") > 0 && publish.indexOf("contentLanguageGate(") < publish.indexOf("publishToPlatform("), "yayın kapısı platform çağrısından önce");
    assert.ok(read("src/lib/dashboard/draft-engine.ts").includes("contentLanguageGate("), "genel AI stüdyosu taslağı");
  });

  it("kapı dışından doğrudan liste kullanan yer yok (alan adlı kart kapıları hariç)", () => {
    const allowed = new Set(["src/lib/prediction/banned-words.ts", "src/lib/prediction/content-language.ts", "src/lib/dashboard/draw-card.ts", "src/lib/dashboard/player-h2h-card.ts", "src/lib/dashboard/vitrin-card.ts"]);
    const walk = (dir: string): string[] =>
      readdirSync(path.join(ROOT, dir)).flatMap((entry) => {
        const rel = path.join(dir, entry).replaceAll("\\", "/");
        return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.tsx?$/u.test(entry) ? [rel] : [];
      });
    const direct = walk("src").filter((file) => !file.startsWith("src/generated") && !allowed.has(file) && read(file).includes("bannedWordsGate("));
    assert.deepEqual(direct, []);
  });
});
