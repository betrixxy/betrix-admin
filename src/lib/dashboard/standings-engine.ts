import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { deleteStoredUrl } from "@/lib/dashboard/draft-render";
import { seasonLabel, selectSections, standingsCaption, standingsCapacity, standingsKindLabel, standingsLayout, standingsPlan } from "@/lib/dashboard/standings-layout";
import { renderStandingsCard } from "@/lib/dashboard/standings-render";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { getSupportedLeague } from "@/lib/services/api-football/leagues";
import { getStandings } from "@/lib/services/api-football/standings";
import type { ContentTypeId } from "@/types/content-type";
import type { Result } from "@/types/result";
import type { StandingsCardInput, StandingsDraft } from "@/types/standings";
import { SOCIAL_FORMATS } from "@/types/studio-formats";

/**
 * "Puan Durumu" motoru. Form yalnızca lig/sezon/grup/sıra aralığı, başlık ve formatı taşır; tablo her
 * çizimde API-Football'dan yeniden okunur (formdan gelen puan karta basılmaz).
 */

/** Maçtan açılmadan üretilen kartın `AiContent.fixtureId` yer tutucusu — gerçek maç kimliği değildir. */
export const MANUAL_STANDINGS_FIXTURE_ID = "manual:standings";

export async function resolveStandingsCard(draft: StandingsDraft): Promise<Result<StandingsCardInput>> {
  const league = getSupportedLeague(draft.leagueId);
  const table = await getStandings(league.apiFootballId, draft.season);
  if (!table.ok) return { ok: false, error: { code: table.error.code, message: table.error.message } };
  const sections = selectSections(table.data.groups, draft);
  if (!sections.ok) return sections;
  if (standingsPlan(sections.data, standingsLayout(draft.format)) === null) {
    const format = SOCIAL_FORMATS[draft.format];
    return {
      ok: false,
      error: { code: "INVALID_INPUT", message: `Tablo ${format.label} formatına sığmıyor — en fazla ${standingsCapacity(draft.format)} takım; sıra aralığını daraltın, kartı bölün ya da yatay formatı seçin.` },
    };
  }
  return {
    ok: true,
    data: {
      leagueId: draft.leagueId,
      leagueName: league.name,
      leagueLogoUrl: table.data.leagueLogoUrl,
      season: draft.season,
      title: draft.title,
      kindLabel: standingsKindLabel(draft.leagueId, sections.data),
      sections: sections.data,
      format: draft.format,
    },
  };
}

function toJsonValue(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

/**
 * Kartı çizer, kalıcı depoya yazar ve tek DRAFT `AiContent` (STANDINGS) açar. Stüdyo bir maçtan açıldıysa
 * kayıt o maça bağlanır (Takvim/Maç Merkezi maç bazlıdır), değilse yer tutucuya. Tablonun üretim anındaki
 * hali `renderOptions`'ta saklanır.
 */
export async function createStandingsDraft(draft: StandingsDraft, anchorFixtureId: string | null): Promise<Result<{ id: string }>> {
  const card = await resolveStandingsCard(draft);
  if (!card.ok) return card;

  let png: Buffer;
  try {
    png = await renderStandingsCard(card.data);
  } catch (cause) {
    console.error("[standings] kart çizilemedi:", cause);
    return { ok: false, error: { code: "RENDER_FAILED", message: "Kart çizilemedi.", cause } };
  }

  let imageUrl: string | null = null;
  try {
    imageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, png);
    const record = await createScheduledContent({
      fixtureId: anchorFixtureId ?? MANUAL_STANDINGS_FIXTURE_ID,
      contentType: "STANDINGS" satisfies ContentTypeId,
      prompt: "",
      resultImageUrl: imageUrl,
      status: "DRAFT",
      format: SOCIAL_FORMATS[draft.format].dbFormat,
      caption: standingsCaption(card.data.leagueName, seasonLabel(draft.season), draft.title, card.data.sections),
      renderOptions: toJsonValue({ kind: "STANDINGS", imageUrl, leagueName: card.data.leagueName, kindLabel: card.data.kindLabel, ...draft, sections: card.data.sections }),
    });
    return { ok: true, data: { id: record.id } };
  } catch (cause) {
    // Kayıt açılamadıysa yazılan dosya yetim kalmasın (bkz. CLAUDE.md 1.10 kural 3).
    if (imageUrl) await deleteStoredUrl(imageUrl);
    console.error("[standings] kaydedilemedi:", cause);
    return { ok: false, error: { code: "STORAGE_FAILED", message: "Kart kaydedilemedi — depolamaya ya da veritabanına yazılamadı.", cause } };
  }
}
