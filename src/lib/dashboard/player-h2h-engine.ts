import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { displayPersonName } from "@/lib/archive/names";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { deleteStoredUrl } from "@/lib/dashboard/draft-render";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { teamNameTr } from "@/lib/dashboard/match-result-labels";
import { buildH2HCaption } from "@/lib/dashboard/player-h2h-caption";
import { buildH2HCard, h2hColors, type H2HCardResult } from "@/lib/dashboard/player-h2h-card";
import { loadPlayerSeasonStats } from "@/lib/dashboard/player-h2h-data";
import { facePortrait, type PortraitAdjust } from "@/lib/dashboard/player-h2h-photo";
import { renderH2HImages } from "@/lib/dashboard/player-h2h-render";
import { resolveH2HPhoto } from "@/lib/dashboard/player-h2h-studio";
import { saveStoredFile } from "@/lib/dashboard/storage";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import type { CropAdjust } from "@/lib/dashboard/vitrin-photo";
import { defaultMode } from "@/lib/player-h2h/stats";
import { bannedWordsGate } from "@/lib/prediction/banned-words";
import { prisma } from "@/lib/prisma";
import type { ContentTypeId } from "@/types/content-type";
import type { MatchDayFormatId } from "@/types/match-day";
import type { H2HMode, H2HScope, PlayerSeasonStats } from "@/types/player-h2h";
import type { Result } from "@/types/result";

/**
 * Oyuncu karşılaştırma kartının motoru (PLAYER_H2H). Veri her önizleme/kayıtta SUNUCUDA yeniden okunur
 * (istemciden yalnızca oyuncu, kapsam, adalet, fotoğraf ve kırpma ayarı gelir). Maçtan başlandıysa kayıt
 * o maça bağlanır (İçerik Planı ilerlemesi); serbest modda `manual:player-h2h`. Fal yok (arşiv fotoğrafı
 * kart için büyütülmüş gelir). Kayıt DRAFT; yayın manuel.
 */

export const MANUAL_H2H_FIXTURE_ID = "manual:player-h2h";
const DB_FORMAT: Record<MatchDayFormatId, string> = { IG_PORTRAIT: "IG_FEED", IG_SQUARE: "IG_SQUARE", STORY: "STORY", X_LANDSCAPE: "X_CARD" };
const SLIDE_LABELS = ["01 Poster", "02 İstatistikler"] as const;

export interface H2HSideRequest {
  playerId: number;
  teamId: number;
  photoId: string | null;
  posterAdjust?: CropAdjust | undefined;
  portraitAdjust?: PortraitAdjust | undefined;
}

export interface H2HMatch {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string;
}

export interface H2HRequest {
  left: H2HSideRequest;
  right: H2HSideRequest;
  scope: H2HScope;
  /** null → varsayılan (dakika farkı %25'i aşarsa 90 dk). */
  mode: H2HMode | null;
  format: MatchDayFormatId;
  match: H2HMatch | null;
}

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });

/** Arşivin resmi adı (admin düzeltmesi dahil) — kart ve olgu satırı bu adı kullanır. */
async function archiveName(playerId: number): Promise<string | null> {
  const person = await prisma.person.findFirst({ where: { apiId: playerId, role: "PLAYER" }, select: { officialName: true, nameOverride: true } });
  return person ? displayPersonName(person) : null;
}

export async function loadH2HPlayers(left: Pick<H2HSideRequest, "playerId" | "teamId">, right: Pick<H2HSideRequest, "playerId" | "teamId">, scope: H2HScope): Promise<Result<[PlayerSeasonStats, PlayerSeasonStats]>> {
  if (left.playerId === right.playerId) return fail("SAME_PLAYER", "Aynı oyuncu iki kez seçildi.");
  const [leftName, rightName] = await Promise.all([archiveName(left.playerId), archiveName(right.playerId)]);
  const [a, b] = await Promise.all([loadPlayerSeasonStats({ ...left, scope, fullName: leftName }), loadPlayerSeasonStats({ ...right, scope, fullName: rightName })]);
  if (!a.ok) return a;
  if (!b.ok) return b;
  return { ok: true, data: [a.data, b.data] };
}

async function sidePhoto(side: H2HSideRequest): Promise<Result<UploadedImage | null>> {
  if (!side.photoId) return { ok: true, data: null };
  const resolved = await resolveH2HPhoto(side.photoId, side.playerId, side.teamId);
  return resolved.ok ? { ok: true, data: resolved.data.image } : resolved;
}

export interface H2HRendered extends H2HCardResult {
  pages: [Buffer, Buffer];
  players: [PlayerSeasonStats, PlayerSeasonStats];
  mode: H2HMode;
  /** Fotoğrafı seçilip yüzü bulunamayan oyuncular (vesikalık yerine logo çizildi). */
  noFace: string[];
}

export async function renderH2H(request: H2HRequest): Promise<Result<H2HRendered>> {
  const players = await loadH2HPlayers(request.left, request.right, request.scope);
  if (!players.ok) return players;
  const [left, right] = players.data;
  const mode = request.mode ?? defaultMode(left.minutes, right.minutes);
  const [leftPhoto, rightPhoto] = await Promise.all([sidePhoto(request.left), sidePhoto(request.right)]);
  if (!leftPhoto.ok) return leftPhoto;
  if (!rightPhoto.ok) return rightPhoto;
  const [leftHex, rightHex] = h2hColors(left.teamId, right.teamId);
  const [leftLogo, rightLogo, brandLogo, leftFace, rightFace] = await Promise.all([
    resolveImage(left.teamLogo ?? undefined, 300),
    resolveImage(right.teamLogo ?? undefined, 300),
    loadBrandLogo(),
    leftPhoto.data ? facePortrait(leftPhoto.data, leftHex, request.left.portraitAdjust) : Promise.resolve(null),
    rightPhoto.data ? facePortrait(rightPhoto.data, rightHex, request.right.portraitAdjust) : Promise.resolve(null),
  ]);
  const frame = MATCH_DAY_FRAMES[request.format];
  const origin = (team: string) => (teamNameTr(team) === left.teamName ? left.teamOrigin : teamNameTr(team) === right.teamName ? right.teamOrigin : null);
  const match = request.match ? { homeTeam: teamNameTr(request.match.homeTeam), awayTeam: teamNameTr(request.match.awayTeam), kickoffUtc: request.match.kickoffUtc, homeOrigin: origin(request.match.homeTeam), awayOrigin: origin(request.match.awayTeam) } : null;
  const built = buildH2HCard({ left, right, mode, match, images: { leftLogo, rightLogo, leftFace, rightFace, brandLogo }, frame });
  if (!built.ok) return built;
  const rendered = await renderH2HImages({
    card: built.data.card,
    frame,
    photos: { home: leftPhoto.data, away: rightPhoto.data },
    seedKey: `h2h-${left.playerId}-${right.playerId}`,
    adjust: { home: request.left.posterAdjust, away: request.right.posterAdjust },
  });
  if (!rendered.ok) return rendered;
  const noFace = [leftPhoto.data && !leftFace ? left.fullName : null, rightPhoto.data && !rightFace ? right.fullName : null].filter((name): name is string => name !== null);
  return { ok: true, data: { ...built.data, pages: rendered.data, players: players.data, mode, noFace } };
}

/** Carousel'i çizer, kalıcı depoya yazar ve tek DRAFT açar (maçtan başlandıysa o maçın planlanmış placeholder'ını devralır). */
export async function createH2HDraft(request: H2HRequest): Promise<Result<{ id: string }>> {
  const rendered = await renderH2H(request);
  if (!rendered.ok) return rendered;
  const [left, right] = rendered.data.players;
  const caption = buildH2HCaption(left, right, rendered.data.card);
  const language = bannedWordsGate({ "gönderi metni": caption });
  if (language) return fail("BANNED_LANGUAGE", `${language} — kart üretilmedi.`);

  const urls: string[] = [];
  try {
    for (const page of rendered.data.pages) urls.push(await saveStoredFile("renders", `${randomUUID()}.png`, page));
    const [imageUrl] = urls;
    const side = (s: H2HSideRequest) => ({ playerId: s.playerId, teamId: s.teamId, photoId: s.photoId, posterAdjust: s.posterAdjust ?? null, portraitAdjust: s.portraitAdjust ?? null });
    const record = await createScheduledContent({
      fixtureId: request.match?.fixtureId ?? MANUAL_H2H_FIXTURE_ID,
      contentType: "PLAYER_H2H" satisfies ContentTypeId,
      prompt: "",
      resultImageUrl: imageUrl ?? null,
      status: "DRAFT",
      format: DB_FORMAT[request.format],
      caption,
      statsSnapshot: JSON.parse(JSON.stringify({ left, right })) as Prisma.InputJsonObject,
      renderOptions: JSON.parse(
        JSON.stringify({
          kind: "PLAYER_H2H",
          format: request.format,
          scope: request.scope,
          mode: rendered.data.mode,
          left: side(request.left),
          right: side(request.right),
          imageUrl,
          carousel: urls.map((url, index) => ({ url, label: SLIDE_LABELS[index] ?? `${index + 1}` })),
          title: `${left.fullName} – ${right.fullName}`,
          subtitle: rendered.data.card.scopeLabel,
        }),
      ) as Prisma.InputJsonObject,
    });
    return { ok: true, data: record };
  } catch (cause) {
    await Promise.all(urls.map((url) => deleteStoredUrl(url)));
    console.error("[player-h2h] kaydedilemedi:", cause);
    return fail("STORAGE_FAILED", "Oyuncu karşılaştırması kaydedilemedi — depolamaya ya da veritabanına yazılamadı.");
  }
}
