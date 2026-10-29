import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Eşzamanlı Fal/AI çağrısı kalmasın (2026-10-29): sunucu eylemleri ve route handler'larda Fal'a (büyütme,
 * kesim, flux, harmanlama), Anthropic gerekçesine ya da onları tetikleyen fotoğraf/kart hattına giden her
 * çağrı yalnızca arka plan işinin içinde olabilir (`startStudioJob` / `startResultJob`) — Cloudflare'in
 * 100 sn yanıt sınırı. Dışa açık fonksiyonun gövdesi bu çağrıyı doğrudan yapıyorsa test kırılır.
 */

const SLOW_CALL =
  /\b(removeBackground|removePlayerBackground|generateStadiumBackground|generateMatchDayBackground|harmonizeMatchDayComposite|upscaleImage|createArchiveUpscale|photoForCard|createArchivePhoto|resolveArchivePhoto|resolveStudioPhoto|resolveLineupHeroPhoto|resolveH2HPhoto|prepareMatchPhoto|regenerateDraftBackground|createMatchDraft|createMatchDayCard|createMatchResultCard|createVitrinDraft|renderVitrin|createLineupDraft|renderLineupCard|renderH2H|createH2HDraft|renderDraw|createDrawDraft|generateScenarioReasons)\(/;
const JOB = /\bstart(Studio|Result)Job(<[^>]*>)?\(/;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });

/** Dosyayı üst düzey fonksiyon bloklarına böler (bir sonraki üst düzey bildirime kadar). */
function topLevelBlocks(source: string): { name: string; exported: boolean; body: string }[] {
  const blocks: { name: string; exported: boolean; body: string }[] = [];
  let current: { name: string; exported: boolean; lines: string[] } | null = null;
  for (const line of source.split("\n")) {
    const start = /^(export )?(async )?function (\w+)/.exec(line);
    if (start || /^(export )?(const|type|interface) /.test(line)) {
      if (current) blocks.push({ name: current.name, exported: current.exported, body: current.lines.join("\n") });
      current = start ? { name: start[3] ?? "", exported: Boolean(start[1]), lines: [] } : null;
      continue;
    }
    current?.lines.push(line);
  }
  if (current) blocks.push({ name: current.name, exported: current.exported, body: current.lines.join("\n") });
  return blocks;
}

describe("eşzamanlı Fal çağrısı yok", () => {
  it("sunucu eylemleri ve route handler'lar yavaş hatta yalnızca arka plan işinden gider", () => {
    const files = walk("src/app").filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.startsWith('"use server"') || /route\.ts$/.test(file);
    });
    assert.ok(files.length > 10);
    const offenders = files.flatMap((file) =>
      topLevelBlocks(readFileSync(file, "utf8"))
        .filter((block) => block.exported && SLOW_CALL.test(block.body) && !JOB.test(block.body))
        .map((block) => `${file} → ${block.name}`),
    );
    assert.deepEqual(offenders, []);
  });
});
