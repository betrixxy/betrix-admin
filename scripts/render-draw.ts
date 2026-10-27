/**
 * Kura sonucu kartı offline render — DB'ye yazmaz, deploy'suz tasarım aracı. Kura durumu API fikstüründen
 * (yalnızca okuma; kura sonrası gerçek örnek) kurulur. Fotoğraf `--photo` (repo dışında; telifli fotoğraflar
 * git'e girmez), verilmezse programatik zemin. Çıktılar `--out` klasörüne (repoya YAZMAYIN).
 *
 *   A (takım):   npx tsx --env-file=.env --env-file=.env.local scripts/render-draw.ts --out C:\...\draw --variant TEAM --competitions 2 --team 611 [--photo a.jpg]
 *   B (Türk):    ... --variant TURKISH --competitions 2,3,848
 *   [--season 2026] [--formats IG_PORTRAIT|all]
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import sharp from "sharp";
import { buildDrawCard } from "@/lib/dashboard/draw-card";
import { drawFromApi, drawHeadToHead } from "@/lib/dashboard/draw-data";
import { renderDrawImages } from "@/lib/dashboard/draw-render";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { inspectImageBytes } from "@/lib/dashboard/studio-images";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";
import type { DrawState, DrawVariant } from "@/types/draw";

const { values } = parseArgs({
  options: {
    out: { type: "string" },
    variant: { type: "string", default: "TEAM" },
    competitions: { type: "string", default: "2" },
    team: { type: "string" },
    season: { type: "string", default: "2026" },
    photo: { type: "string" },
    formats: { type: "string", default: "IG_PORTRAIT" },
  },
});

async function sideBySide(pages: Buffer[]): Promise<Buffer> {
  if (pages.length === 1) return pages[0]!;
  const { width = 0, height = 0 } = await sharp(pages[0]).metadata();
  const gap = 24;
  return sharp({ create: { width: width * pages.length + gap * (pages.length - 1), height, channels: 3, background: "#1a1b20" } })
    .composite(pages.map((input, index) => ({ input, left: index * (width + gap), top: 0 })))
    .png()
    .toBuffer();
}

async function main() {
  if (!values.out) throw new Error("--out klasörü gerekli (repo dışında).");
  const outDir = path.resolve(values.out);
  await mkdir(outDir, { recursive: true });
  const variant = values.variant as DrawVariant;
  const season = Number(values.season);
  const states: DrawState[] = [];
  for (const id of values.competitions.split(",").map(Number)) {
    const state = await drawFromApi({ competitionId: id, season, stage: "LEAGUE_PHASE", roundLabel: "Lig Aşaması" });
    if (!state.ok) throw new Error(`Turnuva ${id}: ${state.error.message}`);
    states.push(state.data);
  }
  const focusTeamId = values.team ? Number(values.team) : null;
  const wanted = new Set<number>();
  for (const state of states) {
    for (const f of state.fixtures) if (variant !== "TEAM" ? state.teams.find((t) => t.id === f.teamId)?.country === "Turkey" : f.teamId === focusTeamId) [f.teamId, f.opponentId].forEach((id) => wanted.add(id));
  }
  const logos: Record<number, string | null> = {};
  for (const id of wanted) {
    const team = states.flatMap((s) => s.teams).find((t) => t.id === id);
    logos[id] = await resolveImage(team?.logoUrl ?? undefined, 200);
  }
  const photo = values.photo ? await inspectImageBytes(await readFile(values.photo), path.basename(values.photo)) : null;
  if (photo && !photo.ok) throw new Error(photo.error.message);
  const brandLogo = await loadBrandLogo();
  const headToHead = focusTeamId && states[0]?.stage === "KNOCKOUT" ? await drawHeadToHead(focusTeamId, 0, new Date().toISOString()) : null;

  const formats = values.formats === "all" ? [...MATCH_DAY_FORMAT_IDS] : (values.formats.split(",") as MatchDayFormatId[]);
  const report: Record<string, unknown> = { variant, competitions: states.map((s) => `${s.competition.name} ${s.roundLabel}`), photo: values.photo ? "verilen dosya (repo dışında)" : "programatik", files: [] as string[] };
  for (const format of formats) {
    const card = buildDrawCard({ variant, states, focusTeamId, logos, headToHead, brandLogo });
    if (!card.ok) throw new Error(card.error.message);
    const pages = await renderDrawImages({ card: card.data, frame: MATCH_DAY_FRAMES[format], photo: photo?.ok ? photo.data : null, seedKey: `draw-${variant}-${values.competitions}-${values.team ?? ""}` });
    if (!pages.ok) {
      console.log(`${format}: KART ÜRETİLMEDİ — ${pages.error.message}`);
      continue;
    }
    const file = path.join(outDir, `draw-${variant.toLowerCase()}-${format}${pages.data.length > 1 ? "-pair" : ""}.png`);
    await writeFile(file, await sideBySide(pages.data));
    (report.files as string[]).push(file);
    report.body = card.data.body.kind;
    report.footer = card.data.footerLine;
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
