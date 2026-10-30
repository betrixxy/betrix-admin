import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { buildSpotlightCaption, buildTopPlayersCaption } from "@/lib/dashboard/player-stats-caption";
import { renderPlayerPage, type PlayerPage, type PlayerPageInput } from "@/lib/dashboard/player-stats-page";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { reportJobStep } from "@/lib/jobs/studio-jobs";
import { bannedWordsGate } from "@/lib/prediction/banned-words";
import { toFixtureId } from "@/lib/services/api-football/mappers";
import type { ContentTypeId } from "@/types/content-type";
import type { MatchDayFormatId } from "@/types/match-day";
import type { PlayerStatsFacts, PlayerStatsGenerationResult } from "@/types/player-match-stats";
import type { Result } from "@/types/result";
import type { SocialFormatId } from "@/types/studio-formats";

/**
 * Oyuncu İstatistikleri tek başına üretim → DRAFT `AiContent` (`PLAYER_STATS`). Yarı otomatik (admin
 * tıklaması, arka plan işi). Fal yalnızca A'nın arşiv fotoğrafı büyütülmemişse (önbellekli, tek çağrı).
 * Gönderi metni ve kart metni dil kapısından geçer (bahis dili yok).
 */

type EngineError = { code: string; message: string; notSettled?: boolean };

/** `AiContent.format` + `renderOptions.format` (sosyal format kaydı) — Maç Sonucu ile aynı eşleme. */
export const PLAYER_STATS_FORMATS: Record<MatchDayFormatId, { db: string; social: SocialFormatId }> = {
  IG_PORTRAIT: { db: "IG_FEED", social: "post" },
  IG_SQUARE: { db: "IG_SQUARE", social: "square" },
  STORY: { db: "STORY", social: "story" },
  X_LANDSCAPE: { db: "X_CARD", social: "landscape" },
};

export const PLAYER_PAGE_LABELS = { SPOTLIGHT: "MAÇIN OYUNCUSU", TOP_PLAYERS: "MAÇIN EN İYİLERİ" } as const;

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;

/** Oyuncu sayfasının gönderi metni (tek başına üretim). */
export function playerPageCaption(facts: PlayerStatsFacts, input: Pick<PlayerPageInput, "template">, page: PlayerPage): string {
  return input.template === "SPOTLIGHT" && page.lines[0] ? buildSpotlightCaption(facts, page.lines[0], page.names, page.fact) : buildTopPlayersCaption(facts, page.lines, page.names);
}

export async function createPlayerStatsDraft(input: Omit<PlayerPageInput, "pageLabel" | "side" | "resultImage">): Promise<Result<PlayerStatsGenerationResult, EngineError>> {
  const { facts } = input;
  const page = await renderPlayerPage({ ...input, pageLabel: null });
  if (!page.ok) return page;
  const caption = playerPageCaption(facts, input, page.data);
  const language = bannedWordsGate({ "gönderi metni": caption });
  if (language) return { ok: false, error: { code: "BANNED_LANGUAGE", message: `${language} — kart üretilmedi.` } };

  reportJobStep("Kaydediliyor");
  try {
    const imageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, page.data.image);
    const format = PLAYER_STATS_FORMATS[input.format];
    const label = PLAYER_PAGE_LABELS[input.template];
    const record = await createScheduledContent({
      fixtureId: toFixtureId(facts.match.fixtureId),
      contentType: "PLAYER_STATS" satisfies ContentTypeId,
      prompt: "",
      // Arşiv fotoğrafı kayda bağlanmaz (taslak silinince arşiv dosyası silinmesin) — kaynağı renderOptions.photo.
      backgroundImageUrl: null,
      resultImageUrl: imageUrl,
      playerImageUrl: null,
      status: "DRAFT",
      format: format.db,
      caption,
      statsSnapshot: asJson({ match: facts.match, lines: page.data.lines, xgMatched: facts.xgMatched }),
      renderOptions: asJson({
        kind: "PLAYER_STATS",
        template: input.template,
        format: format.social,
        frameFormat: input.format,
        imageUrl,
        title: `${label} · ${matchResultTitle(facts.match)}`,
        subtitle: `${facts.match.competition.name} · ${facts.match.roundLabel}`,
        players: page.data.lines.map((line) => line.playerId),
        count: input.template === "TOP_PLAYERS" ? page.data.lines.length : null,
        photo: page.data.photo,
        side: page.data.side,
        paidCalls: page.data.paidCalls,
        // Kesinleşmeden üretildi ("şimdi üret") — puanlar değişebilir.
        provisional: !facts.settlement.settled,
      }),
    });
    return { ok: true, data: { id: record.id, imageUrl, format: input.format, template: input.template, paidCalls: page.data.paidCalls, notes: page.data.notes } };
  } catch (error: unknown) {
    console.error("[player-stats] kart kaydedilemedi:", error);
    return { ok: false, error: { code: "STORAGE_FAILED", message: "Oyuncu kartı kaydedilemedi — depolamaya ya da veritabanına yazılamadı." } };
  }
}
