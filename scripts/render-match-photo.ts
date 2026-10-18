/**
 * Maç Sonucu "Tam Kadraj" (A) offline render — DB'siz, deploy'suz tasarım/kalibrasyon aracı.
 * Gerçek maç fotoğrafı yol ile okunur (repo dışında tutulur — telifli fotoğraflar git'e girmez);
 * çıktılar `--out` klasörüne yazılır (scratchpad önerilir, repoya YAZMAYIN).
 *
 *   npx tsx scripts/render-match-photo.ts --photo C:\...\test-photos\foto.jpg --raw fixture.json --out C:\...\scratchpad\mr
 *   npx tsx --env-file=.env.local scripts/render-match-photo.ts --photo ... --fixture 1584435 --out ...
 *
 * Çıktı: 01-<format>.png (Maç Sonucu), 02-<format>.png (İstatistikler — 01'in bulanık/koyu hâli),
 * set-<format>.png (01+02 yan yana), crop-preview.png (4 formatın kırpması + yüzler + yazısız bölge),
 * report.json (yüzler, kırpma, keskinlik, parlaklık, gradyan gücü).
 * Kısa kenar < 1080 ise Fal upscale gerekir: yalnızca `--allow-upscale` ile (ücretli, tek çağrı).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { resolveSetImages } from "@/lib/dashboard/checkmatch-set";
import { MATCH_DAY_FRAMES, type MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { prepareMatchPhoto, type PreparedMatchPhoto } from "@/lib/dashboard/match-photo";
import { falPhotoUpscaler, measureSharpness, photoUpscaleFactor, type PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { buildMatchResultCard } from "@/lib/dashboard/match-result-card";
import { renderMatchResultOverlay } from "@/lib/dashboard/match-result-overlay";
import { COMPETITION_COLORS, resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { buildStatsBackgroundFromResult } from "@/lib/dashboard/match-stats-background";
import { buildMatchStatsCard } from "@/lib/dashboard/match-stats-card";
import { renderMatchStatsOverlay } from "@/lib/dashboard/match-stats-overlay";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import { toMatchStatsFacts } from "@/lib/services/api-football/post-match-stats-mappers";
import { apiFootballFixtureResultsResponseSchema, type ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { matchResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";
import { SET_PAGE_LABELS } from "@/types/checkmatch-set";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";

const { values } = parseArgs({
  options: {
    photo: { type: "string" },
    raw: { type: "string" },
    fixture: { type: "string" },
    out: { type: "string" },
    formats: { type: "string", default: "IG_PORTRAIT" },
    "allow-upscale": { type: "boolean", default: false },
    /** Fal yerine sharp lanczos büyütme — yalnızca ücretsiz ön değerlendirme; çıktı adları "preview-" ile başlar. */
    "local-upscale": { type: "boolean", default: false },
    "no-mvp": { type: "boolean", default: false },
  },
});

async function loadRaw(): Promise<ApiFootballFixtureResultRaw> {
  if (values.raw) {
    const parsed = apiFootballFixtureResultsResponseSchema.parse(JSON.parse(await readFile(values.raw, "utf8")));
    const raw = parsed.response[0];
    if (!raw) throw new Error("--raw dosyasında maç yok");
    return raw;
  }
  if (!values.fixture) throw new Error("--raw <json> ya da --fixture <API-Football id> verin");
  const { getMatchResultRaw } = await import("@/lib/services/api-football");
  const result = await getMatchResultRaw(Number(values.fixture));
  if (!result.ok || !result.data) throw new Error(`Maç alınamadı: ${result.ok ? "bulunamadı" : result.error.message}`);
  return result.data;
}

/** Kaynak fotoğraf küçültülmüş + kırpma kutusu, yazısız bölge ve yüzler (SVG) — format başına bir pano. */
async function cropPreview(photo: Buffer, size: { width: number; height: number }, frame: MatchDayFrame, prepared: PreparedMatchPhoto): Promise<Buffer> {
  const width = 900;
  const s = width / size.width;
  const height = Math.round(size.height * s);
  const { box } = prepared.crop;
  const k = box.width / frame.width;
  const safe = matchResultGeometry(frame).photoSafe;
  const rect = (x: number, y: number, w: number, h: number, stroke: string, dash = "") =>
    `<rect x="${x * s}" y="${y * s}" width="${w * s}" height="${h * s}" fill="none" stroke="${stroke}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    ${rect(box.left, box.top, box.width, box.height, "#00e5ff")}
    ${rect(box.left + safe.left * k, box.top + safe.top * k, (safe.right - safe.left) * k, (safe.bottom - safe.top) * k, "#ffd400", "10 8")}
    ${prepared.faces.map((f) => rect(f.x, f.y, f.width, f.height, "#ff2d55")).join("")}
    <rect x="0" y="0" width="${width}" height="34" fill="rgba(0,0,0,0.7)"/>
    <text x="12" y="23" font-family="sans-serif" font-size="18" fill="#fff">${frame.id} · ${prepared.crop.anchor} · zoom ${prepared.crop.zoom} · yüz ${prepared.faces.length} · güvenli: ${prepared.crop.facesInSafe ? "evet" : "HAYIR"} · gradyan ${prepared.shadeStrength}</text>
  </svg>`;
  return sharp(photo).rotate().resize(width).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

/** Ücretsiz yerel büyütme (lanczos) — Fal ESRGAN'ın yerine değil, yalnızca kadraj/okunurluk ön değerlendirmesi. */
const localUpscale: PhotoUpscaler = async (image, scale) => {
  const bytes = await sharp(image.bytes).resize(image.width * scale, image.height * scale, { kernel: "lanczos3" }).jpeg({ quality: 95 }).toBuffer();
  return inspectImageBytes(bytes, "Yerel büyütülmüş önizleme");
};

async function sideBySide(left: Buffer, right: Buffer, frame: MatchDayFrame): Promise<Buffer> {
  const gap = 24;
  return sharp({ create: { width: frame.width * 2 + gap, height: frame.height, channels: 3, background: "#ffffff" } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: frame.width + gap, top: 0 }])
    .png()
    .toBuffer();
}

async function main() {
  if (!values.photo || !values.out) throw new Error("--photo <yol> ve --out <klasör> zorunlu");
  const out = path.resolve(values.out);
  await mkdir(out, { recursive: true });

  const raw = await loadRaw();
  const facts = toMatchResultFacts(raw);
  const stats = toMatchStatsFacts(raw, null);
  if (!facts || !stats) throw new Error("Maç bitmemiş — kart yalnızca FT/AET/PEN için.");

  const photoBytes = await readFile(values.photo);
  const inspected = await inspectImageBytes(photoBytes, "Maç fotoğrafı");
  if (!inspected.ok) throw new Error(inspected.error.message);

  const accentHex = resultAccentHex(facts);
  const deepHex = COMPETITION_COLORS[facts.competition.kind]?.deep;
  const images = await resolveSetImages(facts, async () => null);
  const formats = values.formats === "all" ? [...MATCH_DAY_FORMAT_IDS] : (values.formats.split(",") as MatchDayFormatId[]);
  const previews: Buffer[] = [];
  const report: Record<string, unknown> = {
    photo: path.basename(values.photo),
    size: [inspected.data.width, inspected.data.height],
    upscaleFactor: photoUpscaleFactor(inspected.data),
    sourceSharpness: Math.round(await measureSharpness(inspected.data.bytes)),
    upscaleMode: values["allow-upscale"] ? "fal" : values["local-upscale"] ? "local-preview" : "none",
    accentHex,
  };
  const prefix = values["local-upscale"] && !values["allow-upscale"] ? "preview-" : "";

  // Büyütme fotoğraf başına BİR kez (4 format aynı sonucu paylaşır) — Fal açıkken tek ücretli çağrı.
  const baseUpscaler: PhotoUpscaler | undefined = values["allow-upscale"]
    ? undefined
    : values["local-upscale"]
      ? localUpscale
      : async () => ({ ok: false, error: { code: "UPSCALE_DISABLED", message: "Kısa kenar < 1080 — Fal upscale için --allow-upscale verin (ücretli)." } });
  let upscaled: ReturnType<PhotoUpscaler> | null = null;
  const upscaleOnce: PhotoUpscaler = (image, scale) => (upscaled ??= (baseUpscaler ?? falPhotoUpscaler)(image, scale));

  for (const id of MATCH_DAY_FORMAT_IDS) {
    const frame = MATCH_DAY_FRAMES[id];
    const prepared = await prepareMatchPhoto({
      image: inspected.data,
      frame,
      accentHex,
      deepHex,
      upscale: upscaleOnce,
    });
    if (!prepared.ok) throw new Error(prepared.error.message);
    const { art, shadeStrength, luminance, crop, faces, quality } = prepared.data;
    report[id] = { crop, faces: faces.length, sharpness: Math.round(quality.sharpness), upscaled: quality.upscaled, warnings: quality.warnings, luminance: Math.round(luminance * 1000) / 1000, shadeStrength };
    previews.push(await cropPreview(quality.image.bytes, quality.image, frame, prepared.data));
    if (!formats.includes(id)) continue;

    const resultCard = buildMatchResultCard(facts, images, values["no-mvp"] ? null : (facts.mvp?.name ?? null), SET_PAGE_LABELS.RESULT);
    const result = await finalizeSetImage(art, await renderMatchResultOverlay(resultCard, frame, { shadeStrength }), frame, facts.fixtureId);
    const statsCard = buildMatchStatsCard(stats, "SUMMARY", images, SET_PAGE_LABELS.STATS);
    const statsPng = await finalizeSetImage(await buildStatsBackgroundFromResult(frame, result), await renderMatchStatsOverlay(statsCard, frame), frame, stats.fixtureId);
    await writeFile(path.join(out, `${prefix}01-${id}.png`), result);
    await writeFile(path.join(out, `${prefix}02-${id}.png`), statsPng);
    await writeFile(path.join(out, `${prefix}set-${id}.png`), await sideBySide(result, statsPng, frame));
  }

  const meta = await Promise.all(previews.map((p) => sharp(p).metadata()));
  const total = meta.reduce((sum, m) => sum + (m.height ?? 0) + 12, 0);
  let top = 0;
  const layers = previews.map((input, i) => {
    const layer = { input, left: 0, top };
    top += (meta[i]?.height ?? 0) + 12;
    return layer;
  });
  await writeFile(path.join(out, `${prefix}crop-preview.png`), await sharp({ create: { width: 900, height: total, channels: 3, background: "#ffffff" } }).composite(layers).png().toBuffer());
  await writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
