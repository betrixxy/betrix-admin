import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { PLAYER_PAGE_LABELS } from "@/lib/dashboard/player-stats-engine";
import { renderPlayerPage } from "@/lib/dashboard/player-stats-page";
import { loadPlayerStatsFacts } from "@/lib/dashboard/player-stats-studio";
import { pageNumber, playerSlideIndex, setPages, withPlayerSlide } from "@/lib/dashboard/set-pages";
import { deleteStoredUrl } from "@/lib/dashboard/draft-render";
import { parseStoredFileUrl, readStoredFile, saveStoredFile } from "@/lib/dashboard/storage";
import { reportJobStep } from "@/lib/jobs/studio-jobs";
import { playerDataSettlement } from "@/lib/player-stats/settle";
import { prisma } from "@/lib/prisma";
import { getMatchResultRaw, parseFixtureId } from "@/lib/services/api-football";
import { toPlayerMatchLines } from "@/lib/services/api-football/player-match-mappers";
import { MATCH_DAY_FORMAT_IDS } from "@/types/match-day";
import type { PlayerDataSettlement } from "@/types/player-match-stats";
import type { Result } from "@/types/result";
import type { PendingPlayerPage } from "@/lib/player-stats/plan";

/**
 * Maç Sonucu taslağına oyuncu sayfasını SONRADAN ekleme (kurucu kararı 2026-10-30: 03 seti kilitlemez). Yalnızca
 * DRAFT (yayından önce) ve henüz oyuncu sayfası olmayan kayıt; veri kesinleşmemişse yalnızca "şimdi üret
 * (veriler değişebilir)" ile. Sayfa yeri ayrıldıysa sabit sıradaki yerine, yoksa carousel'in sonuna eklenir: aynı format, 01'in sütun tarafı, B zemini 01'in
 * bulanık hâli, A 01'in fotoğrafını başka fotoğraf varsa tekrar kullanmaz. Arka plan işinde çalışır.
 */

type AppendError = { code: string; message: string; notSettled?: boolean };
const fail = (code: string, message: string, notSettled = false): { ok: false; error: AppendError } => ({ ok: false, error: { code, message, ...(notSettled ? { notSettled } : {}) } });

const optionsSchema = z.object({
  kind: z.literal("MATCH_RESULT"),
  frameFormat: z.enum(MATCH_DAY_FORMAT_IDS),
  imageUrl: z.string(),
  side: z.enum(["left", "right"]).optional(),
  mvp: z.object({ playerId: z.number() }).nullish(),
  photo: z.object({ photoId: z.string().nullish() }).passthrough().nullish(),
  carousel: z.array(z.object({ url: z.string(), label: z.string() })).optional(),
});

async function draftOf(id: string) {
  const record = await prisma.aiContent.findUnique({ where: { id }, select: { id: true, fixtureId: true, status: true, contentType: true, renderOptions: true } });
  if (!record || record.contentType !== "MATCH_RESULT") return fail("NOT_FOUND", "Maç Sonucu taslağı bulunamadı.");
  if (record.status !== "DRAFT") return fail("NOT_DRAFT", "Oyuncu sayfası yalnızca taslağa (yayından ve onaydan önce) eklenir.");
  if (setPages("MATCH_RESULT", record.renderOptions).includes("PLAYER_STATS")) return fail("ALREADY", "Bu taslakta oyuncu sayfası zaten var.");
  const options = optionsSchema.safeParse(record.renderOptions);
  if (!options.success) return fail("BAD_OPTIONS", "Taslağın kart ayarları okunamadı.");
  return { ok: true as const, data: { record, options: options.data } };
}

/** Taslağın oyuncu verisi kesinleşti mi (geri sayım için; Sportmonks'a gidilmez). */
export async function draftPlayerSettlement(id: string): Promise<Result<PlayerDataSettlement>> {
  const draft = await draftOf(id);
  if (!draft.ok) return draft;
  const apiId = parseFixtureId(draft.data.record.fixtureId);
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  if (!raw?.ok || !raw.data) return fail("FIXTURE", "Maç verisi alınamadı.");
  return { ok: true, data: playerDataSettlement({ kickoffUtc: raw.data.fixture.date, statusShort: raw.data.fixture.status.short, lines: toPlayerMatchLines(raw.data), now: new Date() }) };
}

export async function appendPlayerPage(id: string, page: PendingPlayerPage, force: boolean): Promise<Result<{ id: string; notes: string[] }, AppendError>> {
  const draft = await draftOf(id);
  if (!draft.ok) return draft;
  const { record, options } = draft.data;
  reportJobStep("Oyuncu verisi alınıyor");
  const apiId = parseFixtureId(record.fixtureId);
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  if (!raw?.ok || !raw.data) return fail("FIXTURE", `Maç verisi alınamadı: ${raw && !raw.ok ? raw.error.message : "maç yok"}`);
  const validated = validateMatchResultFixture(raw.data, new Date());
  if (!validated.ok) return fail("FIXTURE", validated.error.message);
  const facts = await loadPlayerStatsFacts(raw.data, new Date());
  if (!facts) return fail("NO_DATA", "Oyuncu istatistikleri alınamadı.");
  if (!facts.settlement.settled && !force) return fail("NOT_SETTLED", `Oyuncu verisi henüz kesinleşmedi — ${facts.settlement.reason}`, true);

  const stored = parseStoredFileUrl(options.imageUrl);
  const resultImage = stored ? await readStoredFile(stored.bucket, stored.fileName) : null;
  const slides = options.carousel && options.carousel.length > 0 ? options.carousel : [{ url: options.imageUrl, label: "01 · Maç Sonucu" }];
  // Yeri ayrıldıysa (Maç Analizi / Tahmin Karnesi sayfalarından önce) o numara, yoksa carousel'in sonu.
  const number = pageNumber(playerSlideIndex(record.renderOptions) + 1);
  const label = PLAYER_PAGE_LABELS[page.template];
  const rendered = await renderPlayerPage({
    facts,
    template: page.template,
    count: page.count ?? undefined,
    format: options.frameFormat,
    playerId: page.playerId ?? options.mvp?.playerId ?? null,
    avoidPhotoId: options.photo?.photoId ?? null,
    pageLabel: `${number} · ${label}`,
    side: options.side ?? "right",
    resultImage,
    allowUnsettled: force,
  });
  if (!rendered.ok) return rendered;

  reportJobStep("Kaydediliyor");
  const url = await saveStoredFile("renders", `${randomUUID()}.png`, rendered.data.image);
  const slideLabel = `${number} · ${label.charAt(0)}${label.slice(1).toLocaleLowerCase("tr-TR")}`;
  const next = withPlayerSlide(record.renderOptions, slides[0] ?? { url: options.imageUrl, label: "01 · Maç Sonucu" }, { url, label: slideLabel }, !facts.settlement.settled);
  // Yalnızca hâlâ taslaksa yazılır (bu arada onaylandıysa dosya geri alınır).
  const updated = await prisma.aiContent.updateMany({ where: { id, status: "DRAFT" }, data: { renderOptions: JSON.parse(JSON.stringify(next)) as Prisma.InputJsonObject } });
  if (updated.count === 0) {
    await deleteStoredUrl(url);
    return fail("NOT_DRAFT", "Taslak bu sırada onaylandı ya da silindi — oyuncu sayfası eklenmedi.");
  }
  return { ok: true, data: { id, notes: rendered.data.notes } };
}
