import { randomUUID } from "node:crypto";
import { buildDraftCaption } from "@/lib/dashboard/draft-caption";
import { deleteStoredUrl, persistBackground, renderDraftImage } from "@/lib/dashboard/draft-render";
import { parseStatsSnapshot, toJsonValue } from "@/lib/dashboard/draft-snapshot";
import { ensurePlayerResolution } from "@/lib/dashboard/player-upscale";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { STUDIO_FORMAT_DEFS } from "@/lib/dashboard/studio-formats";
import { downloadImage, type UploadedImage } from "@/lib/dashboard/studio-images";
import { prisma } from "@/lib/prisma";
import { getMatchStats, parseFixtureId, type ApiFootballError } from "@/lib/services/api-football";
import { generateStadiumBackground, removePlayerBackground } from "@/lib/services/fal";
import type { Result } from "@/types/result";
import { STUDIO_FORMATS, type StudioFormat } from "@/types/ai-content";
import type { DraftRenderOptions } from "@/types/draft";
import type { MatchStats } from "@/types/sports";

/**
 * Yarı otomatik (human-in-the-loop) içerik motoru — bkz. CLAUDE.md 1.10. Hiçbir şey kendi
 * kendine çalışmaz: her üretim admin'in butonuyla tetiklenir, sonuç DRAFT olarak kaydedilir
 * ve ancak inceleme ekranında onaylanınca APPROVED olur.
 */

type EngineError = { code: string; message: string };
const fail = (code: string, message: string): { ok: false; error: EngineError } => ({ ok: false, error: { code, message } });

const STATS_ERROR_MESSAGES: Record<ApiFootballError["code"], string> = {
  NOT_CONFIGURED: "API_FOOTBALL_KEY tanımlı değil — gerçek maç verisi çekilemiyor.",
  TIMEOUT: "API-Football zamanında yanıt vermedi — birazdan tekrar deneyin.",
  NETWORK: "API-Football'a ulaşılamıyor — internet bağlantısını kontrol edin.",
  HTTP_STATUS: "API-Football hata döndürdü.",
  INVALID_RESPONSE: "API-Football yanıtı beklenen formatta değil.",
  API_ERROR: "API-Football isteği reddetti (kota veya parametre).",
  NOT_FOUND: "Maç API-Football'da bulunamadı.",
};

function isStudioFormat(value: string | null): value is StudioFormat {
  return STUDIO_FORMATS.some((format) => format === value);
}

async function loadMatchStats(fixtureId: string): Promise<Result<MatchStats, EngineError>> {
  const apiId = parseFixtureId(fixtureId);
  if (apiId === null) return fail("UNKNOWN_FIXTURE", "Bu maç gerçek veri kaynağında (API-Football) değil.");
  const result = await getMatchStats(apiId);
  return result.ok ? result : fail(result.error.code, STATS_ERROR_MESSAGES[result.error.code]);
}

/** Küçük fotoğraf önce AI Upscale'den geçer, hemen ardından birefnet (bkz. player-upscale.ts). */
async function cutPlayer(photo: UploadedImage) {
  const ready = await ensurePlayerResolution(photo, "Oyuncu fotoğrafı");
  if (!ready.ok) return ready;
  return removePlayerBackground({ bytes: ready.data.bytes, contentType: ready.data.contentType });
}

export interface CreateDraftInput {
  fixtureId: string;
  format: StudioFormat;
  renderOptions: DraftRenderOptions;
  customPrompt?: string | undefined;
  playerPhoto?: UploadedImage | null;
  /** Medya kütüphanesindeki logonun kalıcı URL'i (bkz. lib/dashboard/media-library.ts). */
  logoImageUrl?: string | null;
  postId?: string | null;
}

export interface CreatedDraft {
  id: string;
  resultImageUrl: string;
  prompt: string;
}

/**
 * Tek tıkla taslak: gerçek istatistikleri çek → Fal.ai'den arka plan (+ varsa oyuncu kesimi)
 * üret ve kalıcılaştır → görseli çiz → gönderi metni taslağını yaz → DRAFT kaydet.
 */
export async function createMatchDraft(input: CreateDraftInput): Promise<Result<CreatedDraft, EngineError>> {
  const statsResult = await loadMatchStats(input.fixtureId);
  if (!statsResult.ok) return statsResult;
  const stats = statsResult.data;
  const formatDef = STUDIO_FORMAT_DEFS[input.format];

  const [background, cutout] = await Promise.all([
    generateStadiumBackground({
      fixture: { ...stats.fixture, derbyIntensity: input.renderOptions.derbyIntensity },
      customPrompt: input.customPrompt,
      width: formatDef.width,
      height: formatDef.height,
    }),
    input.playerPhoto ? cutPlayer(input.playerPhoto) : Promise.resolve(null),
  ]);
  if (!background.ok) return fail(background.error.code, background.error.message);
  if (cutout && !cutout.ok) return fail(cutout.error.code, cutout.error.message);

  try {
    const backgroundImageUrl = await persistBackground(background.data.imageUrl);
    const playerImageUrl = cutout
      ? await saveStoredFile("generated", `${randomUUID()}.png`, await downloadImage(cutout.data.transparentImageUrl))
      : null;
    const logoImageUrl = input.logoImageUrl ?? null;

    const assets = { backgroundImageUrl, playerImageUrl, logoImageUrl };
    const resultImageUrl = await renderDraftImage(stats, input.format, input.renderOptions, assets);

    const record = await prisma.aiContent.create({
      data: {
        ...assets,
        fixtureId: input.fixtureId,
        postId: input.postId || null,
        prompt: background.data.prompt,
        resultImageUrl,
        status: "DRAFT",
        format: input.format,
        caption: buildDraftCaption(stats),
        statsSnapshot: toJsonValue(stats),
        renderOptions: toJsonValue(input.renderOptions),
      },
    });
    return { ok: true, data: { id: record.id, resultImageUrl, prompt: background.data.prompt } };
  } catch {
    return fail("STORAGE_FAILED", "Taslak kaydedilemedi — depolama alanına yazılamadı veya veritabanına ulaşılamadı.");
  }
}

async function loadEditableDraft(id: string) {
  const record = await prisma.aiContent.findUnique({ where: { id } });
  if (!record) return fail("NOT_FOUND", "Taslak bulunamadı.");
  if (record.status !== "DRAFT") return fail("NOT_EDITABLE", "Yalnızca onay bekleyen taslaklar düzenlenebilir.");
  const stats = parseStatsSnapshot(record.statsSnapshot);
  if (!stats || !isStudioFormat(record.format)) {
    return fail("NO_SNAPSHOT", "Bu kayıt maç verisi olmadan üretilmiş — yeniden render edilemez.");
  }
  return { ok: true as const, data: { record, stats, format: record.format } };
}

/**
 * Metin ve görsel ayarlarını kaydedip görseli depodaki katmanlardan yeniden çizer —
 * Fal.ai'ye gidilmez, ücretsizdir. Eski render dosyası silinir.
 */
export async function updateDraft(
  id: string,
  edits: { caption: string; renderOptions: DraftRenderOptions },
): Promise<Result<null, EngineError>> {
  const loaded = await loadEditableDraft(id);
  if (!loaded.ok) return loaded;
  const { record, stats, format } = loaded.data;

  try {
    const resultImageUrl = await renderDraftImage(stats, format, edits.renderOptions, record);
    await prisma.aiContent.update({
      where: { id },
      data: { caption: edits.caption, renderOptions: toJsonValue(edits.renderOptions), resultImageUrl },
    });
    if (record.resultImageUrl !== resultImageUrl) await deleteStoredUrl(record.resultImageUrl);
    return { ok: true, data: null };
  } catch {
    return fail("STORAGE_FAILED", "Taslak güncellenemedi.");
  }
}

/**
 * Arka planı Fal.ai ile yeniden üretir (ücretli). Formdaki güncel metin ve istatistik seçimi
 * de birlikte kaydedilir ki admin'in kaydetmediği düzenlemeler kaybolmasın.
 */
export async function regenerateDraftBackground(
  id: string,
  input: { caption: string; customPrompt?: string | undefined; renderOptions: DraftRenderOptions },
): Promise<Result<null, EngineError>> {
  const loaded = await loadEditableDraft(id);
  if (!loaded.ok) return loaded;
  const { record, stats, format } = loaded.data;
  const formatDef = STUDIO_FORMAT_DEFS[format];

  const background = await generateStadiumBackground({
    fixture: { ...stats.fixture, derbyIntensity: input.renderOptions.derbyIntensity },
    customPrompt: input.customPrompt,
    width: formatDef.width,
    height: formatDef.height,
  });
  if (!background.ok) return fail(background.error.code, background.error.message);

  try {
    const backgroundImageUrl = await persistBackground(background.data.imageUrl);
    const resultImageUrl = await renderDraftImage(stats, format, input.renderOptions, { ...record, backgroundImageUrl });
    await prisma.aiContent.update({
      where: { id },
      data: {
        backgroundImageUrl,
        resultImageUrl,
        caption: input.caption,
        prompt: background.data.prompt,
        renderOptions: toJsonValue(input.renderOptions),
      },
    });
    await Promise.all([deleteStoredUrl(record.backgroundImageUrl), deleteStoredUrl(record.resultImageUrl)]);
    return { ok: true, data: null };
  } catch {
    return fail("STORAGE_FAILED", "Yeni arka plan kaydedilemedi.");
  }
}

/** Onay/ret kararı — yalnızca DRAFT durumundaki kayıtlara uygulanır. */
export async function decideDraft(
  id: string,
  decision: "APPROVED" | "REJECTED",
  postId?: string | null,
): Promise<Result<null, EngineError>> {
  try {
    const { count } = await prisma.aiContent.updateMany({
      // Görseli olmayan planlama placeholder'ı (bkz. content-schedule.ts) karara bağlanamaz.
      where: { id, status: "DRAFT", resultImageUrl: { not: null } },
      data: { status: decision, reviewedAt: new Date(), ...(postId !== undefined ? { postId: postId || null } : {}) },
    });
    return count === 1 ? { ok: true, data: null } : fail("NOT_EDITABLE", "Taslak bulunamadı veya zaten karara bağlanmış.");
  } catch {
    // Ör. seçilen gönderi bu arada silinmiş (yabancı anahtar ihlali).
    return fail("DECISION_FAILED", "Karar kaydedilemedi — seçilen gönderi artık mevcut olmayabilir.");
  }
}

