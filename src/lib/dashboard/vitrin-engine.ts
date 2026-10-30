import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { competitionCardName } from "@/lib/names/competition-names";
import { deleteStoredUrl } from "@/lib/dashboard/draft-render";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { buildVitrinCaption } from "@/lib/dashboard/vitrin-caption";
import { warmTeamColors } from "@/lib/dashboard/team-colors";
import { buildVitrinCard, validSelection, type VitrinImages, type VitrinMeta } from "@/lib/dashboard/vitrin-card";
import { teamOrigin } from "@/lib/dashboard/team-origin";
import type { VitrinPhotos } from "@/lib/dashboard/vitrin-photo";
import { renderVitrinImages } from "@/lib/dashboard/vitrin-render";
import { internalSource } from "@/lib/prediction/internal-source";
import { kickoffGate } from "@/lib/prediction/kickoff";
import { auditReason, matchSides, ruleReason, vitrinFacts } from "@/lib/prediction/reasons";
import { SUPPORTED_LEAGUES } from "@/lib/services/api-football/leagues";
import { roundLabel } from "@/lib/services/api-football/weekly-mappers";
import type { ContentTypeId } from "@/types/content-type";
import type { DeepAnalysisStats } from "@/types/deep-analysis";
import type { MatchDayFormatId } from "@/types/match-day";
import type { PredictionSet, ScenarioId } from "@/types/prediction";
import type { Result } from "@/types/result";
import type { VitrinCard, VitrinSelection } from "@/types/vitrin";
import { BANNED_LANGUAGE, contentLanguageGate } from "@/lib/prediction/content-language";

/**
 * Maç önü vitrin kartının motoru (AI_MARKET_PREDICTION). Tahmin kaynaktan SUNUCUDA hesaplanır —
 * istemciden yalnızca gerekçeler ve kutu seçimi gelir; yüzdeler formdan alınmaz (tahmin kaydının
 * bütünlüğü). Gerekçeler her kayıt/önizlemede yeniden denetlenir; geçemeyen kartı kilitler.
 * Fal yok (arşiv fotoğrafı kart için zaten büyütülmüş gelir).
 */

/** `AiContent.format` — Maç Sonucu/İstatistik kayıtlarıyla aynı eşleme (`match-stats-engine.ts`). */
const DB_FORMAT: Record<MatchDayFormatId, string> = { IG_PORTRAIT: "IG_FEED", IG_SQUARE: "IG_SQUARE", STORY: "STORY", X_LANDSCAPE: "X_CARD" };

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });

export function vitrinMeta(stats: DeepAnalysisStats): VitrinMeta {
  const { fixture } = stats;
  const leagueId = SUPPORTED_LEAGUES.find((league) => league.id === fixture.competition.id)?.apiFootballId ?? Number(fixture.competition.id);
  return {
    sides: matchSides(stats),
    homeTeamId: Number(fixture.homeTeam.id),
    awayTeamId: Number(fixture.awayTeam.id),
    kickoffUtc: fixture.kickoffUtc,
    competitionName: competitionCardName(leagueId, fixture.competition.name),
    roundLabel: fixture.details?.round ? roundLabel(fixture.details.round) : "",
    homeForm: stats.home.form.last5,
    awayForm: stats.away.form.last5,
  };
}

export async function vitrinImages(stats: DeepAnalysisStats): Promise<VitrinImages> {
  const [homeLogo, awayLogo, brandLogo] = await Promise.all([resolveImage(stats.fixture.homeTeam.logoUrl, 300), resolveImage(stats.fixture.awayTeam.logoUrl, 300), loadBrandLogo()]);
  return { homeLogo, awayLogo, brandLogo };
}

/** Kaynaktan tahmin + kural tabanlı gerekçeler (AI yazmadan önceki başlangıç). */
export async function predictWithRuleReasons(stats: DeepAnalysisStats): Promise<Result<PredictionSet>> {
  const prediction = await internalSource.predict({ stats });
  if (!prediction.ok) return prediction;
  const facts = vitrinFacts(stats);
  const sides = matchSides(stats);
  return { ok: true, data: { ...prediction.data, scenarios: prediction.data.scenarios.map((scenario) => ({ ...scenario, reason: ruleReason(scenario, facts, sides) })) } };
}

/**
 * Sunucuda yeniden hesaplanan tahmine istemcinin gerekçelerini işler ve denetler. Açık kutuların
 * gerekçesi denetimden geçmezse kart kilitlenir (sebep yazılır). Kilitli kutuların gerekçesi kartta
 * görünmez; kayda girmez.
 */
export async function vitrinPrediction(stats: DeepAnalysisStats, reasons: Partial<Record<ScenarioId, string>>, selection: VitrinSelection): Promise<Result<PredictionSet>> {
  if (!validSelection(selection)) return fail("INVALID_SELECTION", "Kutular tekrarsız olmalı: 2 açık (1. kutu kazanma olasılıkları) + 3 kilitli.");
  const base = await predictWithRuleReasons(stats);
  if (!base.ok) return base;
  const facts = vitrinFacts(stats);
  const sides = matchSides(stats);
  const scenarios = base.data.scenarios.map((scenario) => ({ ...scenario, reason: (reasons[scenario.id] ?? scenario.reason).trim() }));
  const problems = selection.open.flatMap((id) => {
    const scenario = scenarios.find((entry) => entry.id === id);
    const issues = scenario ? auditReason(scenario.reason, scenario.outcome, facts, sides) : ["senaryo yok"];
    return issues.length ? [`${id}: ${issues.join(", ")}`] : [];
  });
  if (problems.length) return fail("REASON_AUDIT", `Gerekçe denetimi geçmedi — kart üretilmedi: ${problems.join(" · ")}`);
  return { ok: true, data: { ...base.data, scenarios } };
}

export interface VitrinRenderRequest {
  stats: DeepAnalysisStats;
  prediction: PredictionSet;
  selection: VitrinSelection;
  format: MatchDayFormatId;
  /**
   * Yalnızca offline tasarım aracı (`--allow-past`): başlamış maçı da çizer. Stüdyo ve kayıt bunu
   * vermez — kayıt yolu (`createVitrinDraft`) her zaman zaman kapısından geçer.
   */
  allowPast?: boolean;
  /** Posterin iki tarafı (ev sahibi solda, deplasman sağda). */
  photos: VitrinPhotos;
}

/** Carousel sayfa etiketleri (inceleme ve Yayın Merkezi). */
const SLIDE_LABELS = ["01 Poster", "02 Analiz"] as const;

export async function renderVitrin(request: VitrinRenderRequest): Promise<Result<{ pages: [Buffer, Buffer]; card: VitrinCard }>> {
  const late = request.allowPast ? null : kickoffGate(request.stats.fixture, new Date());
  if (late) return fail("MATCH_STARTED", late);
  const meta = vitrinMeta(request.stats);
  // Ad büyük harfi için takım kökeni (Türk takımı mı) — arşiv/API, yalnızca okuma.
  const [home, away] = await Promise.all([teamOrigin(meta.homeTeamId), teamOrigin(meta.awayTeamId)]);
  // Takım rengi ortak kaynaktan (tablo dışı takım: logodan otomatik) — kart kurulmadan önce.
  const { homeTeam, awayTeam } = request.stats.fixture;
  await warmTeamColors([{ id: meta.homeTeamId, name: homeTeam.name, logoUrl: homeTeam.logoUrl }, { id: meta.awayTeamId, name: awayTeam.name, logoUrl: awayTeam.logoUrl }]);
  const card = buildVitrinCard(request.prediction, request.selection, { ...meta, origins: { home, away } }, await vitrinImages(request.stats));
  const rendered = await renderVitrinImages({ card, frame: MATCH_DAY_FRAMES[request.format], photos: request.photos, seedKey: request.stats.fixture.id });
  return rendered.ok ? { ok: true, data: { pages: rendered.data, card } } : rendered;
}

/** Carousel'i çizer, kalıcı depoya yazar ve tek DRAFT açar (planlanmış placeholder'ı devralır). */
export async function createVitrinDraft(request: VitrinRenderRequest & { fixtureId: string; photoIds: { home: string | null; away: string | null } }): Promise<Result<{ id: string }>> {
  const rendered = await renderVitrin({ ...request, allowPast: false });
  if (!rendered.ok) return rendered;
  const caption = buildVitrinCaption(rendered.data.card);
  const language = contentLanguageGate({ card: rendered.data.card, caption });
  if (language) return fail(BANNED_LANGUAGE, `${language} — kart üretilmedi.`);

  const urls: string[] = [];
  try {
    for (const page of rendered.data.pages) urls.push(await saveStoredFile("renders", `${randomUUID()}.png`, page));
    const [imageUrl] = urls;
    const meta = vitrinMeta(request.stats);
    const record = await createScheduledContent({
      fixtureId: request.fixtureId,
      contentType: "AI_MARKET_PREDICTION" satisfies ContentTypeId,
      prompt: "",
      resultImageUrl: imageUrl ?? null,
      status: "DRAFT",
      format: DB_FORMAT[request.format],
      caption,
      renderOptions: JSON.parse(
        JSON.stringify({
          kind: "VITRIN",
          format: request.format,
          prediction: request.prediction,
          open: request.selection.open,
          locked: request.selection.locked,
          photoId: request.photoIds.home,
          awayPhotoId: request.photoIds.away,
          kickoffUtc: meta.kickoffUtc,
          imageUrl,
          carousel: urls.map((url, index) => ({ url, label: SLIDE_LABELS[index] ?? `${index + 1}` })),
          title: `${meta.sides.home} – ${meta.sides.away}`,
          subtitle: [meta.competitionName, meta.roundLabel].filter(Boolean).join(" · "),
        }),
      ) as Prisma.InputJsonObject,
    });
    return { ok: true, data: record };
  } catch (cause) {
    await Promise.all(urls.map((url) => deleteStoredUrl(url)));
    console.error("[vitrin] kaydedilemedi:", cause);
    return fail("STORAGE_FAILED", "Vitrin kartı kaydedilemedi — depolamaya ya da veritabanına yazılamadı.");
  }
}
