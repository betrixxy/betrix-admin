import sharp from "sharp";
import { backgroundCacheKey, getPlayerCutout, readCachedBackground, saveCachedBackground, type CachedAsset } from "@/lib/dashboard/match-day-cache";
import { buildProgrammaticBackground } from "@/lib/dashboard/match-day-compose";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { MATCH_DAY_TEMPLATES } from "@/lib/dashboard/match-day-templates";
import { downloadImage, type UploadedImage } from "@/lib/dashboard/studio-images";
import { buildMatchDayBackgroundPrompt, generateMatchDayBackground } from "@/lib/services/fal";
import type { MatchDayPromptInput } from "@/lib/services/fal/match-day-prompts";
import type { MatchDayTemplateId } from "@/types/match-day";
import type { Result } from "@/types/result";

/**
 * Maç Günü'nün dayanıklı girdileri (canlı test 2026-10-31: tek takımın fotoğrafı yoktu → üç şablon da üretilemedi):
 *   - Taraf: fotoğraf yoksa ya da kesim yapılamazsa (Fal yok / hata) o takımın YEDEK TASARIMI (kesim yerine
 *     `match-day-compose.ts` arma + filigran + takım ışığı çizer) — fotoğrafı olmayan taraf için Fal'a HİÇ gidilmez.
 *   - Arka plan: flux yapılamazsa (Fal yok / hata) programatik zemin; Data Driven zaten programatik.
 * Kart düşmez; her geri dönüş stüdyoya not olarak yazılır. Kesim/arka plan üreticisi testte enjekte edilir.
 */

export interface SideCutout {
  /** Kesim; null → yedek tasarım. */
  bytes: Buffer | null;
  paidCalls: number;
  fromCache: boolean;
  /** Yedek tasarıma düşüldüyse sebebi (stüdyo notu). */
  note: string | null;
}

export type CutoutMaker = (image: UploadedImage, label: string) => Promise<Result<CachedAsset>>;

export async function resolveSideCutout(image: UploadedImage | null, label: string, makeCutout: CutoutMaker = getPlayerCutout): Promise<SideCutout> {
  if (!image) return { bytes: null, paidCalls: 0, fromCache: false, note: `${label} yok — takımın yedek tasarımı (arma + filigran + takım ışığı) çizildi.` };
  const cut = await makeCutout(image, label);
  if (cut.ok) return { bytes: cut.data.bytes, paidCalls: cut.data.paidCalls, fromCache: cut.data.fromCache, note: null };
  const reason = cut.error.message.startsWith(`${label}: `) ? cut.error.message.slice(label.length + 2) : cut.error.message;
  return { bytes: null, paidCalls: 0, fromCache: false, note: `${label}: oyuncu kesimi yapılamadı (${reason}) — takımın yedek tasarımı çizildi.` };
}

export interface BackgroundResult {
  bytes: Buffer;
  prompt: string;
  paidCalls: number;
  /** Ücretsiz yol / önbellek bilgisi ("Arka plan önbellekten"). */
  saved: string | null;
  /** AI arka plan yapılamadıysa sebebi (stüdyo notu); kart programatik zeminle sürer. */
  note: string | null;
}

/**
 * Maliyet: arka plan sahnesi koyulaştırılıp oyuncuların arkasında kaldığı için tam çözünürlük
 * gerekmez — uzun kenarı 1024px üretilip sharp ile büyütülür (Fal.ai flux megapiksel başına
 * ücretlendirir; 9:16'da ~%70, 4:5'te ~%40 daha az piksel).
 */
export function economyBackgroundSize(frame: MatchDayFrame): { width: number; height: number } {
  const scale = Math.min(1, 1024 / Math.max(frame.width, frame.height));
  return { width: Math.round(frame.width * scale), height: Math.round(frame.height * scale) };
}

export interface BackgroundRequest {
  template: MatchDayTemplateId;
  homeColorHex: string;
  reuseBackground: boolean;
}

export async function resolveBackground(request: BackgroundRequest, frame: MatchDayFrame, promptInput: MatchDayPromptInput): Promise<BackgroundResult> {
  const programmatic = async (saved: string | null, note: string | null): Promise<BackgroundResult> => ({ bytes: await buildProgrammaticBackground(frame, request.homeColorHex), prompt: "programatik zemin", paidCalls: 0, saved, note });
  if (!MATCH_DAY_TEMPLATES[request.template].aiBackground) return programmatic("Arka plan programatik (şablon AI arka plan kullanmıyor)", null);

  const size = economyBackgroundSize(frame);
  const prompt = buildMatchDayBackgroundPrompt(promptInput);
  const key = backgroundCacheKey(prompt, size.width, size.height);
  if (request.reuseBackground) {
    const cached = await readCachedBackground(key);
    if (cached) return { bytes: cached, prompt, paidCalls: 0, saved: "Arka plan önbellekten", note: null };
  }

  const generated = await generateMatchDayBackground({ ...promptInput, ...size });
  if (!generated.ok) return programmatic(null, `AI arka plan üretilemedi (${generated.error.message}) — programatik zemin kullanıldı.`);
  try {
    const jpeg = await sharp(await downloadImage(generated.data.imageUrl)).jpeg({ quality: 90 }).toBuffer();
    await saveCachedBackground(key, jpeg);
    return { bytes: jpeg, prompt, paidCalls: 1, saved: null, note: null };
  } catch {
    return programmatic(null, "AI arka plan Fal.ai'den indirilemedi — programatik zemin kullanıldı.");
  }
}
