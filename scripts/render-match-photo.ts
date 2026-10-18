/**
 * Maç Sonucu tam kadraj offline render — DB'siz, deploy'suz tasarım/kalibrasyon aracı. Gerçek maç
 * fotoğrafı yol ile okunur (repo dışında tutulur — telifli fotoğraflar git'e girmez); çıktılar
 * `--out` klasörüne yazılır (scratchpad önerilir, repoya YAZMAYIN).
 *
 *   npx tsx scripts/render-match-photo.ts --photo C:\...\test-photos\foto.jpg --raw fixture.json --out C:\...\scratchpad\mr --formats all
 *   npx tsx --env-file=.env --env-file=.env.local scripts/render-match-photo.ts ... --allow-upscale
 *
 * Her format için: A/B/C 01 kartları + A'nın 02'si (01'in bulanık/koyu hâli) + yerleşim çakışma
 * kontrolü (01 ve 02, her şablon). Çıktı: set-<format>.png (A 01+02 yan yana), templates-<format>.png
 * (A/B/C yan yana), 01-<şablon>-<format>.png, 02-<format>.png, crop-preview.png, report.json.
 * "MAÇIN OYUNCUSU" satırı yalnızca `--photo-player <id>` MVP ile eşleşirse ya da `--photo-is-mvp`.
 * Kısa kenar < 1080: `--allow-upscale` (Fal, ücretli, önbellekli) ya da `--local-upscale` (ücretsiz
 * önizleme — çıktı adları "preview-" ile başlar).
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { resolveSetImages } from "@/lib/dashboard/checkmatch-set";
import { describeLayoutIssues, checkLayout } from "@/lib/dashboard/layout-check";
import { MATCH_DAY_FRAMES, type MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { prepareMatchPhoto, type PreparedMatchPhoto } from "@/lib/dashboard/match-photo";
import { falPhotoUpscaler, hasCachedUpscale, measureSharpness, photoUpscaleFactor, type PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { buildMatchResultCard } from "@/lib/dashboard/match-result-card";
import { mvpLineName } from "@/lib/dashboard/match-result-featured";
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
import { MATCH_RESULT_TEMPLATE_IDS, type MatchResultTemplateId } from "@/types/match-result";

const { values } = parseArgs({
  options: {
    photo: { type: "string" },
    raw: { type: "string" },
    fixture: { type: "string" },
    out: { type: "string" },
    formats: { type: "string", default: "IG_PORTRAIT" },
    "allow-upscale": { type: "boolean", default: false },
    "local-upscale": { type: "boolean", default: false },
    "photo-player": { type: "string" },
    "photo-is-mvp": { type: "boolean", default: false },
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

/** Ücretsiz yerel büyütme (lanczos) — Fal ESRGAN'ın yerine değil, yalnızca kadraj/okunurluk ön değerlendirmesi. */
const localUpscale: PhotoUpscaler = async (image, scale) => {
  const bytes = await sharp(image.bytes).resize(image.width * scale, image.height * scale, { kernel: "lanczos3" }).jpeg({ quality: 95 }).toBuffer();
  return inspectImageBytes(bytes, "Yerel büyütülmüş önizleme");
};

/** Kaynak fotoğraf küçültülmüş + kırpma kutusu, yazısız bölge ve yüzler (SVG). */
async function cropPreview(photo: Buffer, size: { width: number; height: number }, frame: MatchDayFrame, prepared: PreparedMatchPhoto): Promise<Buffer> {
  const width = 900;
  const s = width / size.width;
  const { box } = prepared.crop;
  const k = box.width / frame.width;
  const safe = matchResultGeometry(frame, prepared.side).photoSafe;
  const rect = (x: number, y: number, w: number, h: number, stroke: string, dash = "") =>
    `<rect x="${x * s}" y="${y * s}" width="${w * s}" height="${h * s}" fill="none" stroke="${stroke}" stroke-width="3" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(size.height * s)}">
    ${rect(box.left, box.top, box.width, box.height, "#00e5ff")}
    ${rect(box.left + safe.left * k, box.top + safe.top * k, (safe.right - safe.left) * k, (safe.bottom - safe.top) * k, "#ffd400", "10 8")}
    ${prepared.faces.map((f) => rect(f.x, f.y, f.width, f.height, "#ff2d55")).join("")}
    <rect x="0" y="0" width="${width}" height="34" fill="rgba(0,0,0,0.7)"/>
    <text x="12" y="23" font-family="sans-serif" font-size="18" fill="#fff">${frame.id} · ${prepared.crop.anchor} · zoom ${prepared.crop.zoom} · sütun ${prepared.side} · güvenli: ${prepared.crop.facesInSafe ? "evet" : "HAYIR"} · gradyan ${prepared.shadeStrength}</text>
  </svg>`;
  return sharp(photo).resize(width).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}

async function row(images: Buffer[], frame: MatchDayFrame, gap = 24): Promise<Buffer> {
  return sharp({ create: { width: frame.width * images.length + gap * (images.length - 1), height: frame.height, channels: 3, background: "#ffffff" } })
    .composite(images.map((input, i) => ({ input, left: i * (frame.width + gap), top: 0 })))
    .png()
    .toBuffer();
}

async function stack(images: Buffer[], width: number): Promise<Buffer> {
  const meta = await Promise.all(images.map((p) => sharp(p).metadata()));
  let top = 0;
  const layers = images.map((input, i) => {
    const layer = { input, left: 0, top };
    top += (meta[i]?.height ?? 0) + 12;
    return layer;
  });
  return sharp({ create: { width, height: Math.max(1, top), channels: 3, background: "#ffffff" } }).composite(layers).png().toBuffer();
}

async function main() {
  if (!values.photo || !values.out) throw new Error("--photo <yol> ve --out <klasör> zorunlu");
  const out = path.resolve(values.out);
  await mkdir(out, { recursive: true });

  const raw = await loadRaw();
  const facts = toMatchResultFacts(raw);
  const stats = toMatchStatsFacts(raw, null);
  if (!facts || !stats) throw new Error("Maç bitmemiş — kart yalnızca FT/AET/PEN için.");

  const inspected = await inspectImageBytes(await readFile(values.photo), "Maç fotoğrafı");
  if (!inspected.ok) throw new Error(inspected.error.message);

  const accentHex = resultAccentHex(facts);
  const deepHex = COMPETITION_COLORS[facts.competition.kind]?.deep;
  const images = await resolveSetImages(facts, async () => null);
  const photoPlayerId = values["photo-player"] ? Number(values["photo-player"]) : null;
  const mvpName = mvpLineName({ mvp: facts.mvp, photoPlayerId, photoIsMvp: values["photo-is-mvp"] });
  const formats = values.formats === "all" ? [...MATCH_DAY_FORMAT_IDS] : (values.formats.split(",") as MatchDayFormatId[]);
  const prefix = values["local-upscale"] && !values["allow-upscale"] ? "preview-" : "";

  // Büyütme fotoğraf başına BİR kez (tüm format/şablonlar paylaşır); Fal sonucu ayrıca diskte önbellekli.
  const base: PhotoUpscaler = values["allow-upscale"]
    ? falPhotoUpscaler
    : values["local-upscale"]
      ? localUpscale
      : async () => ({ ok: false, error: { code: "UPSCALE_DISABLED", message: "Kısa kenar < 1080 — --allow-upscale (Fal, ücretli) ya da --local-upscale (önizleme) verin." } });
  let upscaled: ReturnType<PhotoUpscaler> | null = null;
  const upscaleOnce: PhotoUpscaler = (image, scale) => (upscaled ??= base(image, scale));

  const report: Record<string, unknown> = {
    photo: path.basename(values.photo),
    size: [inspected.data.width, inspected.data.height],
    upscaleFactor: photoUpscaleFactor(inspected.data),
    falUpscaleCached: await hasCachedUpscale(inspected.data),
    sourceSharpness: Math.round(await measureSharpness(inspected.data.bytes)),
    upscaleMode: values["allow-upscale"] ? "fal" : values["local-upscale"] ? "local-preview" : "none",
    accentHex,
    mvpLine: mvpName,
  };
  const previews: Buffer[] = [];
  let layoutFailures = 0;

  for (const id of formats) {
    const frame = MATCH_DAY_FRAMES[id];
    const cards: Partial<Record<MatchResultTemplateId, Buffer>> = {};
    const entry: Record<string, unknown> = {};
    let side: "left" | "right" = "right";
    for (const template of MATCH_RESULT_TEMPLATE_IDS) {
      const prepared = await prepareMatchPhoto({ image: inspected.data, frame, accentHex, deepHex, template, upscale: upscaleOnce });
      if (!prepared.ok) throw new Error(prepared.error.message);
      const { art, shadeStrength, crop, faces, quality } = prepared.data;
      if (template === "FULL_FRAME") {
        side = prepared.data.side;
        previews.push(await cropPreview(quality.image.bytes, quality.image, frame, prepared.data));
      }
      const card = buildMatchResultCard(facts, images, mvpName, SET_PAGE_LABELS.RESULT);
      const options = { template, shadeStrength, side: prepared.data.side };
      const layout = await checkLayout(frame, (only) => renderMatchResultOverlay(card, frame, { ...options, only }));
      layoutFailures += layout.issues.length > 0 ? 1 : 0;
      cards[template] = await finalizeSetImage(art, await renderMatchResultOverlay(card, frame, options), frame, facts.fixtureId);
      await writeFile(path.join(out, `${prefix}01-${template}-${id}.png`), cards[template] ?? Buffer.alloc(0));
      entry[template] = {
        faces: faces.length,
        safe: crop.facesInSafe,
        zoom: crop.zoom,
        side: prepared.data.side,
        sharpness: Math.round(quality.sharpness),
        shadeStrength,
        warnings: quality.warnings,
        layout: layout.issues.length ? describeLayoutIssues(layout.issues) : "OK",
      };
    }

    const resultA = cards.FULL_FRAME;
    if (!resultA) continue;
    const statsCard = buildMatchStatsCard(stats, "SUMMARY", images, SET_PAGE_LABELS.STATS);
    const statsLayout = await checkLayout(frame, (only) => renderMatchStatsOverlay(statsCard, frame, { side, only }));
    layoutFailures += statsLayout.issues.length > 0 ? 1 : 0;
    entry.STATS = statsLayout.issues.length ? describeLayoutIssues(statsLayout.issues) : "OK";
    const statsPng = await finalizeSetImage(await buildStatsBackgroundFromResult(frame, resultA), await renderMatchStatsOverlay(statsCard, frame, { side }), frame, stats.fixtureId);
    await writeFile(path.join(out, `${prefix}02-${id}.png`), statsPng);
    await writeFile(path.join(out, `${prefix}set-${id}.png`), await row([resultA, statsPng], frame));
    await writeFile(path.join(out, `${prefix}templates-${id}.png`), await row(MATCH_RESULT_TEMPLATE_IDS.map((t) => cards[t] ?? resultA), frame));
    report[id] = entry;
  }

  await writeFile(path.join(out, `${prefix}crop-preview.png`), await stack(previews, 900));
  report.layoutFailures = layoutFailures;
  await writeFile(path.join(out, `${prefix}report.json`), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
