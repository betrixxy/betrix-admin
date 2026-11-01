import type { TeamOrigin } from "@/lib/dashboard/name-case";
import { fixtureOrigins } from "@/lib/dashboard/team-origin";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { deleteStoredUrl } from "@/lib/dashboard/draft-render";
import { cardTemplateStyle } from "@/lib/dashboard/lineup-draft";
import { resolveLineupHeroPhoto, type LineupHero } from "@/lib/dashboard/lineup-hero-photo";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { renderLineupCard, type RenderedLineupCard } from "@/lib/dashboard/lineup-render";
import { buildLineupCaption } from "@/lib/dashboard/lineup-caption";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { BANNED_LANGUAGE, contentLanguageGate } from "@/lib/prediction/content-language";
import type { ContentTypeId } from "@/types/content-type";
import type { LineupDraft, TeamLineupDraft } from "@/types/lineup";
import type { Result } from "@/types/result";
import { SOCIAL_FORMATS } from "@/types/studio-formats";

export interface LineupSaved {
  id: string;
}

function toJsonValue(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;
}

/**
 * İki takımın Muhtemel 11 kartını çizer, kalıcı depoya yazar ve tek `AiContent`
 * (contentType = PROBABLE_LINEUPS, DRAFT) açar — takvimde bu maç için planlanmış placeholder varsa
 * onun üzerine yazılır (bkz. content-schedule.ts). Ana görsel ev sahibi kartıdır; iki kartın adresi
 * ve formun tamamı `renderOptions`'ta saklanır (kapak: arşiv fotoğrafının kimliği + elle ayar). Fal.ai yok — ücretsiz.
 */
export async function createLineupDraft(input: LineupDraft): Promise<Result<LineupSaved>> {
  let draft = input;
  // Ad büyük harfi için takım kökenleri (maçtan, bkz. team-origin.ts).
  // Bahis dili kapısı: kart metinleri (başlık, künye, adlar) + gönderi metni, çizimden önce.
  const language = contentLanguageGate({ card: draft, caption: buildLineupCaption(draft) });
  if (language) return { ok: false, error: { code: BANNED_LANGUAGE, message: `${language} — kart üretilmedi.` } };
  const origins = await fixtureOrigins(draft.fixtureId);
  // Her kart kendi şablonuyla: kapağı olan takım liste, olmayan taktik tahtası (bkz. cardTemplateStyle).
  // Kapak fotoğrafları (Kahraman Liste): arşivden, o tarafın takımına + formasına ait olduğu doğrulanır.
  const [homeHero, awayHero] = await Promise.all([
    resolveLineupHeroPhoto(draft.fixtureId, "home", draft.home, draft.templateStyle),
    resolveLineupHeroPhoto(draft.fixtureId, "away", draft.away, draft.templateStyle),
  ]);
  if (!homeHero.ok) return homeHero;
  if (!awayHero.ok) return awayHero;
  // Kapak 11 kuralıyla değiştiyse (11 dışı seçim → 11'den oyuncu / yedek tasarım) kayda gerçekte kullanılan yazılır.
  const used = (team: TeamLineupDraft, hero: LineupHero): TeamLineupDraft =>
    draft.templateStyle !== "hero_list" || hero.photoId === team.heroPhotoId ? team : { ...team, heroPhotoId: hero.photoId, heroAdjust: null };
  draft = { ...draft, home: used(draft.home, homeHero.data), away: used(draft.away, awayHero.data) };
  const card = (team: TeamLineupDraft, opponent: TeamLineupDraft, heroPhoto: UploadedImage | null, sides?: { team: TeamOrigin; opponent: TeamOrigin }) =>
    renderLineupCard({
      heroPhoto,
      templateStyle: cardTemplateStyle(draft.templateStyle, team),
      team,
      opponentName: opponent.teamName,
      opponentLogoUrl: opponent.logoUrl,
      headline: draft.headline,
      matchLabel: draft.matchLabel,
      format: draft.format,
      ...(sides ? { origins: sides } : {}),
    });

  let home: RenderedLineupCard;
  let away: RenderedLineupCard;
  try {
    const [homeCard, awayCard] = await Promise.all([
      card(draft.home, draft.away, homeHero.data.image, origins && { team: origins.home, opponent: origins.away }),
      card(draft.away, draft.home, awayHero.data.image, origins && { team: origins.away, opponent: origins.home }),
    ]);
    // Yerleşim kapısına takılan kart üretilmez; sebep stüdyoda gösterilir.
    if (!homeCard.ok) return homeCard;
    if (!awayCard.ok) return awayCard;
    [home, away] = [homeCard.data, awayCard.data];
  } catch (cause) {
    console.error("[lineup] kartlar çizilemedi:", cause);
    return { ok: false, error: { code: "RENDER_FAILED", message: "Kadro kartları çizilemedi.", cause } };
  }

  const saved: string[] = [];
  try {
    const homeImageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, home.png);
    saved.push(homeImageUrl);
    const awayImageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, away.png);
    saved.push(awayImageUrl);

    const record = await createScheduledContent({
      fixtureId: draft.fixtureId,
      contentType: "PROBABLE_LINEUPS" satisfies ContentTypeId,
      prompt: "",
      resultImageUrl: homeImageUrl,
      status: "DRAFT",
      format: SOCIAL_FORMATS[draft.format].dbFormat,
      caption: buildLineupCaption(draft),
      // `templateStyle` admin'in seçimi; kartların gerçekte çizildiği şablon ayrıca saklanır.
      renderOptions: toJsonValue({ kind: "PROBABLE_LINEUPS", homeImageUrl, awayImageUrl, cardStyles: { home: home.templateStyle, away: away.templateStyle }, ...draft }),
    });
    return { ok: true, data: { id: record.id } };
  } catch (cause) {
    // Kayıt açılamadıysa yazılan dosyalar yetim kalmasın (bkz. CLAUDE.md 1.10 kural 3).
    await Promise.all(saved.map((url) => deleteStoredUrl(url)));
    console.error("[lineup] kaydedilemedi:", cause);
    return { ok: false, error: { code: "STORAGE_FAILED", message: "Kadro kaydedilemedi — depolamaya ya da veritabanına yazılamadı.", cause } };
  }
}
