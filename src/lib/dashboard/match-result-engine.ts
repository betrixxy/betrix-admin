import { withResultPeople } from "@/lib/dashboard/set-people";
import { withTeamOrigins } from "@/lib/dashboard/team-origin";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { Prisma } from "@/generated/prisma/client";
import { createScheduledContent } from "@/lib/calendar/content-schedule";
import { layoutGate } from "@/lib/dashboard/layout-check";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { prepareMatchPhoto } from "@/lib/dashboard/match-photo";
import type { CropOffset } from "@/lib/dashboard/match-photo/crop";
import { resolveMatchResultCard } from "@/lib/dashboard/match-result-card";
import { buildMatchResultCaption, matchResultTitle } from "@/lib/dashboard/match-result-caption";
import { mvpLineName } from "@/lib/dashboard/match-result-featured";
import { renderMatchResultOverlay } from "@/lib/dashboard/match-result-overlay";
import { COMPETITION_COLORS, resultAccentHex } from "@/lib/dashboard/match-result-theme";
import { renderMatchStatsImage } from "@/lib/dashboard/match-stats-render";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import { saveStoredFile } from "@/lib/dashboard/storage";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { toFixtureId } from "@/lib/services/api-football/mappers";
import { SET_PAGE_LABELS } from "@/types/checkmatch-set";
import type { ContentTypeId } from "@/types/content-type";
import type { MatchDayFormatId } from "@/types/match-day";
import type { MatchResultFacts, MatchResultGenerationResult, MatchResultTemplateId, MvpCandidate } from "@/types/match-result";
import type { MatchStatsFacts } from "@/types/match-stats";
import type { Result } from "@/types/result";
import type { SocialFormatId } from "@/types/studio-formats";

/**
 * Maç Sonucu kartı üretim hattı — TAM KADRAJ gerçek maç fotoğrafı (yarı otomatik: admin
 * tıklamasıyla, DRAFT doğar; bkz. CLAUDE.md 1.10). Oyuncu kesimi ve AI arka plan YOKTUR (kesim
 * modu yalnızca Maç Günü'nde):
 *
 *   1. Kalite kapısı: kısa kenar < 1080 → Fal ESRGAN (önbellekli, tek ücretli adım); keskinlik
 *      yetersizse kart üretilmez. Kısa kenar < 1500 bilgi uyarısı.
 *   2. Yüz tespiti (yerel) → akıllı kırpma (yazısız bölge, otomatik zoom, 16:9 aynalama) + elle
 *      kaydırma/zoom → split-tone tonlama → yazı bölgesi parlaklığından gradyan gücü.
 *   3. Satori şablonu (A tam-kadraj · B dev-skor · C manşet) + YERLEŞİM KAPISI: hiçbir blok başka
 *      blokla ya da güvenli kenarla çakışmaz; çakışma varsa kart üretilmez, sebep yazılır.
 *   4. Set bitişi (vinyet + maç kimliği tohumlu gren) → PNG → DRAFT `AiContent`.
 *   5. (isteğe bağlı) 02 İstatistikler aynı DRAFT'ta carousel'in ikinci görseli (`renderMatchStatsImage`).
 */

type EngineError = { code: string; message: string };
const fail = (code: string, message: string): { ok: false; error: EngineError } => ({ ok: false, error: { code, message } });

export interface MatchPhotoInput {
  image: UploadedImage;
  /** Kütüphanedeki kalıcı URL — `AiContent.backgroundImageUrl` kaynağı olarak `renderOptions`'a yazılır. */
  fileUrl: string;
  /** Fotoğrafın kütüphane oyuncu etiketi; yoksa null. */
  playerId: number | null;
}

export interface CreateMatchResultInput {
  /** Sunucuda yeniden çekilip doğrulanmış gerçek maç verisi — istemciden gelmez. */
  facts: MatchResultFacts;
  format: MatchDayFormatId;
  template: MatchResultTemplateId;
  photo: MatchPhotoInput;
  /** Gönderi metnine yazılan maçın oyuncusu (karta yalnızca kural sağlanırsa, bkz. `mvpLineName`). */
  mvp: MvpCandidate | null;
  /** Formdaki "Fotoğraftaki oyuncu maçın oyuncusu" kutucuğu. */
  photoIsMvp: boolean;
  /**
   * "İstatistik sayfasını da ekle": verilirse tek DRAFT'ta carousel — 01 Maç Sonucu + 02
   * İstatistikler (aynı format, 01'in bulanık zemini, aynı vurgu rengi, aynı 16:9 sütun tarafı).
   */
  stats?: MatchStatsFacts | null | undefined;
  offset?: CropOffset | undefined;
  zoom?: number | undefined;
}

/** `AiContent.format` + `renderOptions.format` (sosyal format kaydı) eşlemesi. */
const FORMATS: Record<MatchDayFormatId, { db: string; social: SocialFormatId }> = {
  IG_PORTRAIT: { db: "IG_FEED", social: "post" },
  IG_SQUARE: { db: "IG_SQUARE", social: "square" },
  STORY: { db: "STORY", social: "story" },
  X_LANDSCAPE: { db: "X_CARD", social: "landscape" },
};

const asJson = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;

export async function createMatchResultCard(input: CreateMatchResultInput): Promise<Result<MatchResultGenerationResult, EngineError>> {
  const { facts } = input;
  const frame = MATCH_DAY_FRAMES[input.format];
  const accentHex = resultAccentHex(facts);

  // 1-2. Fotoğraf hattı (kalite kapısı, yüz, kırpma, tonlama).
  const prepared = await prepareMatchPhoto({
    image: input.photo.image,
    frame,
    accentHex,
    deepHex: COMPETITION_COLORS[facts.competition.kind]?.deep,
    template: input.template,
    offset: input.offset,
    zoom: input.zoom,
  });
  if (!prepared.ok) return fail(prepared.error.code, prepared.error.message);
  const photo = prepared.data;

  // 3. Kart + yerleşim kapısı.
  // Ad büyük harfi için takım kökeni (Türk takımı mı) + kart kişi adları (arşiv → Sportmonks → API, uyruk) — yalnızca okuma.
  const people = await withResultPeople(await withTeamOrigins(facts));
  const mvp = input.mvp ? (people.players.find((player) => player.playerId === input.mvp?.playerId) ?? input.mvp) : null;
  const mvpName = mvpLineName({ mvp, photoPlayerId: input.photo.playerId, photoIsMvp: input.photoIsMvp });
  const carousel = input.stats ? input.stats : null;
  const card = await resolveMatchResultCard(people, mvpName, carousel ? SET_PAGE_LABELS.RESULT : null, mvp ? (people.mvpOrigins.get(mvp.playerId) ?? null) : null);
  const options = { template: input.template, shadeStrength: photo.shadeStrength, side: photo.side };
  let final: Buffer;
  try {
    const gate = await layoutGate("Maç Sonucu", frame, (only) => renderMatchResultOverlay(card, frame, { ...options, only }));
    if (!gate.ok) return fail(gate.error.code, gate.error.message);
    // 4. Set bitişi.
    final = await finalizeSetImage(photo.art, await renderMatchResultOverlay(card, frame, options), frame, facts.fixtureId);
  } catch (error: unknown) {
    console.error(`[match-result] ${input.format} yazı katmanı çizilemedi:`, error);
    return fail("RENDER_FAILED", `Kartın yazı katmanı çizilemedi (${frame.ratioLabel}): ${error instanceof Error ? error.message : String(error)}`);
  }

  // 02 — aynı fotoğrafın (01 nihai görseli) bulanık zemini, aynı sütun tarafı; kendi yerleşim kapısı.
  let statsImage: Buffer | null = null;
  if (carousel) {
    const rendered = await renderMatchStatsImage({ stats: carousel, frame, page: "SUMMARY", side: photo.side, resultImage: final, pageLabel: SET_PAGE_LABELS.STATS });
    if (!rendered.ok) return fail(rendered.error.code, rendered.error.message);
    statsImage = rendered.data;
  }

  const notes = [...photo.quality.warnings, ...(carousel?.warnings ?? [])];
  if (!photo.crop.facesInSafe) notes.push("Yüzler yazısız bölgeye tam sığmadı — kırpmayı elle kaydırmayı deneyin.");
  if (photo.side === "left") notes.push("16:9: özne sağda olduğu için yazı sütunu sola aynalandı.");
  if (photo.quality.upscaled && photo.quality.paidCalls === 0) notes.push("AI büyütme önbellekten");
  if (input.mvp && !mvpName) notes.push("\"MAÇIN OYUNCUSU\" satırı gizlendi — fotoğraftaki oyuncu MVP olarak işaretlenmedi.");

  try {
    const [backgroundImageUrl, resultImageUrl, statsImageUrl] = await Promise.all([
      saveStoredFile("generated", `${randomUUID()}.jpg`, await sharp(photo.art).jpeg({ quality: 90 }).toBuffer()),
      saveStoredFile("renders", `${randomUUID()}.png`, final),
      statsImage ? saveStoredFile("renders", `${randomUUID()}.png`, statsImage) : Promise.resolve(null),
    ]);
    const slides = statsImageUrl
      ? [
          { url: resultImageUrl, label: "01 · Maç Sonucu" },
          { url: statsImageUrl, label: "02 · İstatistikler" },
        ]
      : null;
    const format = FORMATS[input.format];
    const record = await createScheduledContent({
      fixtureId: toFixtureId(facts.fixtureId),
      contentType: "MATCH_RESULT" satisfies ContentTypeId,
      prompt: "",
      backgroundImageUrl,
      resultImageUrl,
      playerImageUrl: null,
      status: "DRAFT",
      format: format.db,
      caption: buildMatchResultCaption(people, mvp?.name ?? null),
      statsSnapshot: asJson(facts),
      renderOptions: asJson({
        kind: "MATCH_RESULT",
        template: input.template,
        format: format.social,
        frameFormat: input.format,
        imageUrl: resultImageUrl,
        title: matchResultTitle(facts),
        subtitle: `${facts.competition.name} · ${facts.roundLabel}`,
        mvp: input.mvp,
        mvpShown: mvpName !== null,
        photo: { fileUrl: input.photo.fileUrl, hash: input.photo.image.hash, playerId: input.photo.playerId },
        crop: photo.crop,
        side: photo.side,
        shadeStrength: photo.shadeStrength,
        sharpness: Math.round(photo.quality.sharpness),
        paidCalls: photo.quality.paidCalls,
        // Yayın Merkezi bu sırayla dizer (Instagram carousel); tek kartta yok.
        ...(slides ? { carousel: slides } : {}),
      }),
    });
    return {
      ok: true,
      data: { id: record.id, resultImageUrl, statsImageUrl, backgroundImageUrl, format: input.format, paidCalls: photo.quality.paidCalls, notes, zoom: photo.crop.zoom, facesInSafe: photo.crop.facesInSafe, side: photo.side },
    };
  } catch (error: unknown) {
    console.error("[match-result] kart kaydedilemedi:", error);
    return fail("STORAGE_FAILED", "Kart kaydedilemedi — depolamaya ya da veritabanına yazılamadı.");
  }
}
