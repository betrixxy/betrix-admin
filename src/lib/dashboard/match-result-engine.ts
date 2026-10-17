import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { backgroundCacheKey, getPlayerCutout, readCachedBackground, saveCachedBackground } from "@/lib/dashboard/match-day-cache";
import { economyBackgroundSize } from "@/lib/dashboard/match-day-engine";
import { MATCH_DAY_FRAMES, type MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { resolveMatchResultCard } from "@/lib/dashboard/match-result-card";
import { buildMatchResultCaption, matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { backdropText, renderResultBackdrop } from "@/lib/dashboard/match-result-backdrop";
import { composeResultArt } from "@/lib/dashboard/match-result-compose";
import { renderMatchResultOverlay } from "@/lib/dashboard/match-result-overlay";
import { resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { downloadImage, type UploadedImage } from "@/lib/dashboard/studio-images";
import { toFixtureId } from "@/lib/services/api-football/mappers";
import { buildMatchResultBackgroundPrompt, buildMatchResultHarmonizePrompt, generateFluxScene, harmonizeComposite } from "@/lib/services/fal";
import type { MatchResultPromptInput } from "@/lib/services/fal/match-result-prompts";
import type { ContentTypeId } from "@/types/content-type";
import type { MatchDayFormatId, MatchDayQualityMode } from "@/types/match-day";
import type { MatchImportance, MatchResultFacts, MatchResultGenerationResult, MvpCandidate } from "@/types/match-result";
import type { Result } from "@/types/result";
import type { SocialFormatId } from "@/types/studio-formats";

/**
 * Maç Sonucu kartı üretim hattı (yarı otomatik — admin tıklamasıyla, DRAFT doğar; bkz. CLAUDE.md 1.10).
 * Maç Günü ile aynı altyapı:
 *
 *   1. Oyuncu kesim(ler)i (önbellek → yoksa AI Upscale + birefnet) ‖ arka plan (önbellek | flux:
 *      galibiyet ya da beraberlik sahnesi) ‖ kart verisi
 *   2. sharp: arka plan + vurgu renkli arka ışık/gölge + oyuncu(lar) → kaba kompozit
 *   3. PREMIUM: Fal.ai image-to-image (galibiyette sıcak key light + ışık partikülleri eki)
 *   4. (isteğe bağlı) orijinal kesimleri yeniden bas — yüz/forma birebir korunur
 *   5. Satori: gradyan + skor + golcüler + marka → PNG + set bitişi (vinyet + film greni)
 *
 * Arka plan tipografisi ("1-0" / "BERABERE") oyuncunun arkasına basılır: Ekonomik'te tek
 * kompozitte; Premium'da AI harmanlamaya girmez (yazı bozulmasın), orijinal kesimler yeniden
 * basılırken altlarına eklenir — "oyuncuları koru" kapalıysa oyuncu harmanlanmış görselin
 * içinde kaldığı için arkasına yazı konamaz ve atlanır.
 */

type EngineError = { code: string; message: string };
const fail = (code: string, message: string): { ok: false; error: EngineError } => ({ ok: false, error: { code, message } });

export interface FeaturedPlayer {
  candidate: MvpCandidate;
  image: UploadedImage;
  /** Kütüphanedeki kalıcı URL — `AiContent.playerImageUrl`. */
  fileUrl: string;
}

export interface CreateMatchResultInput {
  /** Sunucuda yeniden çekilip doğrulanmış gerçek maç verisi — istemciden gelmez. */
  facts: MatchResultFacts;
  format: MatchDayFormatId;
  importance: MatchImportance;
  quality: MatchDayQualityMode;
  reuseBackground: boolean;
  /** Galibiyette 1 (MVP), beraberlikte 2 (ev sahibi, deplasman). */
  players: FeaturedPlayer[];
  /** Karta "MAÇIN OYUNCUSU" olarak yazılan oyuncu. */
  mvp: MvpCandidate;
  strength: number;
  preservePlayers: boolean;
  customPrompt?: string | undefined;
}

/** `AiContent.format` + `renderOptions.format` (sosyal format kaydı) eşlemesi. */
const FORMATS: Record<MatchDayFormatId, { db: string; social: SocialFormatId }> = {
  IG_PORTRAIT: { db: "IG_FEED", social: "post" },
  IG_SQUARE: { db: "IG_SQUARE", social: "square" },
  STORY: { db: "STORY", social: "story" },
  X_LANDSCAPE: { db: "X_CARD", social: "landscape" },
};

function promptInput(input: CreateMatchResultInput): MatchResultPromptInput {
  const { facts } = input;
  const [primary, secondary] = facts.outcome === "AWAY" ? [facts.away, facts.home] : [facts.home, facts.away];
  const accent = resultAccentHex(facts);
  return {
    mood: facts.outcome === "DRAW" ? "DRAW" : "WIN",
    importance: input.importance,
    primaryColorHex: primary.colorHex || accent,
    secondaryColorHex: secondary.colorHex || accent,
    customPrompt: input.customPrompt,
  };
}

async function getBackground(input: CreateMatchResultInput, frame: MatchDayFrame, prompt: string) {
  const size = economyBackgroundSize(frame);
  const key = backgroundCacheKey(prompt, size.width, size.height);
  if (input.reuseBackground) {
    const cached = await readCachedBackground(key);
    if (cached) return { ok: true as const, data: { bytes: cached, paidCalls: 0, fromCache: true } };
  }
  const generated = await generateFluxScene(prompt, size.width, size.height, "Maç Sonucu arka planı üretilemedi.");
  if (!generated.ok) return fail(generated.error.code, `Arka plan: ${generated.error.message}`);
  try {
    const jpeg = await sharp(await downloadImage(generated.data.imageUrl)).jpeg({ quality: 90 }).toBuffer();
    await saveCachedBackground(key, jpeg);
    return { ok: true as const, data: { bytes: jpeg, paidCalls: 1, fromCache: false } };
  } catch {
    return fail("DOWNLOAD_FAILED", "Arka plan Fal.ai'den indirilemedi — birazdan tekrar deneyin.");
  }
}

async function saveJpeg(bytes: Buffer): Promise<string> {
  return saveStoredFile("generated", `${randomUUID()}.jpg`, await sharp(bytes).jpeg({ quality: 90 }).toBuffer());
}

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;

export async function createMatchResultCard(input: CreateMatchResultInput): Promise<Result<MatchResultGenerationResult, EngineError>> {
  const { facts } = input;
  const frame = MATCH_DAY_FRAMES[input.format];
  const accent = resultAccentHex(facts);
  const prompts = promptInput(input);
  const backgroundPrompt = buildMatchResultBackgroundPrompt(prompts);

  // 1. Bağımsız adımlar paralel.
  const [cutouts, background, card] = await Promise.all([
    Promise.all(input.players.map((player) => getPlayerCutout(player.image, `${player.candidate.name} fotoğrafı`))),
    getBackground(input, frame, backgroundPrompt),
    resolveMatchResultCard(facts, input.mvp.name),
  ]);
  const cutoutBytes: Buffer[] = [];
  const savedSteps: string[] = [];
  let paidCalls = 0;
  for (const [index, cutout] of cutouts.entries()) {
    if (!cutout.ok) return fail(cutout.error.code, cutout.error.message);
    cutoutBytes.push(cutout.data.bytes);
    paidCalls += cutout.data.paidCalls;
    if (cutout.data.fromCache) savedSteps.push(`${input.players[index]?.candidate.name ?? "Oyuncu"} kesimi önbellekten`);
  }
  if (!background.ok) return background;
  paidCalls += background.data.paidCalls;
  if (background.data.fromCache) savedSteps.push("Arka plan önbellekten");

  // 2. Kaba kompozit (Ekonomik'te arka plan tipografisi burada; Premium'da harmanlamadan sonra).
  let composite: Buffer;
  let backdrop: Buffer;
  try {
    backdrop = await renderResultBackdrop(backdropText(facts.outcome, facts.home.goals, facts.away.goals), frame);
    composite = await composeResultArt(background.data.bytes, frame, cutoutBytes, accent, true, input.quality === "PREMIUM" ? null : backdrop);
  } catch {
    return fail("COMPOSE_FAILED", "Oyuncu kesimleri arka planla birleştirilemedi.");
  }

  // 3-4. AI düzenleme — yalnızca PREMIUM'da.
  let art = composite;
  let prompt = backgroundPrompt;
  if (input.quality === "PREMIUM") {
    const harmonized = await harmonizeComposite({
      prompt: buildMatchResultHarmonizePrompt(prompts),
      composite,
      contentType: "image/png",
      strength: input.strength,
    });
    if (!harmonized.ok) return fail(harmonized.error.code, `Harmanlama: ${harmonized.error.message}`);
    paidCalls += 1;
    prompt = harmonized.data.prompt;
    try {
      const bytes = await downloadImage(harmonized.data.imageUrl);
      art = input.preservePlayers ? await composeResultArt(bytes, frame, cutoutBytes, accent, false, backdrop) : bytes;
    } catch {
      return fail("DOWNLOAD_FAILED", "Harmanlanmış görsel indirilemedi — birazdan tekrar deneyin.");
    }
  } else {
    savedSteps.push("AI düzenleme atlandı (Ekonomik mod)");
  }

  // 5. Yazı katmanı → nihai PNG.
  let final: Buffer;
  try {
    final = await finalizeSetImage(art, await renderMatchResultOverlay(card, frame), frame, facts.fixtureId);
  } catch (error: unknown) {
    console.error(`[match-result] ${input.format} yazı katmanı çizilemedi:`, error);
    return fail("RENDER_FAILED", `Kartın yazı katmanı çizilemedi (${frame.ratioLabel}): ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const [backgroundImageUrl, compositeImageUrl, resultImageUrl] = await Promise.all([
      saveJpeg(background.data.bytes),
      saveJpeg(composite),
      saveStoredFile("renders", `${randomUUID()}.png`, final),
    ]);
    const format = FORMATS[input.format];
    const record = await createScheduledContent({
      fixtureId: toFixtureId(facts.fixtureId),
      contentType: "MATCH_RESULT" satisfies ContentTypeId,
      prompt,
      backgroundImageUrl,
      resultImageUrl,
      playerImageUrl: input.players.find((player) => player.candidate.playerId === input.mvp.playerId)?.fileUrl ?? null,
      status: "DRAFT",
      format: format.db,
      caption: buildMatchResultCaption(facts, input.mvp.name),
      statsSnapshot: asJson(facts),
      renderOptions: asJson({
        kind: "MATCH_RESULT",
        template: "HERO_SCORE",
        format: format.social,
        frameFormat: input.format,
        imageUrl: resultImageUrl,
        title: matchResultTitle(facts),
        subtitle: `${facts.competition.name} · ${facts.roundLabel}`,
        importance: input.importance,
        quality: input.quality,
        strength: input.strength,
        preservePlayers: input.preservePlayers,
        mvp: input.mvp,
        players: input.players.map((player) => ({ ...player.candidate, cutoutHash: player.image.hash })),
        compositeImageUrl,
        paidCalls,
      }),
    });
    return {
      ok: true,
      data: { id: record.id, resultImageUrl, backgroundImageUrl, compositeImageUrl, prompt, format: input.format, paidCalls, savedSteps },
    };
  } catch (error: unknown) {
    console.error("[match-result] kart kaydedilemedi:", error);
    return fail("STORAGE_FAILED", "Kart kaydedilemedi — depolamaya ya da veritabanına yazılamadı.");
  }
}
