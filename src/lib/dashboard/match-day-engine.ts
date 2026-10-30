import { fixtureOrigins } from "@/lib/dashboard/team-origin";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { resolveMatchDayCard } from "@/lib/dashboard/match-day-assets";
import { composeMatchDayArt, finalizeMatchDayImage, restorePlayers } from "@/lib/dashboard/match-day-compose";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { resolveBackground, resolveSideCutout } from "@/lib/dashboard/match-day-sides";
import { matchDayLayoutGate, renderMatchDayOverlay } from "@/lib/dashboard/match-day-overlay";
import { loadMatchDayStats } from "@/lib/dashboard/match-day-stats";
import { MATCH_DAY_TEMPLATES } from "@/lib/dashboard/match-day-templates";
import { buildMatchDayCaption } from "@/lib/dashboard/match-day-caption";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { downloadImage, type UploadedImage } from "@/lib/dashboard/studio-images";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { harmonizeMatchDayComposite } from "@/lib/services/fal";
import type { MatchDayPromptInput } from "@/lib/services/fal/match-day-prompts";
import type {
  MatchDayCard,
  MatchDayFormatId,
  MatchDayGenerationResult,
  MatchDayParams,
  MatchDayQualityMode,
  MatchDayTemplateId,
} from "@/types/match-day";
import { reportJobStep } from "@/lib/jobs/studio-jobs";
import { BANNED_LANGUAGE, contentLanguageGate } from "@/lib/prediction/content-language";
import { nameFor } from "@/lib/names/card-name-forms";
import { resolveRefereeName } from "@/lib/names/person-directory";
import type { ContentTypeId } from "@/types/content-type";
import type { Result } from "@/types/result";
import type { DerbyIntensity } from "@/types/sports";

/**
 * Maç Günü kartı üretim hattı (yarı otomatik — admin tıklamasıyla tetiklenir, DRAFT doğar; bkz. CLAUDE.md 1.10):
 *
 *   1. Oyuncu kesimleri (önbellek → yoksa AI Upscale + birefnet; fotoğrafsız ya da kesilemeyen taraf → takımın yedek
 *      tasarımı, Fal'a gidilmez) ‖ arka plan (programatik | önbellek | flux; flux yapılamazsa programatik) ‖ kart
 *      verisi ‖ (veri şablonunda) gerçek istatistikler. Fal yok/hata kartı DÜŞÜRMEZ — sebep `warnings`'te.
 *   2. sharp: arka plan + ışık/gölge + oyuncular + okunabilirlik gölgesi → kaba kompozit (seçili formatta)
 *   3. PREMIUM kalite + şablon destekliyorsa + iki tarafta da oyuncu varsa: Fal.ai image-to-image harmanlama
 *      (yapılamazsa kaba kompozit)
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
  /** Oyuncu fotoğrafı; null → o takımın yedek tasarımı (Fal'a gidilmez). */
  homePlayer: UploadedImage | null;
  awayPlayer: UploadedImage | null;
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

async function saveJpeg(bytes: Buffer): Promise<string> {
  const jpeg = await sharp(bytes).jpeg({ quality: 90 }).toBuffer();
  return saveStoredFile("generated", `${randomUUID()}.jpg`, jpeg);
}

/** Hakem kişi adı kuralından (`MATCH_DAY_REFEREE`, uzun biçim + uyruk kökeni); boşsa formdaki değer kalır. */
async function refereeFields(raw: string | undefined): Promise<Partial<Pick<MatchDayCard, "refereeLabel" | "refereeOrigin">>> {
  const card = raw?.trim() ? await resolveRefereeName(raw) : null;
  return card ? { refereeLabel: nameFor("MATCH_DAY_REFEREE", card), refereeOrigin: card.origin } : {};
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

  // Bahis dili kapısı ücretli adımlardan önce (form metinleri); kart + gönderi metni kayıttan önce yine.
  const early = contentLanguageGate({ card: input.info });
  if (early) return fail(BANNED_LANGUAGE, `${early} — kart üretilmedi.`);

  // 1. Bağımsız adımlar paralel.
  const [homeCut, awayCut, background, baseCard, stats, referee] = await Promise.all([
    resolveSideCutout(input.homePlayer, "Ev sahibi oyuncu fotoğrafı"),
    resolveSideCutout(input.awayPlayer, "Deplasman oyuncu fotoğrafı"),
    resolveBackground(input, frame, promptInput),
    fixtureOrigins(input.fixtureId).then((origins) => resolveMatchDayCard(input.info, { homeColorHex: input.homeColorHex, awayColorHex: input.awayColorHex }, origins)),
    input.template === "DATA_DRIVEN" ? loadMatchDayStats(input.fixtureId) : Promise.resolve(null),
    refereeFields(input.info.referee),
  ]);
  const card: MatchDayCard = { ...baseCard, ...referee, stats };
  // Yerleşim kapısı (DATA_DRIVEN ad satırları): harmanlama ve kayıttan önce — çakışma varsa kart üretilmez.
  const layout = await matchDayLayoutGate(card, input.template, frame);
  if (!layout.ok) return fail(layout.error.code, layout.error.message);
  const language = contentLanguageGate({ card, caption: buildMatchDayCaption(card) });
  if (language) return fail(BANNED_LANGUAGE, `${language} — kart üretilmedi.`);

  const savedSteps: string[] = [];
  if (homeCut.fromCache) savedSteps.push("Ev sahibi oyuncu kesimi önbellekten");
  if (awayCut.fromCache) savedSteps.push("Deplasman oyuncu kesimi önbellekten");
  if (background.saved) savedSteps.push(background.saved);
  // Kartı düşürmeyen geri dönüşler (fotoğrafsız taraf, Fal yok/hata) — stüdyo ve taslak ekranı gösterir.
  const warnings = [homeCut.note, awayCut.note, background.note].filter((note): note is string => note !== null);
  let paidCalls = homeCut.paidCalls + awayCut.paidCalls + background.paidCalls;

  const home = { bytes: homeCut.bytes, colorHex: input.homeColorHex, team: { name: card.homeTeam, hex: input.homeColorHex, logo: card.homeLogo } };
  const away = { bytes: awayCut.bytes, colorHex: input.awayColorHex, team: { name: card.awayTeam, hex: input.awayColorHex, logo: card.awayLogo } };
  const fallbackSide = home.bytes === null || away.bytes === null;
  const target = { template: input.template, frame };

  // 2. Kaba kompozit.
  reportJobStep("Kompozit hazırlanıyor");
  let composite: Buffer;
  try {
    composite = await composeMatchDayArt(background.bytes, target, home, away);
  } catch {
    return fail("COMPOSE_FAILED", "Oyuncu kesimleri arka planla birleştirilemedi.");
  }

  // 3. AI harmanlama — yalnızca PREMIUM kalitede ve şablon destekliyorsa.
  let art = composite;
  let prompt = background.prompt;
  if (meta.harmonize && input.quality === "PREMIUM" && !fallbackSide) {
    reportJobStep("AI harmanlama (Fal image-to-image)");
    const harmonized = await harmonizeMatchDayComposite({ ...promptInput, composite, contentType: "image/png", strength: input.strength });
    if (harmonized.ok) {
      paidCalls += 1;
      try {
        const harmonizedBytes = await downloadImage(harmonized.data.imageUrl);
        // 4. Oyuncuları koru (isteğe bağlı).
        art = input.preservePlayers ? await restorePlayers(harmonizedBytes, target, home, away) : harmonizedBytes;
        prompt = harmonized.data.prompt;
      } catch {
        warnings.push("Harmanlanmış görsel indirilemedi — kaba kompozit kullanıldı.");
      }
    } else warnings.push(`AI harmanlama yapılamadı (${harmonized.error.message}) — kaba kompozit kullanıldı.`);
  } else {
    savedSteps.push(!meta.harmonize ? "AI harmanlama gerekmiyor (düz zeminli şablon)" : fallbackSide ? "AI harmanlama atlandı (fotoğrafsız taraf — arma bozulmasın)" : "AI harmanlama atlandı (Ekonomik mod)");
  }

  // 5. Tipografi katmanı → nihai PNG. Depolamadan ayrı yakalanır: Satori/sharp hatası
  // "kaydedilemedi" diye görünmesin, gerçek neden loglansın.
  reportJobStep("Kart çiziliyor");
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
      saveJpeg(background.bytes),
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
      caption: buildMatchDayCaption(card),
      renderOptions: {
        kind: "MATCH_DAY",
        template: input.template,
        format: input.format,
        quality: input.quality,
        info: { ...input.info },
        compositeImageUrl,
        homeCutoutHash: input.homePlayer?.hash ?? null,
        awayCutoutHash: input.awayPlayer?.hash ?? null,
        homeColorHex: input.homeColorHex,
        awayColorHex: input.awayColorHex,
        derbyIntensity: input.derbyIntensity,
        strength: input.strength,
        preservePlayers: input.preservePlayers,
        paidCalls,
        studioNotes: warnings,
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
        warnings,
      },
    };
  } catch (error: unknown) {
    console.error("[match-day] kart kaydedilemedi:", error);
    return fail("STORAGE_FAILED", "Kart kaydedilemedi — depolamaya ya da veritabanına yazılamadı.");
  }
}
