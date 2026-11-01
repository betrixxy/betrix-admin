import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Kartlarda veri kaynağı yazısı yok (kurucu kararı 2026-11-01): "Veri: API-Football", "xG: Sportmonks",
 * "Puan: API-Football" ve benzeri BÜTÜN atıflar kalktı; xG/xA açıklama dipnotu kalır. Bekçi: kart şablonları, kart
 * kurucuları ve gönderi metinlerinin METİNLERİNDE (yorum ve import hariç) sağlayıcı adı geçmez. Yönetici ekranı
 * (stüdyo özeti, hata mesajı) kapsam dışı — o metinler karta basılmaz.
 */

const PROVIDERS = /API-Football|API Football|Sportmonks|Sofascore|Understat|FBref|\bOpta\b/u;
/** Atıf kalıbı: "Veri: …", "Kaynak: …", "Puan: …" gibi künye önekleri. */
const ATTRIBUTION = /["'`>](?:[^"'`<]*\s)?(?:Veri|Kaynak|Puan|Olaylar|Devre verisi):\s/u;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Yorumlar ve import satırları atılır — kalan kod + metin. */
const stripped = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/gu, "")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|import\s)/u.test(line))
    .map((line) => line.replace(/\s\/\/\s.*$/u, ""))
    .join("\n");

/** Kartlara ve gönderi metinlerine giden her dosya. */
function cardTextFiles(): string[] {
  const root = process.cwd();
  const templates = walk(path.join(root, "src/skills/render-engine/templates"));
  const dashboard = readdirSync(path.join(root, "src/lib/dashboard"))
    .filter((name) => /(-card|-caption|caption-.*|-layout|-render)\.tsx?$/u.test(name))
    .map((name) => path.join(root, "src/lib/dashboard", name));
  const prediction = readdirSync(path.join(root, "src/lib/prediction"))
    .filter((name) => /(card|caption)/u.test(name))
    .map((name) => path.join(root, "src/lib/prediction", name));
  return [...templates, ...dashboard, ...prediction].filter((file) => /\.tsx?$/u.test(file));
}

describe("kartlarda veri kaynağı yazısı yok", () => {
  const files = cardTextFiles();

  it("taranan küme gerçekten kart dosyalarını içerir", () => {
    const names = files.map((file) => path.basename(file));
    for (const expected of ["player-stats-card.ts", "player-h2h-card.ts", "match-analysis-card.ts", "player-stats-caption.ts", "data-driven.tsx"]) assert.ok(names.includes(expected), expected);
    assert.ok(files.length > 50, `yalnızca ${files.length} dosya tarandı`);
  });

  it("sağlayıcı adı kart metinlerinde geçmez", () => {
    const hits = files.flatMap((file) => {
      const quoted = stripped(readFileSync(file, "utf8")).match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`|>[^<>{}\n]+</gu) ?? [];
      return quoted.filter((text) => PROVIDERS.test(text)).map((text) => `${path.relative(process.cwd(), file)}: ${text}`);
    });
    assert.deepEqual(hits, []);
  });

  it("atıf öneki (Veri:, Kaynak:, Puan:, Olaylar:) kart metinlerinde geçmez", () => {
    const hits = files.flatMap((file) => {
      const matched = stripped(readFileSync(file, "utf8")).match(ATTRIBUTION);
      return matched ? [`${path.relative(process.cwd(), file)}: ${matched[0]}`] : [];
    });
    assert.deepEqual(hits, []);
  });

  it("xG/xA açıklama dipnotları kalır", () => {
    const h2h = readFileSync(path.join(process.cwd(), "src/lib/dashboard/player-h2h-card.ts"), "utf8");
    assert.match(h2h, /XG_NOTE/);
    assert.match(h2h, /XA_NOTE/);
    assert.match(readFileSync(path.join(process.cwd(), "src/lib/dashboard/match-stats-card.ts"), "utf8"), /XG_FOOTNOTE/);
  });
});
