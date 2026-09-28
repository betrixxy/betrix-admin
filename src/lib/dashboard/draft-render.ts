import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { deleteStoredFile, parseStoredFileUrl, readStoredFile, saveStoredFile } from "@/lib/dashboard/storage";
import { STUDIO_FORMAT_DEFS } from "@/lib/dashboard/studio-formats";
import { downloadImage, embedImageBytes } from "@/lib/dashboard/studio-images";
import { buildRenderSvg } from "@/lib/dashboard/studio-render";
import { buildStatRows } from "@/lib/dashboard/studio-stats";
import type { StudioFormat } from "@/types/ai-content";
import type { DraftRenderOptions } from "@/types/draft";
import type { MatchStats } from "@/types/sports";

/** Depolamadaki bir `/api/files/...` URL'inin baytları; URL yoksa/geçersizse/dosya silinmişse null. */
export async function readStoredUrl(url: string | null | undefined): Promise<Buffer | null> {
  const stored = parseStoredFileUrl(url);
  return stored ? readStoredFile(stored.bucket, stored.fileName) : null;
}

export async function deleteStoredUrl(url: string | null | undefined): Promise<void> {
  const stored = parseStoredFileUrl(url);
  if (stored) await deleteStoredFile(stored.bucket, stored.fileName);
}

/**
 * Fal.ai `flux` çıktısını indirip kalıcı depolamaya (generated) JPEG olarak yazar — Fal URL'leri
 * geçicidir (bkz. CLAUDE.md 3.1 adım 6). Saklanan arka plan, taslak düzenlemelerinde Fal.ai'ye
 * tekrar gitmeden yeniden render etmeyi mümkün kılar.
 */
export async function persistBackground(falImageUrl: string): Promise<string> {
  const bytes = await downloadImage(falImageUrl);
  const jpeg = await sharp(bytes).jpeg({ quality: 90 }).toBuffer();
  return saveStoredFile("generated", `${randomUUID()}.jpg`, jpeg);
}

export interface DraftRenderAssets {
  backgroundImageUrl: string | null;
  playerImageUrl: string | null;
  logoImageUrl: string | null;
}

/**
 * Taslağın nihai görselini depodaki katmanlardan (arka plan, oyuncu kesimi, logo) ve
 * snapshot'taki gerçek istatistiklerden çizip `renders` kovasına yazar. Ağ çağrısı yok.
 */
export async function renderDraftImage(
  stats: MatchStats,
  format: StudioFormat,
  options: DraftRenderOptions,
  assets: DraftRenderAssets,
): Promise<string> {
  const [background, player, logo] = await Promise.all([
    readStoredUrl(assets.backgroundImageUrl),
    readStoredUrl(assets.playerImageUrl),
    readStoredUrl(assets.logoImageUrl),
  ]);

  const svg = buildRenderSvg({
    format: STUDIO_FORMAT_DEFS[format],
    fixture: { ...stats.fixture, derbyIntensity: options.derbyIntensity },
    statRows: buildStatRows(stats, options.selection),
    backgroundDataUri: background ? await embedImageBytes(background, 1600) : undefined,
    playerDataUri: player ? await embedImageBytes(player, 900, true) : undefined,
    logoDataUri: logo ? await embedImageBytes(logo, 256) : undefined,
  });

  return saveStoredFile("renders", `${randomUUID()}.svg`, Buffer.from(svg, "utf8"));
}
