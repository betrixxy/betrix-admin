import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { deleteStoredUrl } from "@/lib/dashboard/draft-render";
import { renderLineupCard } from "@/lib/dashboard/lineup-render";
import { saveStoredFile } from "@/lib/dashboard/storage";
import type { ContentTypeId } from "@/types/content-type";
import type { LineupDraft, TeamLineupDraft } from "@/types/lineup";
import type { Result } from "@/types/result";

export interface LineupSaved {
  id: string;
}

function toJsonValue(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

function teamLine(team: TeamLineupDraft): string {
  return `${team.teamName} (${team.formation}): ${team.slots.map((slot) => slot.name.trim()).join(", ")}`;
}

function buildCaption(draft: LineupDraft): string {
  return [`${draft.headline} | ${draft.home.teamName} - ${draft.away.teamName}`, "", teamLine(draft.home), "", teamLine(draft.away)].join("\n");
}

/**
 * İki takımın Muhtemel 11 kartını çizer, kalıcı depoya yazar ve tek `AiContent`
 * (contentType = PROBABLE_LINEUPS, DRAFT) açar — takvimde bu maç için planlanmış placeholder varsa
 * onun üzerine yazılır (bkz. content-schedule.ts). Ana görsel ev sahibi kartıdır; iki kartın adresi
 * ve formun tamamı `renderOptions`'ta saklanır. Fal.ai yok — ücretsiz.
 */
export async function createLineupDraft(draft: LineupDraft): Promise<Result<LineupSaved>> {
  const card = (team: TeamLineupDraft, opponentName: string) =>
    renderLineupCard({ team, opponentName, headline: draft.headline, matchLabel: draft.matchLabel });

  let homePng: Buffer;
  let awayPng: Buffer;
  try {
    [homePng, awayPng] = await Promise.all([card(draft.home, draft.away.teamName), card(draft.away, draft.home.teamName)]);
  } catch (cause) {
    console.error("[lineup] kartlar çizilemedi:", cause);
    return { ok: false, error: { code: "RENDER_FAILED", message: "Kadro kartları çizilemedi.", cause } };
  }

  const saved: string[] = [];
  try {
    const homeImageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, homePng);
    saved.push(homeImageUrl);
    const awayImageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, awayPng);
    saved.push(awayImageUrl);

    const record = await createScheduledContent({
      fixtureId: draft.fixtureId,
      contentType: "PROBABLE_LINEUPS" satisfies ContentTypeId,
      prompt: "",
      resultImageUrl: homeImageUrl,
      status: "DRAFT",
      format: "IG_FEED",
      caption: buildCaption(draft),
      renderOptions: toJsonValue({ kind: "PROBABLE_LINEUPS", homeImageUrl, awayImageUrl, ...draft }),
    });
    return { ok: true, data: { id: record.id } };
  } catch (cause) {
    // Kayıt açılamadıysa yazılan dosyalar yetim kalmasın (bkz. CLAUDE.md 1.10 kural 3).
    await Promise.all(saved.map((url) => deleteStoredUrl(url)));
    console.error("[lineup] kaydedilemedi:", cause);
    return { ok: false, error: { code: "STORAGE_FAILED", message: "Kadro kaydedilemedi — depolamaya ya da veritabanına yazılamadı.", cause } };
  }
}
