import { getContentType } from "@/lib/dashboard/content-types";
import { captionFacts, captionWarnings, publishMediaOf } from "@/lib/dashboard/publish-caption";
import { prisma } from "@/lib/prisma";
import { generateCaption, isAnthropicConfigured } from "@/lib/services/anthropic";
import type { CaptionDraft, PublishPlatform } from "@/types/publishing";
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
  const result = await generateCaption(platform, facts);
  if (!result.ok) return { ok: false, error: { code: result.error.code, message: result.error.message } };
  return { ok: true, data: { caption: result.data.caption, warnings: captionWarnings(result.data.caption, platform, JSON.stringify(facts)), source: "ai" } };
}
