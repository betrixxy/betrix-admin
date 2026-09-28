"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { getSelectableFixtures } from "@/lib/dashboard/fixtures";
import { deleteStoredFile, parseStoredFileUrl, saveStoredFile } from "@/lib/dashboard/storage";
import { STUDIO_FORMAT_DEFS } from "@/lib/dashboard/studio-formats";
import {
  PLAYER_MIN_SHORT_SIDE,
  downloadImage,
  embedImageBytes,
  inspectImageUpload,
  toEmbeddedDataUri,
  type UploadedImage,
} from "@/lib/dashboard/studio-images";
import { buildRenderSvg } from "@/lib/dashboard/studio-render";
import { buildStatRows, getStudioMatchStats } from "@/lib/dashboard/studio-stats";
import { prisma } from "@/lib/prisma";
import { generateStadiumBackground, isFalConfigured, removePlayerBackground } from "@/lib/services/fal";
import type { Result } from "@/types/result";
import { STUDIO_FORMATS, type StudioActionState } from "@/types/ai-content";

const generateSchema = z.object({
  fixtureId: z.string().min(1, "Bir maç seçin."),
  format: z.enum(STUDIO_FORMATS, "Bir format seçin."),
  customPrompt: z.string().trim().max(1000, "Özel prompt en fazla 1000 karakter olabilir."),
  postId: z.string(),
});

const FAL_NOT_CONFIGURED_MESSAGE =
  "FAL_KEY tanımlı değil — .env.local dosyasına ekleyip sunucuyu yeniden başlatın.";

/** Boş bırakılan `<input type="file">` da bir `File` (0 bayt) olarak gelir — yok sayılır. */
function readFile(formData: FormData, name: string): File | null {
  const value = formData.get(name);
  return value instanceof File && value.size > 0 ? value : null;
}

async function loadImage(
  file: File | null,
  label: string,
  options: { minShortSide?: number } = {},
): Promise<Result<UploadedImage | null>> {
  if (!file) return { ok: true, data: null };
  return inspectImageUpload(file, label, options);
}

/** Fal.ai'nin geçici URL'indeki sonucu kalıcı depolamaya indirir (bkz. CLAUDE.md 3.1 adım 6). */
async function persistGeneratedImage(url: string): Promise<{ url: string; bytes: Buffer }> {
  const bytes = await downloadImage(url);
  const storedUrl = await saveStoredFile("generated", `${randomUUID()}.png`, bytes);
  return { url: storedUrl, bytes };
}

/**
 * Stüdyo üretim akışı: yüklemeleri doğrula → Fal.ai `flux`'tan stadyum arka planı ve
 * `birefnet`'ten oyuncu kesimi al (paralel) → oyuncu kesimini kalıcı depolamaya indir
 * (arka plan yalnızca nihai görsele gömülür, ayrıca saklanmaz) → maç istatistikleriyle
 * birleştirip nihai görseli render et → `AiContent` kaydı oluştur (bkz. CLAUDE.md Bölüm 3).
 */
export async function generateAiContentAction(
  _prevState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  if (!isFalConfigured()) return { error: FAL_NOT_CONFIGURED_MESSAGE };

  const parsed = generateSchema.safeParse({
    fixtureId: formData.get("fixtureId"),
    format: formData.get("format"),
    customPrompt: formData.get("customPrompt") ?? "",
    postId: formData.get("postId") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  }
  const { fixtureId, format, customPrompt, postId } = parsed.data;

  const fixture = getSelectableFixtures().find((candidate) => candidate.id === fixtureId);
  if (!fixture) return { error: "Seçilen maç bulunamadı." };

  const [player, logo] = await Promise.all([
    loadImage(readFile(formData, "playerPhoto"), "Oyuncu fotoğrafı", { minShortSide: PLAYER_MIN_SHORT_SIDE }),
    loadImage(readFile(formData, "logo"), "Logo"),
  ]);
  if (!player.ok) return { error: player.error.message };
  if (!logo.ok) return { error: logo.error.message };

  const formatDef = STUDIO_FORMAT_DEFS[format];
  const playerPhoto = player.data;

  const [backgroundResult, playerCutoutResult] = await Promise.all([
    generateStadiumBackground({
      fixture,
      customPrompt: customPrompt || undefined,
      width: formatDef.width,
      height: formatDef.height,
    }),
    playerPhoto
      ? removePlayerBackground({ bytes: playerPhoto.bytes, contentType: playerPhoto.contentType })
      : Promise.resolve(null),
  ]);

  if (!backgroundResult.ok) return { error: backgroundResult.error.message };
  if (playerCutoutResult && !playerCutoutResult.ok) return { error: playerCutoutResult.error.message };

  try {
    const backgroundBytes = await downloadImage(backgroundResult.data.imageUrl);
    const playerCutout = playerCutoutResult
      ? await persistGeneratedImage(playerCutoutResult.data.transparentImageUrl)
      : null;
    const logoUrl = logo.data
      ? await saveStoredFile("uploads", `${logo.data.hash}.${logo.data.extension}`, logo.data.bytes)
      : null;

    const stats = getStudioMatchStats(fixture);
    const svg = buildRenderSvg({
      format: formatDef,
      fixture,
      statRows: buildStatRows(stats, {
        includeForm: formData.get("includeForm") === "on",
        includeXg: formData.get("includeXg") === "on",
      }),
      backgroundDataUri: await embedImageBytes(backgroundBytes, 1600),
      playerDataUri: playerCutout ? await embedImageBytes(playerCutout.bytes, 900, true) : undefined,
      logoDataUri: logo.data ? await toEmbeddedDataUri(logo.data, 256) : undefined,
    });

    const resultImageUrl = await saveStoredFile("renders", `${randomUUID()}.svg`, Buffer.from(svg, "utf8"));

    const record = await prisma.aiContent.create({
      data: {
        fixtureId,
        postId: postId || null,
        prompt: backgroundResult.data.prompt,
        playerImageUrl: playerCutout?.url ?? null,
        logoImageUrl: logoUrl,
        resultImageUrl,
      },
    });

    refreshDashboard();
    return { result: { id: record.id, resultImageUrl, prompt: backgroundResult.data.prompt, format } };
  } catch {
    return { error: "Görsel üretilemedi — depolama alanına yazılamadı veya veritabanına ulaşılamadı." };
  }
}

/**
 * Kaydı ve ürettiği dosyaları siler. `logoImageUrl` içerik-adresli olduğundan (bkz.
 * `uploads` kovası) başka kayıtlarca paylaşılabilir — silinmez, yalnızca bu kayda özel
 * `resultImageUrl` (render) ve `playerImageUrl` (Fal.ai kesimi) temizlenir.
 */
export async function deleteAiContentAction(id: string): Promise<Result<null>> {
  if (!(await getCurrentSession())) {
    return { ok: false, error: { code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE } };
  }

  try {
    const record = await prisma.aiContent.delete({ where: { id } });
    for (const url of [record.resultImageUrl, record.playerImageUrl]) {
      const stored = parseStoredFileUrl(url);
      if (stored) await deleteStoredFile(stored.bucket, stored.fileName);
    }
  } catch (cause) {
    return { ok: false, error: { code: "DELETE_FAILED", message: "Kayıt silinemedi.", cause } };
  }

  refreshDashboard();
  return { ok: true, data: null };
}
