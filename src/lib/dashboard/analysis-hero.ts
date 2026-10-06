import { createHash } from "node:crypto";
import sharp from "sharp";
import { HERO_SIZE, buildProgrammaticHeroBackground, composeAnalysisHero } from "@/lib/dashboard/analysis-hero-compose";
import { backgroundCacheKey, getPlayerCutout, readCachedBackground, saveCachedBackground } from "@/lib/dashboard/match-day-cache";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { downloadImage, type UploadedImage } from "@/lib/dashboard/studio-images";
import { buildAnalysisHeroPrompt, generateFluxScene } from "@/lib/services/fal";
import type { HeroQuality } from "@/types/deep-analysis";
import type { Result } from "@/types/result";

export interface AnalysisHeroResult {
  /** Kalıcı kapak görseli — `/api/files/generated/analysis-hero-<sha256>.png`. */
  heroImageUrl: string;
  /** Bu üretimde yapılan ücretli Fal.ai çağrısı (önbellekten gelen adımlar 0). */
  paidCalls: number;
  savedSteps: string[];
}

interface SceneResult {
  bytes: Buffer;
  paidCalls: number;
  saved: string | null;
}

async function heroBackground(colorHex: string, quality: HeroQuality): Promise<Result<SceneResult>> {
  if (quality === "ECONOMY") {
    return { ok: true, data: { bytes: await buildProgrammaticHeroBackground(colorHex), paidCalls: 0, saved: "Programatik sahne (Ekonomik mod)" } };
  }
  const prompt = buildAnalysisHeroPrompt(colorHex);
  const key = backgroundCacheKey(prompt, HERO_SIZE.width, HERO_SIZE.height);
  const cached = await readCachedBackground(key);
  if (cached) return { ok: true, data: { bytes: cached, paidCalls: 0, saved: "Sahne önbellekten (aynı takım rengi)" } };

  const scene = await generateFluxScene(prompt, HERO_SIZE.width, HERO_SIZE.height, "Kapak sahnesi üretilemedi.");
  if (!scene.ok) return { ok: false, error: { code: scene.error.code, message: scene.error.message } };
  try {
    const jpeg = await sharp(await downloadImage(scene.data.imageUrl)).jpeg({ quality: 90 }).toBuffer();
    await saveCachedBackground(key, jpeg);
    return { ok: true, data: { bytes: jpeg, paidCalls: 1, saved: null } };
  } catch {
    return { ok: false, error: { code: "DOWNLOAD_FAILED", message: "Kapak sahnesi indirilemedi — birazdan tekrar deneyin." } };
  }
}

/**
 * Derinlemesine Analiz kapağı: kilit oyuncunun kesimi (AI Upscale + birefnet, fotoğraf başına
 * önbellekli) + sahne (Premium: Fal.ai flux, renk başına önbellekli · Ekonomik: programatik,
 * ücretsiz) → sharp kompozit. Sonuç içerik-adresli kaydedilir; kart önizleme/kaydetme adımları
 * bu dosyayı kullanır ve Fal.ai'ye tekrar gitmez.
 */
export async function createAnalysisHero(input: {
  player: UploadedImage;
  colorHex: string;
  quality: HeroQuality;
  label: string;
}): Promise<Result<AnalysisHeroResult>> {
  const [cutout, background] = await Promise.all([getPlayerCutout(input.player, input.label), heroBackground(input.colorHex, input.quality)]);
  if (!cutout.ok) return cutout;
  if (!background.ok) return background;

  const savedSteps: string[] = [];
  if (cutout.data.fromCache) savedSteps.push("Oyuncu kesimi önbellekten");
  if (background.data.saved) savedSteps.push(background.data.saved);

  try {
    const hero = await composeAnalysisHero(background.data.bytes, cutout.data.bytes);
    const hash = createHash("sha256").update(hero).digest("hex");
    const heroImageUrl = await saveStoredFile("generated", `analysis-hero-${hash}.png`, hero);
    return { ok: true, data: { heroImageUrl, paidCalls: cutout.data.paidCalls + background.data.paidCalls, savedSteps } };
  } catch (cause) {
    console.error("[analysis-hero] kapak birleştirilemedi:", cause);
    return { ok: false, error: { code: "COMPOSE_FAILED", message: "Kapak görseli birleştirilemedi." } };
  }
}
