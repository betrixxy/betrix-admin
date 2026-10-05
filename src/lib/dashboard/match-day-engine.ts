import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { resolveMatchDayCard } from "@/lib/dashboard/match-day-assets";
import { backgroundCacheKey, getPlayerCutout, readCachedBackground, saveCachedBackground } from "@/lib/dashboard/match-day-cache";
import { buildProgrammaticBackground, composeMatchDayArt, finalizeMatchDayImage, restorePlayers } from "@/lib/dashboard/match-day-compose";
import { MATCH_DAY_FRAMES, type MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { renderMatchDayOverlay } from "@/lib/dashboard/match-day-overlay";
import { loadMatchDayStats } from "@/lib/dashboard/match-day-stats";
import { MATCH_DAY_TEMPLATES } from "@/lib/dashboard/match-day-templates";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { downloadImage, type UploadedImage } from "@/lib/dashboard/studio-images";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { buildMatchDayBackgroundPrompt, generateMatchDayBackground, harmonizeMatchDayComposite } from "@/lib/services/fal";
import type { MatchDayPromptInput } from "@/lib/services/fal/match-day-prompts";
import type {
  MatchDayCard,
  MatchDayFormatId,
  MatchDayGenerationResult,
  MatchDayParams,
  MatchDayQualityMode,
  MatchDayTemplateId,
} from "@/types/match-day";
import type { ContentTypeId } from "@/types/content-type";
import type { Result } from "@/types/result";
import type { DerbyIntensity } from "@/types/sports";

/**
 * Maç Günü kartı üretim hattı (yarı otomatik — admin tıklamasıyla tetiklenir, DRAFT doğar; bkz. CLAUDE.md 1.10):
 *
 *   1. Oyuncu kesimleri (önbellek → yoksa AI Upscale + birefnet) ‖ arka plan (programatik |
 *      önbellek | flux, düşük çözünürlükte) ‖ kart verisi ‖ (veri şablonunda) gerçek istatistikler
 *   2. sharp: arka plan + ışık/gölge + oyuncular + okunabilirlik gölgesi → kaba kompozit (seçili formatta)
 *   3. PREMIUM kalite + şablon destekliyorsa: Fal.ai image-to-image harmanlama
 *   4. (isteğe bağlı) orijinal oyuncu kesimlerini yeniden bas — yüz/forma birebir korunur
 *   5. Satori: şablonun tipografi/logo/marka katmanı → PNG
 */

type EngineError = { code: string; message: string };
const fail = (code: string, message: string): { ok: false; error: EngineError } => ({ ok: false, error: { code, message } });

export interface CreateMatchDayInput {
  /** API-Football'dan seçilen maç; elle doldurulan kartlarda `null`. */
  fixtureId: string | null;
  info: MatchDayParams;
  template: MatchDayTemplateId;
  format: MatchDayFormatId;
  quality: MatchDayQualityMode;
  /** true → aynı ayarlarla daha önce üretilmiş arka plan varsa tekrar kullanılır (ücretsiz). */
  reuseBackground: boolean;
  homePlayer: UploadedImage;
  awayPlayer: UploadedImage;
  homeColorHex: string;
  awayColorHex: string;
  derbyIntensity: DerbyIntensity;
  customPrompt?: string | undefined;
  /** Harmanlama gücü (0.15-0.6). */
  strength: number;
  preservePlayers: boolean;
}

/** Elle doldurulan kartlar için `AiContent.fixtureId` yer tutucusu — gerçek maç kimliği değildir. */
export const MANUAL_MATCH_DAY_FIXTURE_ID = "manual:match-day";

/** `AiContent.format` sütunu stüdyo formatlarını tutar; karşılığı olmayan (1:1) olduğu gibi yazılır. */
const DB_FORMAT: Record<MatchDayFormatId, string> = {
  IG_PORTRAIT: "IG_FEED",
  IG_SQUARE: "IG_SQUARE",
  STORY: "STORY",
  X_LANDSCAPE: "X_CARD",
};

/**
 * Maliyet: arka plan sahnesi koyulaştırılıp oyuncuların arkasında kaldığı için tam çözünürlük
 * gerekmez — uzun kenarı 1024px üretilip sharp ile büyütülür (Fal.ai flux megapiksel başına
 * ücretlendirir; 9:16'da ~%70, 4:5'te ~%40 daha az piksel).
 */
function economyBackgroundSize(frame: MatchDayFrame): { width: number; height: number } {
  const scale = Math.min(1, 1024 / Math.max(frame.width, frame.height));
  return { width: Math.round(frame.width * scale), height: Math.round(frame.height * scale) };
}

function buildCaption(card: MatchDayCard): string {
  const header = [card.weekLabel, card.leagueLabel].filter(Boolean).join(" · ");
  return [
    `MAÇ GÜNÜ | ${card.homeTeam} - ${card.awayTeam}`,
    header,
    `📅 ${card.dateLabel}  ⏰ ${card.timeLabel}`,
    `🏟️ ${card.stadiumLabel}  🧑‍⚖️ ${card.refereeLabel}`,
  ].join("\n");
}

interface BackgroundResult {
  bytes: Buffer;
  prompt: string;
  paidCalls: number;
  saved: string | null;
}

async function getBackground(input: CreateMatchDayInput, frame: MatchDayFrame, promptInput: MatchDayPromptInput): Promise<Result<BackgroundResult, EngineError>> {
  if (!MATCH_DAY_TEMPLATES[input.template].aiBackground) {
    const bytes = await buildProgrammaticBackground(frame, input.homeColorHex);
    return { ok: true, data: { bytes, prompt: "programatik zemin", paidCalls: 0, saved: "Arka plan programatik (şablon AI arka plan kullanmıyor)" } };
  }

  const size = economyBackgroundSize(frame);
  const prompt = buildMatchDayBackgroundPrompt(promptInput);
  const key = backgroundCacheKey(prompt, size.width, size.height);
  if (input.reuseBackground) {
    const cached = await readCachedBackground(key);
    if (cached) return { ok: true, data: { bytes: cached, prompt, paidCalls: 0, saved: "Arka plan önbellekten" } };
  }

  const generated = await generateMatchDayBackground({ ...promptInput, ...size });
  if (!generated.ok) return fail(generated.error.code, `Arka plan: ${generated.error.message}`);
  try {
    const jpeg = await sharp(await downloadImage(generated.data.imageUrl)).jpeg({ quality: 90 }).toBuffer();
    await saveCachedBackground(key, jpeg);
    return { ok: true, data: { bytes: jpeg, prompt, paidCalls: 1, saved: null } };
  } catch {
    return fail("DOWNLOAD_FAILED", "Arka plan Fal.ai'den indirilemedi — birazdan tekrar deneyin.");
  }
}

async function saveJpeg(bytes: Buffer): Promise<string> {
  const jpeg = await sharp(bytes).jpeg({ quality: 90 }).toBuffer();
  return saveStoredFile("generated", `${randomUUID()}.jpg`, jpeg);
}

export async function createMatchDayCard(input: CreateMatchDayInput): Promise<Result<MatchDayGenerationResult, EngineError>> {
  const frame = MATCH_DAY_FRAMES[input.format];
  const meta = MATCH_DAY_TEMPLATES[input.template];
  const promptInput: MatchDayPromptInput = {
    template: input.template,
    homeColorHex: input.homeColorHex,
    awayColorHex: input.awayColorHex,
    derbyIntensity: input.derbyIntensity,
    customPrompt: input.customPrompt,
  };

  // 1. Bağımsız adımlar paralel.
  const [homeCut, awayCut, background, baseCard, stats] = await Promise.all([
    getPlayerCutout(input.homePlayer, "Ev sahibi oyuncu fotoğrafı"),
    getPlayerCutout(input.awayPlayer, "Deplasman oyuncu fotoğrafı"),
    getBackground(input, frame, promptInput),
    resolveMatchDayCard(input.info, { homeColorHex: input.homeColorHex, awayColorHex: input.awayColorHex }),
    input.template === "DATA_DRIVEN" ? loadMatchDayStats(input.fixtureId) : Promise.resolve(null),
  ]);
  if (!homeCut.ok) return fail(homeCut.error.code, homeCut.error.message);
  if (!awayCut.ok) return fail(awayCut.error.code, awayCut.error.message);
  if (!background.ok) return background;
  const card: MatchDayCard = { ...baseCard, stats };

  const savedSteps: string[] = [];
  if (homeCut.data.fromCache) savedSteps.push("Ev sahibi oyuncu kesimi önbellekten");
  if (awayCut.data.fromCache) savedSteps.push("Deplasman oyuncu kesimi önbellekten");
  if (background.data.saved) savedSteps.push(background.data.saved);
  let paidCalls = homeCut.data.paidCalls + awayCut.data.paidCalls + background.data.paidCalls;

  const home = { bytes: homeCut.data.bytes, colorHex: input.homeColorHex };
  const away = { bytes: awayCut.data.bytes, colorHex: input.awayColorHex };
  const target = { template: input.template, frame };

  // 2. Kaba kompozit.
  let composite: Buffer;
  try {
    composite = await composeMatchDayArt(background.data.bytes, target, home, away);
  } catch {
    return fail("COMPOSE_FAILED", "Oyuncu kesimleri arka planla birleştirilemedi.");
  }

  // 3. AI harmanlama — yalnızca PREMIUM kalitede ve şablon destekliyorsa.
  let art = composite;
  let prompt = background.data.prompt;
  if (meta.harmonize && input.quality === "PREMIUM") {
    const harmonized = await harmonizeMatchDayComposite({ ...promptInput, composite, contentType: "image/png", strength: input.strength });
    if (!harmonized.ok) return fail(harmonized.error.code, `Harmanlama: ${harmonized.error.message}`);
    paidCalls += 1;
    prompt = harmonized.data.prompt;
    try {
      const harmonizedBytes = await downloadImage(harmonized.data.imageUrl);
      // 4. Oyuncuları koru (isteğe bağlı).
      art = input.preservePlayers ? await restorePlayers(harmonizedBytes, target, home, away) : harmonizedBytes;
    } catch {
      return fail("DOWNLOAD_FAILED", "Harmanlanmış görsel indirilemedi — birazdan tekrar deneyin.");
    }
  } else {
    savedSteps.push(meta.harmonize ? "AI harmanlama atlandı (Ekonomik mod)" : "AI harmanlama gerekmiyor (düz zeminli şablon)");
  }

  // 5. Tipografi katmanı → nihai PNG. Depolamadan ayrı yakalanır: Satori/sharp hatası
  // "kaydedilemedi" diye görünmesin, gerçek neden loglansın.
  let final: Buffer;
  try {
    final = await finalizeMatchDayImage(art, await renderMatchDayOverlay(card, input.template, frame), frame);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[match-day] ${input.template}/${input.format} tipografi katmanı çizilemedi:`, error);
    return fail("RENDER_FAILED", `Kartın yazı katmanı çizilemedi (${meta.label}, ${frame.ratioLabel}): ${reason}`);
  }

  try {
    const [backgroundImageUrl, compositeImageUrl, resultImageUrl] = await Promise.all([
      saveJpeg(background.data.bytes),
      saveJpeg(composite),
      saveStoredFile("renders", `${randomUUID()}.png`, final),
    ]);

    // Takvimde bu maç için planlanmış (placeholder) kayıt varsa üretim onun üzerine yazılır.
    const record = await createScheduledContent({
      fixtureId: input.fixtureId ?? MANUAL_MATCH_DAY_FIXTURE_ID,
      contentType: "MATCH_DAY" satisfies ContentTypeId,
      prompt,
      backgroundImageUrl,
      resultImageUrl,
      status: "DRAFT",
      format: DB_FORMAT[input.format],
      caption: buildCaption(card),
      renderOptions: {
        kind: "MATCH_DAY",
        template: input.template,
        format: input.format,
        quality: input.quality,
        info: { ...input.info },
        compositeImageUrl,
        homeCutoutHash: input.homePlayer.hash,
        awayCutoutHash: input.awayPlayer.hash,
        homeColorHex: input.homeColorHex,
        awayColorHex: input.awayColorHex,
        derbyIntensity: input.derbyIntensity,
        strength: input.strength,
        preservePlayers: input.preservePlayers,
        paidCalls,
      },
    });

    return {
      ok: true,
      data: {
        id: record.id,
        resultImageUrl,
        backgroundImageUrl,
        compositeImageUrl,
        prompt,
        template: input.template,
        format: input.format,
        paidCalls,
        savedSteps,
      },
    };
  } catch (error: unknown) {
    console.error("[match-day] kart kaydedilemedi:", error);
    return fail("STORAGE_FAILED", "Kart kaydedilemedi — depolamaya ya da veritabanına yazılamadı.");
  }
}
