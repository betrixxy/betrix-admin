import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { buildMatchStatsCaption } from "@/lib/dashboard/match-stats-caption";
import { renderMatchStatsImage } from "@/lib/dashboard/match-stats-render";
import { parseStoredFileUrl, readStoredFile, saveStoredFile } from "@/lib/dashboard/storage";
import { prisma } from "@/lib/prisma";
import { toFixtureId } from "@/lib/services/api-football/mappers";
import type { ColumnSide } from "@/skills/render-engine/templates/checkmatch-set/landscape";
import type { ContentTypeId } from "@/types/content-type";
import type { MatchDayFormatId } from "@/types/match-day";
import type { MatchStatsFacts, MatchStatsGenerationResult, MatchStatsPage } from "@/types/match-stats";
import type { Result } from "@/types/result";
import type { SocialFormatId } from "@/types/studio-formats";

/**
 * Maç İstatistikleri (02) üretim hattı — set kartı. Ağ/Fal çağrısı yok; yarı otomatik (admin
 * tıklaması, DRAFT doğar — CLAUDE.md 1.10).
 *
 *   - Zemin: aynı maçın 01 Maç Sonucu görseli (ağır bulanık + koyu) — carousel'de 01'den 02'ye
 *     renk ve ışık sürer. Tek başına üretimde o maçın aynı formattaki son 01 kartı kullanılır,
 *     yoksa programatik zemin (takım renginde ışıklar).
 *   - 16:9 set sütunu 01 ile aynı tarafta (01 aynalandıysa 02 de).
 *   - YERLEŞİM KAPISI: çakışma ya da güvenli kenar taşması varsa kart üretilmez, sebep yazılır.
 */

type EngineError = { code: string; message: string };
const fail = (code: string, message: string): { ok: false; error: EngineError } => ({ ok: false, error: { code, message } });

/** `AiContent.format` + `renderOptions.format` (sosyal format kaydı) eşlemesi — Maç Sonucu ile aynı. */
const FORMATS: Record<MatchDayFormatId, { db: string; social: SocialFormatId }> = {
  IG_PORTRAIT: { db: "IG_FEED", social: "post" },
  IG_SQUARE: { db: "IG_SQUARE", social: "square" },
  STORY: { db: "STORY", social: "story" },
  X_LANDSCAPE: { db: "X_CARD", social: "landscape" },
};

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;

const resultOptionsSchema = z.object({ kind: z.literal("MATCH_RESULT"), frameFormat: z.string(), imageUrl: z.string(), side: z.enum(["left", "right"]).optional() });

/** Aynı maçın aynı formattaki en yeni (reddedilmemiş) 01 kartı — zemin ve 16:9 sütun tarafı. */
async function latestResultCard(fixtureId: string, format: MatchDayFormatId): Promise<{ id: string; image: Buffer; side: ColumnSide } | null> {
  const rows = await prisma.aiContent.findMany({
    where: { fixtureId, contentType: "MATCH_RESULT", status: { not: "REJECTED" }, resultImageUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, renderOptions: true },
  });
  for (const row of rows) {
    const options = resultOptionsSchema.safeParse(row.renderOptions);
    if (!options.success || options.data.frameFormat !== format) continue;
    const stored = parseStoredFileUrl(options.data.imageUrl);
    const image = stored ? await readStoredFile(stored.bucket, stored.fileName) : null;
    if (image) return { id: row.id, image, side: options.data.side ?? "right" };
  }
  return null;
}

export interface CreateMatchStatsInput {
  stats: MatchStatsFacts;
  format: MatchDayFormatId;
  page: MatchStatsPage;
}

/** Tek başına "Maç İstatistikleri" kartı → DRAFT `AiContent` (`MATCH_STATS`). */
export async function createMatchStatsCard(input: CreateMatchStatsInput): Promise<Result<MatchStatsGenerationResult, EngineError>> {
  const { stats } = input;
  const frame = MATCH_DAY_FRAMES[input.format];
  const fixtureId = toFixtureId(stats.fixtureId);
  const base = await latestResultCard(fixtureId, input.format);
  const rendered = await renderMatchStatsImage({ stats, frame, page: input.page, side: base?.side ?? "right", resultImage: base?.image ?? null, pageLabel: null });
  if (!rendered.ok) return rendered;

  const notes = [...stats.warnings];
  notes.push(base ? "Zemin: aynı maçın Maç Sonucu kartı (bulanık)" : "Bu format için Maç Sonucu kartı yok — programatik zemin kullanıldı");
  if (!stats.sportmonksMatched) notes.push("Sportmonks maçı eşleşmedi — yalnızca API-Football satırları");
  try {
    const resultImageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, rendered.data);
    const format = FORMATS[input.format];
    const record = await createScheduledContent({
      fixtureId,
      contentType: "MATCH_STATS" satisfies ContentTypeId,
      prompt: "",
      resultImageUrl,
      status: "DRAFT",
      format: format.db,
      caption: buildMatchStatsCaption(stats),
      statsSnapshot: asJson(stats),
      renderOptions: asJson({
        kind: "MATCH_STATS",
        format: format.social,
        frameFormat: input.format,
        imageUrl: resultImageUrl,
        title: matchResultTitle(stats),
        subtitle: `${stats.competition.name} · ${stats.roundLabel}`,
        page: input.page,
        side: base?.side ?? "right",
        baseResultId: base?.id ?? null,
      }),
    });
    return { ok: true, data: { id: record.id, resultImageUrl, format: input.format, notes } };
  } catch (error: unknown) {
    console.error("[match-stats] kart kaydedilemedi:", error);
    return fail("STORAGE_FAILED", "Kart kaydedilemedi — depolamaya ya da veritabanına yazılamadı.");
  }
}

