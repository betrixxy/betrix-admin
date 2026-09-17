import { FAL_MODELS, isFalConfigured } from "@/lib/services/fal/client";
import type {
  GenerateStadiumBackgroundResult,
  RemovePlayerBackgroundResult,
} from "@/lib/services/fal/types";

const MOCK_DELAY_MS = 1200;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Oyuncu fotoğrafının arka planını Fal.ai `birefnet` modeliyle temizler (bkz. CLAUDE.md 3.1).
 *
 * MOCK: `FAL_KEY` tanımlanana kadar gerçek Fal.ai isteği ATILMAZ, simüle edilmiş bir
 * gecikmeyle kaynak görsel doğrudan geri döner. Gerçek entegrasyon `isFalConfigured()`
 * true döndüğünde aşağıdaki çağrıyla değiştirilecek:
 *
 *   const result = await fal.subscribe(FAL_MODELS.BACKGROUND_REMOVAL, {
 *     input: { image_url: imageUrl, refine_foreground: true },
 *   });
 */
export async function removePlayerBackground(
  imageUrl: string,
): Promise<RemovePlayerBackgroundResult> {
  await wait(MOCK_DELAY_MS);

  if (!isFalConfigured()) {
    console.warn(
      `[fal:${FAL_MODELS.BACKGROUND_REMOVAL}] FAL_KEY tanımlı değil, mock sonuç döndürülüyor.`,
    );
  }

  return {
    transparentImageUrl: imageUrl,
    width: 1024,
    height: 1024,
  };
}

/**
 * Takım renklerine ve derbi tansiyonuna uygun stadyum arka planını Fal.ai `flux`
 * ailesiyle üretir (bkz. CLAUDE.md 3.2 — prompt mühendisliği kuralları).
 *
 * MOCK: `FAL_KEY` tanımlanana kadar gerçek Fal.ai isteği ATILMAZ. Gerçek entegrasyon:
 *
 *   const result = await fal.subscribe(FAL_MODELS.STADIUM_BACKGROUND, {
 *     input: { prompt, image_size: "landscape_16_9" },
 *   });
 */
export async function generateStadiumBackground(
  team1: string,
  team2: string,
  tournamentTheme: string,
): Promise<GenerateStadiumBackgroundResult> {
  await wait(MOCK_DELAY_MS);

  const prompt = buildStadiumPrompt(team1, team2, tournamentTheme);

  if (!isFalConfigured()) {
    console.warn(
      `[fal:${FAL_MODELS.STADIUM_BACKGROUND}] FAL_KEY tanımlı değil, mock sonuç döndürülüyor.`,
    );
  }

  return {
    imageUrl: "/mock/stadium-placeholder.png",
    prompt,
  };
}

function buildStadiumPrompt(
  team1: string,
  team2: string,
  tournamentTheme: string,
): string {
  const subject =
    "empty professional football stadium interior, wide bowl, floodlights, night match atmosphere";
  const lighting = `dramatic rim lighting from floodlights inspired by ${team1} and ${team2} identity, volumetric light shafts cutting through stadium mist`;
  const colorGrade = `cinematic color grade reflecting the ${tournamentTheme} tournament palette, deep shadows, high contrast`;
  const mood = `${tournamentTheme} atmosphere, charged competitive energy`;
  const camera =
    "low-angle wide shot, shallow depth of field, negative space in lower-third and left third for typography overlay";
  const negative =
    "no human figures, no faces, no visible sponsor logos, no readable text, no watermarks, no oversaturation, no cartoonish style";

  return [subject, lighting, colorGrade, mood, camera, negative].join(", ");
}
