import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { warmTeamColors } from "@/lib/dashboard/team-colors";
import { buildDrawCard } from "@/lib/dashboard/draw-card";
import { drawFromApi, drawHeadToHead } from "@/lib/dashboard/draw-data";
import { renderDrawImages } from "@/lib/dashboard/draw-render";
import { deleteStoredUrl } from "@/lib/dashboard/draft-render";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { saveStoredFile } from "@/lib/dashboard/storage";
import { BANNED_LANGUAGE, contentLanguageGate } from "@/lib/prediction/content-language";
import { buildDrawCaption } from "@/lib/draw/caption";
import { compareWithApi } from "@/lib/draw/compare";
import { drawTeamName } from "@/lib/draw/entry";
import { drawRecordKey, drawRound, seasonText } from "@/lib/draw/rounds";
import type { DrawRequest } from "@/lib/draw/state-schema";
import type { ContentTypeId } from "@/types/content-type";
import type { DrawCard, DrawDifference, DrawState } from "@/types/draw";
import type { MatchDayFormatId } from "@/types/match-day";
import type { Result } from "@/types/result";

/**
 * Kura sonucu motoru (stüdyo): önizleme, DRAFT kayıt ve kura sonrası API karşılaştırması. Eşleşmeler elle
 * girilir (kura sırasında API'de yok); girilen durum kayıtta aynen saklanır (`renderOptions.states`), sonradan
 * API fikstürüyle karşılaştırılır — yalnızca uyarı, otomatik düzeltme YOK. Yayın manuel.
 */

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });

const DB_FORMAT: Record<MatchDayFormatId, string> = { IG_PORTRAIT: "IG_FEED", IG_SQUARE: "IG_SQUARE", STORY: "STORY", X_LANDSCAPE: "X_CARD" };
const SLIDE_LABELS = ["01 Kura", "02 Rakipler"] as const;

/** Logo önbelleği (süreç içi): kura sırasında her girişte önizleme çizilir, aynı logolar tekrar indirilmez. */
const logoCache = new Map<string, Promise<string | null>>();
const LOGO_CACHE_LIMIT = 400;
function logoOf(url: string | null): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  let cached = logoCache.get(url);
  if (!cached) {
    if (logoCache.size >= LOGO_CACHE_LIMIT) logoCache.clear();
    cached = resolveImage(url, 200);
    logoCache.set(url, cached);
  }
  return cached;
}

/** Kartta görünen takımların logoları (girilen eşleşmelerdeki takımlar). */
async function drawLogos(states: DrawState[]): Promise<Record<number, string | null>> {
  const ids = new Set<number>();
  for (const state of states) {
    state.ties.forEach((tie) => [tie.first, tie.second].forEach((id) => ids.add(id)));
    state.fixtures.forEach((f) => [f.teamId, f.opponentId].forEach((id) => ids.add(id)));
  }
  const teams = new Map(states.flatMap((state) => state.teams.map((team) => [team.id, team] as const)));
  const entries = await Promise.all([...ids].map(async (id) => [id, await logoOf(teams.get(id)?.logoUrl ?? null)] as const));
  return Object.fromEntries(entries);
}

/** A · eleme: odak takımın rakiple geçmişi (kura tarihinden önce); veri yoksa satır yok. */
async function headToHeadFor(request: DrawRequest) {
  const state = request.states[0];
  if (request.variant !== "TEAM" || !state || state.stage !== "KNOCKOUT" || !request.focusTeamId) return null;
  const tie = state.ties.find((t) => t.first === request.focusTeamId || t.second === request.focusTeamId);
  if (!tie) return null;
  const opponent = tie.first === request.focusTeamId ? tie.second : tie.first;
  return drawHeadToHead(request.focusTeamId, opponent, state.drawDateUtc ?? new Date().toISOString());
}

export interface DrawRendered {
  card: DrawCard;
  pages: Buffer[];
}

export async function renderDraw(request: DrawRequest, photo: UploadedImage | null): Promise<Result<DrawRendered>> {
  const states = request.variant === "TURKISH" ? request.states : request.states.slice(0, 1);
  const focus = states.flatMap((state) => state.teams).find((team) => team.id === request.focusTeamId);
  // Takım rengi ortak kaynaktan (tablo dışı odak takım: logodan otomatik).
  const [logos, headToHead, brandLogo] = await Promise.all([drawLogos(states), headToHeadFor(request), loadBrandLogo(), focus ? warmTeamColors([{ id: focus.id, name: focus.apiName, logoUrl: focus.logoUrl }]) : null]);
  const card = buildDrawCard({ variant: request.variant, states, focusTeamId: request.focusTeamId, logos, headToHead, brandLogo });
  if (!card.ok) return card;
  const pages = await renderDrawImages({ card: card.data, frame: MATCH_DAY_FRAMES[request.format], photo, seedKey: drawRecordKey(states[0]!.competition.id, states[0]!.season, request.roundIds[0] ?? "") });
  return pages.ok ? { ok: true, data: { card: card.data, pages: pages.data } } : pages;
}

/** Kayıt başlığı (inceleme ekranı, İçerik Planı). */
function drawTitle(request: DrawRequest): { title: string; subtitle: string } {
  const first = request.states[0]!;
  const subtitle = request.variant === "TURKISH" && request.states.length > 1 ? `${seasonText(first.season)} Avrupa kupaları` : `${first.competition.name} · ${first.roundLabel}`;
  if (request.variant === "TEAM" && request.focusTeamId) return { title: `${drawTeamName(first, request.focusTeamId)} · Kura`, subtitle };
  return { title: request.variant === "TURKISH" ? "Temsilcilerimiz · Kura" : `${first.roundLabel} eşleşmeleri`, subtitle };
}

/** Kartı çizer, kalıcı depoya yazar ve tek DRAFT açar; girilen eşleşmeler kayıtta saklanır. */
export async function createDrawDraft(request: DrawRequest, photo: { image: UploadedImage; photoId: string } | null): Promise<Result<{ id: string }>> {
  const rendered = await renderDraw(request, photo?.image ?? null);
  if (!rendered.ok) return rendered;
  const caption = buildDrawCaption(request.variant, request.variant === "TURKISH" ? request.states : request.states.slice(0, 1), request.focusTeamId);
  const language = contentLanguageGate({ card: rendered.data.card, caption });
  if (language) return fail(BANNED_LANGUAGE, `${language} — kart üretilmedi.`);

  const urls: string[] = [];
  try {
    for (const page of rendered.data.pages) urls.push(await saveStoredFile("renders", `${randomUUID()}.png`, page));
    const [imageUrl] = urls;
    const first = request.states[0]!;
    const record = await createScheduledContent({
      fixtureId: drawRecordKey(first.competition.id, first.season, request.roundIds[0] ?? ""),
      contentType: "DRAWS_AND_PAIRINGS" satisfies ContentTypeId,
      prompt: "",
      resultImageUrl: imageUrl ?? null,
      status: "DRAFT",
      format: DB_FORMAT[request.format],
      caption,
      renderOptions: JSON.parse(
        JSON.stringify({
          kind: "DRAW",
          ...request,
          photoId: photo?.photoId ?? null,
          imageUrl,
          carousel: urls.length > 1 ? urls.map((url, index) => ({ url, label: SLIDE_LABELS[index] ?? `${index + 1}` })) : undefined,
          ...drawTitle(request),
        }),
      ) as Prisma.InputJsonObject,
    });
    return { ok: true, data: record };
  } catch (cause) {
    await Promise.all(urls.map((url) => deleteStoredUrl(url)));
    console.error("[draw] kaydedilemedi:", cause);
    return fail("STORAGE_FAILED", "Kura kartı kaydedilemedi — depolamaya ya da veritabanına yazılamadı.");
  }
}

export interface DrawComparison {
  label: string;
  /** API'de bu turun fikstürü henüz yoksa true (fark listesi boş). */
  pending: boolean;
  differences: DrawDifference[];
}

/** Kura sonrası: her kura API fikstürüyle karşılaştırılır. Yalnızca uyarı — durum değiştirilmez. */
export async function compareDraws(states: DrawState[], roundIds: string[]): Promise<Result<DrawComparison[]>> {
  const out: DrawComparison[] = [];
  for (const [index, state] of states.entries()) {
    const round = drawRound(roundIds[index] ?? "");
    const label = `${state.competition.name} · ${state.roundLabel}`;
    if (!round) return fail("INVALID_ROUND", `Tur bilinmiyor: ${state.roundLabel}`);
    const api = await drawFromApi({ competitionId: state.competition.id, season: state.season, stage: round.stage, roundLabel: round.label, round: round.apiRound });
    if (!api.ok) {
      if (api.error.code === "NO_FIXTURES") out.push({ label, pending: true, differences: [] });
      else return api;
      continue;
    }
    out.push({ label, pending: false, differences: compareWithApi(state, api.data) });
  }
  return { ok: true, data: out };
}
