import sharp, { type Metadata } from "sharp";
import { getContentType } from "@/lib/dashboard/content-types";
import { markDraftPublished, type PublishDecision } from "@/lib/dashboard/draft-engine";
import { CONTENT_MAX_HASHTAGS, captionFacts, captionLength, captionWarnings, publishMediaOf, validMediaOrder } from "@/lib/dashboard/publish-caption";
import { allowedMediaUrls } from "@/lib/dashboard/publish-media";
import { signPublicMediaUrl } from "@/lib/dashboard/public-media";
import { parseStoredFileUrl, readStoredFile } from "@/lib/dashboard/storage";
import { vitrinPublishCheck } from "@/lib/prediction/approval";
import { prisma } from "@/lib/prisma";
import { generateCaption, isAnthropicConfigured } from "@/lib/services/anthropic";
import { publishToPlatform, type PublishMediaFile } from "@/lib/services/social/publish";
import { PUBLISH_PLATFORM_DEFS, type CaptionDraft, type PublishedInfo, type PublishPlatform } from "@/types/publishing";
import type { Result } from "@/types/result";

/**
 * Yayın Merkezi'nin platforma özel metni. Olgu kaynağı her zaman veritabanındaki kayıttır (formdan gelen
 * metin modele gönderilmez): kartın şablon metni + içerik türü + görsel adları. Yalnızca admin tıklamasıyla
 * çalışır (bkz. CLAUDE.md 1.10); ANTHROPIC_API_KEY yoksa şablon metni döner.
 */
export async function generateDraftCaption(id: string, platform: PublishPlatform): Promise<Result<CaptionDraft>> {
  const record = await prisma.aiContent.findUnique({ where: { id }, select: { status: true, caption: true, contentType: true, renderOptions: true, resultImageUrl: true } });
  if (!record) return { ok: false, error: { code: "NOT_FOUND", message: "Taslak bulunamadı." } };
  if (record.status !== "DRAFT") return { ok: false, error: { code: "NOT_EDITABLE", message: "Karara bağlanmış taslağın metni değiştirilemez." } };

  const baseCaption = record.caption?.trim() ?? "";
  if (!isAnthropicConfigured()) {
    return { ok: true, data: { caption: baseCaption, warnings: ["ANTHROPIC_API_KEY tanımlı değil — şablon metni gösteriliyor."], source: "template" } };
  }
  const contentLabel = (record.contentType ? getContentType(record.contentType)?.label : undefined) ?? "Maç içeriği";
  const media = publishMediaOf(record.renderOptions, record.resultImageUrl);
  const facts = captionFacts(contentLabel, baseCaption, media.map((item) => item.label));
  const maxHashtags = record.contentType ? (CONTENT_MAX_HASHTAGS[record.contentType] ?? null) : null;
  const result = await generateCaption(platform, facts, { maxHashtags });
  if (!result.ok) return { ok: false, error: { code: result.error.code, message: result.error.message } };
  return { ok: true, data: { caption: result.data.caption, warnings: captionWarnings(result.data.caption, platform, JSON.stringify(facts), maxHashtags), source: "ai" } };
}

// ---- Hemen Paylaş ----

/** Aynı taslağın iki kez paylaşılmasına karşı süreç içi kilit (tek instance — bkz. CLAUDE.md 1.8 rate-limit notu). */
const inFlight = new Set<string>();
/** X görsel sınırı 5 MB; büyük PNG JPEG'e çevrilir. */
const X_MAX_BYTES = 5 * 1024 * 1024;
/** Instagram akış gönderisi en-boy oranı aralığı (4:5 … 1.91:1); 9:16 yalnızca hikâyede. */
const IG_FEED_RATIO: readonly [number, number] = [0.79, 1.92];

async function prepareFile(url: string, platform: PublishPlatform): Promise<Result<PublishMediaFile>> {
  const stored = parseStoredFileUrl(url);
  const bytes = stored ? await readStoredFile(stored.bucket, stored.fileName) : null;
  if (!bytes) return { ok: false, error: { code: "NOT_FOUND", message: "Görsel dosyası bulunamadı." } };
  const publicUrl = signPublicMediaUrl(url);
  if (!publicUrl) return { ok: false, error: { code: "INVALID_INPUT", message: "Bu görsel paylaşıma açılamaz." } };

  let meta: Metadata;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    return { ok: false, error: { code: "INVALID_INPUT", message: "Görsel okunamadı." } };
  }
  if (platform === "IG_POST" && meta.width && meta.height) {
    const ratio = meta.width / meta.height;
    if (ratio < IG_FEED_RATIO[0] || ratio > IG_FEED_RATIO[1]) {
      return { ok: false, error: { code: "INVALID_INPUT", message: "Instagram gönderisi 4:5 ile 1.91:1 arası oran kabul eder — 9:16 kart için Reels / Story seçin." } };
    }
  }
  // X: PNG/JPEG doğrudan; SVG/WebP ya da 5 MB üstü JPEG'e çevrilir.
  if ((meta.format === "png" || meta.format === "jpeg") && bytes.length <= X_MAX_BYTES) {
    return { ok: true, data: { buffer: bytes, mimeType: meta.format === "png" ? "image/png" : "image/jpeg", publicUrl } };
  }
  const jpeg = await sharp(bytes).flatten({ background: "#0a1a2f" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return { ok: true, data: { buffer: jpeg, mimeType: "image/jpeg", publicUrl } };
}

/**
 * "Hemen Paylaş": taslağı seçilen platforma API ile paylaşır ve PUBLISHED olarak kaydeder. Admin
 * tıklamasıyla çalışır (onay = paylaşım, bkz. CLAUDE.md 1.10). Paylaşım başarısızsa kayıt değişmez.
 */
export async function publishDraftNow(id: string, decision: PublishDecision): Promise<Result<PublishedInfo>> {
  if (inFlight.has(id)) return { ok: false, error: { code: "IN_PROGRESS", message: "Bu taslak şu anda paylaşılıyor — bekleyin." } };
  inFlight.add(id);
  try {
    const record = await prisma.aiContent.findUnique({ where: { id }, select: { id: true, status: true, renderOptions: true, resultImageUrl: true } });
    if (!record || !record.resultImageUrl) return { ok: false, error: { code: "NOT_FOUND", message: "Taslak bulunamadı." } };
    if (record.status !== "DRAFT" && record.status !== "APPROVED") return { ok: false, error: { code: "NOT_EDITABLE", message: "Bu taslak zaten yayınlandı ya da reddedildi." } };
    // Vitrin: yalnızca onaylı + tahmin kaydı yazılmış + kickoff öncesi — platform çağrısından ÖNCE.
    const vitrin = await vitrinPublishCheck(id, new Date());
    if (!vitrin.ok) return vitrin;

    const { settings, caption } = decision;
    if (!validMediaOrder(settings.mediaOrder, await allowedMediaUrls(record, settings.mediaOrder), settings.layout, settings.platform)) {
      return { ok: false, error: { code: "INVALID_INPUT", message: "Görsel dizilimi geçersiz — sayfayı yenileyip tekrar deneyin." } };
    }
    const limit = PUBLISH_PLATFORM_DEFS[settings.platform].captionLimit;
    if (captionLength(caption, settings.platform) > limit) return { ok: false, error: { code: "INVALID_INPUT", message: `Metin ${limit} karakter sınırını aşıyor.` } };

    const files: PublishMediaFile[] = [];
    for (const url of settings.mediaOrder) {
      const file = await prepareFile(url, settings.platform);
      if (!file.ok) return file;
      files.push(file.data);
    }

    const published = await publishToPlatform({ platform: settings.platform, caption, media: files });
    if (!published.ok) {
      console.error(`[publish] ${settings.platform} paylaşımı başarısız: ${published.error.message}`);
      return { ok: false, error: { code: published.error.code, message: published.error.message } };
    }
    const info: PublishedInfo = { platform: settings.platform, postId: published.data.postId, url: published.data.url, at: new Date().toISOString() };
    const saved = await markDraftPublished(id, info, decision);
    // Gönderi platformda yayında; kayıt yazılamadıysa bağlantı yine de admin'e gösterilir.
    if (!saved.ok) return { ok: false, error: { code: saved.error.code, message: `${saved.error.message} Gönderi: ${info.url}` } };
    return { ok: true, data: info };
  } finally {
    inFlight.delete(id);
  }
}
