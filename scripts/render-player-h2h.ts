/**
 * Oyuncu karşılaştırma kartı offline render — DB'ye yazmaz, deploy'suz tasarım aracı. Oyuncu verisi
 * API-Football'dan (boşlar Sportmonks'tan) okunur — yalnızca okuma. Fotoğraflar `--photo-left` /
 * `--photo-right` (repo dışında; telifli fotoğraflar git'e girmez), verilmeyen taraf sentetik. Fal yok.
 * Her format için 01 Poster, 02 İstatistikler ve ikisi yan yana (`-pair`) + rapor (gelen/düşen
 * istatistikler, kaynaklar, uyarılar). Çıktılar `--out` klasörüne (repoya YAZMAYIN).
 *
 *   npx tsx --env-file=.env --env-file=.env.local scripts/render-player-h2h.ts --out C:\...\h2h \
 *     --left 306:998 --right 30415:549 [--left-name "Mohamed Salah"] [--right-name "Dušan Vlahović"] \
 *     [--scope LEAGUE|ALL] [--mode TOTAL|PER90] [--formats IG_PORTRAIT|all] [--photo-left a.jpg] [--photo-right b.jpg]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { buildH2HCard } from "@/lib/dashboard/player-h2h-card";
import { loadPlayerSeasonStats } from "@/lib/dashboard/player-h2h-data";
import { faceThumb } from "@/lib/dashboard/player-h2h-photo";
import { renderH2HImages } from "@/lib/dashboard/player-h2h-render";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { defaultMode } from "@/lib/player-h2h/stats";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import type { H2HMode, H2HScope } from "@/types/player-h2h";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    left: { type: "string" },
    right: { type: "string" },
    "left-name": { type: "string" },
    "right-name": { type: "string" },
    scope: { type: "string", default: "LEAGUE" },
    mode: { type: "string" },
    formats: { type: "string", default: "IG_PORTRAIT" },
    "photo-left": { type: "string" },
    "photo-right": { type: "string" },
  },
});

/** Sentetik fotoğraf çalışma anında yüklenir (Docker derleme bağlamında tests/ yok — bkz. render-vitrin.ts). */
async function syntheticPhoto(): Promise<Buffer> {
  const modulePath = "../tests/visual/synthetic-photo";
  const loaded = (await import(modulePath)) as { syntheticPhoto: () => Promise<Buffer> };
  return loaded.syntheticPhoto();
}

function parsePlayer(value: string | undefined, flag: string): { playerId: number; teamId: number } {
  const [player, team] = (value ?? "").split(":").map(Number);
  if (!player || !team) throw new Error(`--${flag} <oyuncuId>:<takımId> gerekli (API-Football kimlikleri).`);
  return { playerId: player, teamId: team };
}

async function photo(file: string | undefined) {
  const bytes = file ? await readFile(file) : await syntheticPhoto();
  const image = await inspectImageBytes(bytes, file ? path.basename(file) : "sentetik");
  if (!image.ok) throw new Error(image.error.message);
  return image.data;
}

async function sideBySide(left: Buffer, right: Buffer): Promise<Buffer> {
  const { width = 0, height = 0 } = await sharp(left).metadata();
  const gap = 24;
  return sharp({ create: { width: width * 2 + gap, height, channels: 3, background: "#1a1b20" } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: width + gap, top: 0 }])
    .png()
    .toBuffer();
}

async function main() {
  if (!values.out) throw new Error("--out klasörü gerekli (repo dışında).");
  const outDir = path.resolve(values.out);
  await mkdir(outDir, { recursive: true });
  const scope = values.scope as H2HScope;
  const [leftReq, rightReq] = [parsePlayer(values.left, "left"), parsePlayer(values.right, "right")];
  const [left, right] = await Promise.all([
    loadPlayerSeasonStats({ ...leftReq, scope, fullName: values["left-name"] ?? null }),
    loadPlayerSeasonStats({ ...rightReq, scope, fullName: values["right-name"] ?? null }),
  ]);
  if (!left.ok) throw new Error(`Sol oyuncu: ${left.error.message}`);
  if (!right.ok) throw new Error(`Sağ oyuncu: ${right.error.message}`);
  const mode = (values.mode as H2HMode | undefined) ?? defaultMode(left.data.minutes, right.data.minutes);

  const photos = { home: await photo(values["photo-left"]), away: await photo(values["photo-right"]) };
  const [leftLogo, rightLogo, brandLogo, leftFace, rightFace] = await Promise.all([
    resolveImage(left.data.teamLogo ?? undefined, 300),
    resolveImage(right.data.teamLogo ?? undefined, 300),
    loadBrandLogo(),
    faceThumb(photos.home),
    faceThumb(photos.away),
  ]);
  const images = { leftLogo, rightLogo, leftFace, rightFace, brandLogo };

  const formats = values.formats === "all" ? [...MATCH_DAY_FORMAT_IDS] : (values.formats.split(",") as MatchDayFormatId[]);
  const files: string[] = [];
  const perFormat: Record<string, unknown> = {};
  for (const format of formats) {
    const frame = MATCH_DAY_FRAMES[format];
    const built = buildH2HCard({ left: left.data, right: right.data, mode, match: null, images, frame });
    if (!built.ok) {
      console.log(`${format}: KART ÜRETİLMEDİ — ${built.error.message}`);
      continue;
    }
    const rendered = await renderH2HImages({ card: built.data.card, frame, photos, seedKey: `h2h-${left.data.playerId}-${right.data.playerId}` });
    if (!rendered.ok) {
      console.log(`${format}: KART ÜRETİLMEDİ — ${rendered.error.message}`);
      continue;
    }
    const [poster, compare] = rendered.data;
    const base = path.join(outDir, `h2h-${left.data.playerId}-${right.data.playerId}-${format}`);
    await writeFile(`${base}-01-poster.png`, poster);
    await writeFile(`${base}-02-istatistik.png`, compare);
    await writeFile(`${base}-pair.png`, await sideBySide(poster, compare));
    files.push(`${base}-pair.png`);
    const { card, warnings, dropped } = built.data;
    perFormat[format] = { rows: card.rows.map((r) => `${r.label}: ${r.leftText} – ${r.rightText}`), hero: card.hero.map((r) => r.label), fact: card.fact, warnings, dropped };
  }

  const summary = (p: typeof left.data) => ({ name: p.fullName, team: p.teamName, position: p.position, scope: `${p.seasonLabel} ${p.scope}`, competitions: p.competitions.map((c) => c.name), appearances: p.appearances, minutes: p.minutes, penaltyGoals: p.penaltyGoals, values: p.values, sources: p.sources, freshness: p.freshness, faceFound: p === left.data ? leftFace !== null : rightFace !== null });
  const report = { mode, left: summary(left.data), right: summary(right.data), formats: perFormat, photos: { left: values["photo-left"] ? "verilen dosya (repo dışında)" : "sentetik", right: values["photo-right"] ? "verilen dosya (repo dışında)" : "sentetik" }, files };
  await writeFile(path.join(outDir, `report-${left.data.playerId}-${right.data.playerId}.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
