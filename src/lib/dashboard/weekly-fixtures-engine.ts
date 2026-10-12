import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { deleteStoredUrl } from "@/lib/dashboard/draft-render";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { weeklyCaption, weeklyGrouping, weeklyLayout, weeklyPlan } from "@/lib/dashboard/weekly-fixtures-layout";
import { renderWeeklyFixturesCard } from "@/lib/dashboard/weekly-fixtures-render";
import { getSupportedLeague } from "@/lib/services/api-football/leagues";
import { getWeeklyRoundMatches, getWeeklyRounds } from "@/lib/services/api-football/weekly-fixtures";
import type { ContentTypeId } from "@/types/content-type";
import type { Result } from "@/types/result";
import { SOCIAL_FORMATS } from "@/types/studio-formats";
import { WEEKLY_MAX_MATCHES, type WeeklyFixturesCardInput, type WeeklyFixturesDraft } from "@/types/weekly-fixtures";

/**
 * "Haftanın Maçları" motoru. Form yalnızca lig/sezon/tur, başlık ve maç seçimi + sırasını taşır;
 * skor/saat/logo her çizimde API-Football'dan yeniden okunur (formdan gelen skor kartla basılmaz).
 */

export async function resolveWeeklyCard(draft: WeeklyFixturesDraft): Promise<Result<WeeklyFixturesCardInput>> {
  const league = getSupportedLeague(draft.leagueId);
  const rounds = await getWeeklyRounds(league.apiFootballId, draft.season);
  if (!rounds.ok) return { ok: false, error: { code: rounds.error.code, message: rounds.error.message } };
  const option = rounds.data.options.find((candidate) => candidate.key === draft.roundKey);
  if (!option) return { ok: false, error: { code: "INVALID_INPUT", message: "Seçilen tur bu sezonda yok." } };

  const round = await getWeeklyRoundMatches(league.apiFootballId, draft.season, option);
  if (!round.ok) return { ok: false, error: { code: round.error.code, message: round.error.message } };
  const byId = new Map(round.data.matches.map((match) => [match.id, match]));
  const matches = draft.matchIds.map((id) => byId.get(id)).filter((match) => match !== undefined);
  if (matches.length !== draft.matchIds.length) return { ok: false, error: { code: "INVALID_INPUT", message: "Seçilen maçlardan bazıları bu turda yok — listeyi yenileyin." } };
  if (matches.length === 0) return { ok: false, error: { code: "INVALID_INPUT", message: "Karta en az bir maç ekleyin." } };
  if (matches.length > WEEKLY_MAX_MATCHES) return { ok: false, error: { code: "INVALID_INPUT", message: `Bir kart en fazla ${WEEKLY_MAX_MATCHES} maç taşır — kalanlar için ikinci kart üretin.` } };

  const grouping = weeklyGrouping(matches);
  if (weeklyPlan(matches, grouping, weeklyLayout(draft.format)) === null) {
    return { ok: false, error: { code: "INVALID_INPUT", message: `Maçlar ${SOCIAL_FORMATS[draft.format].label} formatına sığmıyor — birkaç maçı çıkarıp ikinci kart üretin.` } };
  }
  return { ok: true, data: { leagueId: draft.leagueId, leagueName: league.name, leagueLogoUrl: round.data.leagueLogoUrl, title: draft.title, grouping, matches, format: draft.format } };
}

function toJsonValue(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

/**
 * Kartı çizer, kalıcı depoya yazar ve tek DRAFT `AiContent` (WEEKLY_FIXTURES) açar. Kayıt bir maça
 * bağlanır (Takvim/Maç Merkezi maç bazlıdır): stüdyo bir maçtan açıldıysa o maç kartta olduğu sürece
 * ona, değilse kartın ilk maçına. Maçların üretim anındaki hali `renderOptions`'ta saklanır.
 */
export async function createWeeklyFixturesDraft(draft: WeeklyFixturesDraft, anchorFixtureId: string | null): Promise<Result<{ id: string }>> {
  const card = await resolveWeeklyCard(draft);
  if (!card.ok) return card;

  let png: Buffer;
  try {
    png = await renderWeeklyFixturesCard(card.data);
  } catch (cause) {
    console.error("[weekly-fixtures] kart çizilemedi:", cause);
    return { ok: false, error: { code: "RENDER_FAILED", message: "Kart çizilemedi.", cause } };
  }

  let imageUrl: string | null = null;
  try {
    imageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, png);
    const fixtureId = anchorFixtureId && draft.matchIds.includes(anchorFixtureId) ? anchorFixtureId : (draft.matchIds[0] ?? "");
    const record = await createScheduledContent({
      fixtureId,
      contentType: "WEEKLY_FIXTURES" satisfies ContentTypeId,
      prompt: "",
      resultImageUrl: imageUrl,
      status: "DRAFT",
      format: SOCIAL_FORMATS[draft.format].dbFormat,
      caption: weeklyCaption(card.data.leagueName, draft.title, card.data.matches, card.data.grouping),
      renderOptions: toJsonValue({ kind: "WEEKLY_FIXTURES", imageUrl, leagueName: card.data.leagueName, ...draft, matches: card.data.matches }),
    });
    return { ok: true, data: { id: record.id } };
  } catch (cause) {
    // Kayıt açılamadıysa yazılan dosya yetim kalmasın (bkz. CLAUDE.md 1.10 kural 3).
    if (imageUrl) await deleteStoredUrl(imageUrl);
    console.error("[weekly-fixtures] kaydedilemedi:", cause);
    return { ok: false, error: { code: "STORAGE_FAILED", message: "Kart kaydedilemedi — depolamaya ya da veritabanına yazılamadı.", cause } };
  }
}
