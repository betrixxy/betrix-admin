import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { PLAYER_STATS_FORMATS } from "@/lib/dashboard/player-stats-engine";
import { buildMatchScorecardCaption, buildPeriodScorecardCaption } from "@/lib/dashboard/prediction-scorecard-caption";
import { buildMatchScorecardCard, buildPeriodScorecardCard } from "@/lib/dashboard/prediction-scorecard-card";
import { loadFixtureRecords, loadPeriodEntries } from "@/lib/dashboard/prediction-scorecard-data";
import { renderScorecardImage } from "@/lib/dashboard/prediction-scorecard-render";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { withTeamOrigins } from "@/lib/dashboard/team-origin";
import { reportJobStep } from "@/lib/jobs/studio-jobs";
import { BANNED_LANGUAGE, contentLanguageGate } from "@/lib/prediction/content-language";
import { buildPeriodScorecard } from "@/lib/prediction/scorecard";
import { matchScorecardFromRecords } from "@/lib/prediction/scorecard-studio";
import { periodFor } from "@/lib/prediction/scorecard-period";
import { parseFixtureId } from "@/lib/services/api-football";
import { getScorecardMatch } from "@/lib/services/api-football/fixture-score";
import type { ContentTypeId } from "@/types/content-type";
import type { MatchDayFormatId } from "@/types/match-day";
import type { PeriodScorecardRequest, PostMatchCardResult } from "@/types/post-match-cards";
import type { MatchScorecardData, ScorecardMatch } from "@/types/prediction-scorecard";
import type { Result } from "@/types/result";

/**
 * Tahmin Karnesi üretimi → DRAFT `AiContent` (`PREDICTION_SCORECARD`). Yarı otomatik (admin tıklaması, arka plan işi);
 * Fal ve yapay zekâ yok. A (maç): kayıtlar + son sonuçlar — kart yalnızca bütün sayılan kayıtların sonucu YAZILMIŞ ve
 * güncel skorla aynıysa üretilir (önce "Sonuçları hesapla"); karneye giren her satır veritabanındaki sonuçla aynıdır.
 * B (dönem): yazılmış sonuçlardan. Kart + gönderi metni bahis dili kapısından (`contentLanguageGate`).
 */

type EngineError = { code: string; message: string };
const fail = (code: string, message: string): { ok: false; error: EngineError } => ({ ok: false, error: { code, message } });
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;

/** Dönem karnesi bir maça bağlı değildir. */
export const MANUAL_SCORECARD_FIXTURE_ID = "manual:prediction-scorecard";

/** Karnenin maçı: skor + kart adları (kupada takım kökeni sonradan doldurulur). */
export async function loadScorecardMatch(fixtureId: string): Promise<Result<ScorecardMatch, EngineError>> {
  const apiId = parseFixtureId(fixtureId);
  if (apiId === null) return fail("INVALID_FIXTURE", "Geçersiz maç kimliği.");
  const match = await getScorecardMatch(apiId);
  if (!match.ok) return fail(match.error.code, `Maç skoru alınamadı: ${match.error.message}`);
  if (!match.data) return fail("NOT_FOUND", "Maç bulunamadı.");
  return { ok: true, data: await withTeamOrigins(match.data) };
}

export interface ScorecardPageInput {
  fixtureId: string;
  format: MatchDayFormatId;
  /** Carousel'de 01 Maç Sonucu nihai görseli (bulanık zemin). */
  resultImage: Buffer | null;
  /** Set sayfa etiketi ("06 · TAHMİN KARNESİ"); tek başına "MAÇ KARNESİ". */
  kicker?: string;
}

/** A kartının çizimi (tek başına ve Maç Sonucu seti ortak). */
export async function renderMatchScorecardPage(input: ScorecardPageInput): Promise<Result<{ image: Buffer; match: ScorecardMatch; data: MatchScorecardData }, EngineError>> {
  reportJobStep("Maç skoru ve tahmin kayıtları");
  const match = await loadScorecardMatch(input.fixtureId);
  if (!match.ok) return match;
  const data = matchScorecardFromRecords(match.data, await loadFixtureRecords(input.fixtureId));
  if (!data.ok) return data;
  reportJobStep("Tahmin Karnesi çiziliyor");
  const card = buildMatchScorecardCard({ match: match.data, data: data.data, brandLogo: await loadBrandLogo(), ...(input.kicker ? { kicker: input.kicker } : {}) });
  const image = await renderScorecardImage({ card, frame: MATCH_DAY_FRAMES[input.format], resultImage: input.resultImage, seedKey: `karne-${input.fixtureId}` });
  return image.ok ? { ok: true, data: { image: image.data, match: match.data, data: data.data } } : image;
}

async function saveDraft(input: { fixtureId: string; format: MatchDayFormatId; image: Buffer; caption: string; title: string; subtitle: string; snapshot: unknown; options: Record<string, unknown> }): Promise<Result<PostMatchCardResult, EngineError>> {
  const language = contentLanguageGate({ caption: input.caption });
  if (language) return fail(BANNED_LANGUAGE, `${language} — kart üretilmedi.`);
  reportJobStep("Kaydediliyor");
  try {
    const imageUrl = await saveStoredFile("renders", `${randomUUID()}.png`, input.image);
    const format = PLAYER_STATS_FORMATS[input.format];
    const record = await createScheduledContent({
      fixtureId: input.fixtureId,
      contentType: "PREDICTION_SCORECARD" satisfies ContentTypeId,
      prompt: "",
      backgroundImageUrl: null,
      resultImageUrl: imageUrl,
      playerImageUrl: null,
      status: "DRAFT",
      format: format.db,
      caption: input.caption,
      statsSnapshot: asJson(input.snapshot),
      renderOptions: asJson({ kind: "PREDICTION_SCORECARD", format: format.social, frameFormat: input.format, imageUrl, title: input.title, subtitle: input.subtitle, ...input.options }),
    });
    return { ok: true, data: { id: record.id, format: input.format, slides: [{ url: imageUrl, label: "Tahmin Karnesi" }], notes: [] } };
  } catch (error: unknown) {
    console.error("[karne] kart kaydedilemedi:", error);
    return fail("STORAGE_FAILED", "Tahmin Karnesi kaydedilemedi — depolamaya ya da veritabanına yazılamadı.");
  }
}

const duplicateNote = (count: number) => (count > 0 ? [`${count} tekrar onay sayılmadı (aynı maç + senaryo için yalnızca ilk onay karneye girer; kayıt silinmez).`] : []);

export async function createMatchScorecardDraft(input: { fixtureId: string; format: MatchDayFormatId }): Promise<Result<PostMatchCardResult, EngineError>> {
  const page = await renderMatchScorecardPage({ ...input, resultImage: null });
  if (!page.ok) return page;
  const { match, data } = page.data;
  const saved = await saveDraft({
    fixtureId: input.fixtureId,
    format: input.format,
    image: page.data.image,
    caption: buildMatchScorecardCaption(match, data),
    title: `Tahmin Karnesi · ${match.home.name} – ${match.away.name}`,
    subtitle: `${match.competition.name} · ${match.roundLabel}`,
    snapshot: { match, data },
    options: { scope: "MATCH", records: data.rows.map((row) => row.recordId), duplicates: data.duplicates },
  });
  return saved.ok ? { ok: true, data: { ...saved.data, notes: duplicateNote(data.duplicates) } } : saved;
}

export async function createPeriodScorecardDraft(input: PeriodScorecardRequest): Promise<Result<PostMatchCardResult, EngineError>> {
  const period = periodFor(input.kind, new Date(`${input.day}T12:00:00+03:00`));
  reportJobStep("Dönemin tahmin kayıtları");
  const built = buildPeriodScorecard({ period, entries: await loadPeriodEntries(period), splitByModelVersion: input.splitByModelVersion });
  if (!built.ok) return built;
  reportJobStep("Tahmin Karnesi çiziliyor");
  const card = buildPeriodScorecardCard({ data: built.data, brandLogo: await loadBrandLogo() });
  const image = await renderScorecardImage({ card, frame: MATCH_DAY_FRAMES[input.format], resultImage: null, seedKey: `karne-${period.kind}-${period.start}` });
  if (!image.ok) return image;
  const saved = await saveDraft({
    fixtureId: MANUAL_SCORECARD_FIXTURE_ID,
    format: input.format,
    image: image.data,
    caption: buildPeriodScorecardCaption(built.data),
    title: `Tahmin Karnesi · ${period.label}`,
    subtitle: [built.data.summary.text, built.data.pending > 0 ? `${built.data.pending} bekleyen` : null].filter(Boolean).join(" · "),
    snapshot: built.data,
    options: { scope: "PERIOD", period, splitByModelVersion: input.splitByModelVersion, duplicates: built.data.duplicates },
  });
  return saved.ok ? { ok: true, data: { ...saved.data, notes: duplicateNote(built.data.duplicates) } } : saved;
}
