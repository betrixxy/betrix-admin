import { z } from "zod";
import { MAX_HASHTAGS, hashtagCount } from "@/lib/dashboard/vitrin-caption";
import { bannedWordsGate } from "@/lib/prediction/banned-words";
import { kickoffGate } from "@/lib/prediction/kickoff";
import { vitrinPublishGate } from "@/lib/prediction/publish-gate";
import { parseVitrinOptions, predictionRecordsFor, type PredictionRecordInput } from "@/lib/prediction/record";
import { prisma } from "@/lib/prisma";
import { getFixtureById, parseFixtureId } from "@/lib/services/api-football";
import { OPEN_BOX_COUNT } from "@/types/prediction";
import type { Fixture } from "@/types/sports";
import type { Result } from "@/types/result";

/**
 * Vitrin onayı ve yayını. Onay (`draft-engine.ts::decideDraft`): kayıt vitrin değilse boş dizi. Onay
 * reddedilir ve kayıt YAZILMAZ: gönderi metninde bahis dili varsa ya da onay anı kickoff'tan önce
 * değilse (`kickoff.ts`). Kickoff önce API'den (erteleme/saat değişikliği görülsün), API'ye
 * ulaşılamazsa kayıttaki anlık görüntüden okunur; ikisi de yoksa onay reddedilir. Yayın
 * (`vitrinPublishCheck`): yalnızca onaylı, kaydı yazılmış ve kickoff öncesi.
 */

type Fail = { ok: false; error: { code: string; message: string } };
const fail = (code: string, message: string): Fail => ({ ok: false, error: { code, message } });

const storedKickoffSchema = z.object({ kickoffUtc: z.string() });

async function approvalFixture(fixtureId: string, renderOptions: unknown): Promise<Pick<Fixture, "kickoffUtc" | "status"> | null> {
  const apiId = parseFixtureId(fixtureId);
  const live = apiId === null ? null : await getFixtureById(apiId);
  if (live?.ok) return live.data;
  const stored = storedKickoffSchema.safeParse(renderOptions);
  // Anlık görüntüde durum yok: yalnızca saat denetlenir.
  return stored.success ? { kickoffUtc: stored.data.kickoffUtc, status: "SCHEDULED" } : null;
}

/** `approvedAt` — onayın anı; kayıt satırlarının `recordedAt`'i de budur (denetlenen an = yazılan an). */
export async function vitrinApproval(id: string, publishCaption: string | null, approvedAt: Date): Promise<Result<(PredictionRecordInput & { recordedAt: Date })[], Fail["error"]>> {
  const record = await prisma.aiContent.findUnique({ where: { id }, select: { contentType: true, fixtureId: true, caption: true, renderOptions: true } });
  // Oyuncu karşılaştırması: tahmin kaydı yok, ama gönderi metni aynı dil kapısından geçer.
  if (record?.contentType === "PLAYER_H2H") {
    const language = bannedWordsGate({ "gönderi metni": publishCaption ?? record.caption ?? "" });
    return language ? fail("BANNED_LANGUAGE", `${language} — onaylanmadı.`) : { ok: true, data: [] };
  }
  // Kura sonucu: tahmin kaydı yok, yalnızca gönderi metninin dil kapısı (bahis dili yok).
  if (record?.contentType === "DRAWS_AND_PAIRINGS") {
    const text = publishCaption ?? record.caption ?? "";
    const draw = bannedWordsGate({ "gönderi metni": text });
    if (draw) return fail("BANNED_LANGUAGE", `${draw} — onaylanmadı.`);
    const tags = hashtagCount(text);
    return tags > MAX_HASHTAGS ? fail("TOO_MANY_HASHTAGS", `Kura metninde en fazla ${MAX_HASHTAGS} hashtag (${tags} var) — onaylanmadı.`) : { ok: true, data: [] };
  }
  const options = record?.contentType === "AI_MARKET_PREDICTION" ? parseVitrinOptions(record.renderOptions) : null;
  if (!record || !options) return { ok: true, data: [] };
  const language = bannedWordsGate({ "gönderi metni": publishCaption ?? record.caption ?? "" });
  if (language) return fail("BANNED_LANGUAGE", `${language} — onaylanmadı.`);
  const fixture = await approvalFixture(record.fixtureId, record.renderOptions);
  if (!fixture) return fail("KICKOFF_UNKNOWN", "Maçın başlama saati doğrulanamadı — tahmin kaydı yazılmadı, onaylanmadı.");
  const late = kickoffGate(fixture, approvedAt);
  if (late) return fail("MATCH_STARTED", `${late} Tahmin kaydı yazılmadı.`);
  return { ok: true, data: predictionRecordsFor(id, record.fixtureId, options).map((row) => ({ ...row, recordedAt: approvedAt })) };
}

/** VITRIN türü: içerik türü + `renderOptions.kind` (bozuk kayıt da vitrin sayılır ve kapıya takılır). */
const vitrinKindSchema = z.object({ kind: z.literal("VITRIN") });

/**
 * Yayın kapısının veritabanı sarmalayıcısı (`publish-gate.ts`): vitrin değilse geçer. `at` — yayın anı
 * (Hemen Paylaş'ta platform çağrısından önceki an, yayın kaydında gönderinin yayın anı).
 */
export async function vitrinPublishCheck(id: string, at: Date): Promise<Result<null, Fail["error"]>> {
  const record = await prisma.aiContent.findUnique({ where: { id }, select: { contentType: true, status: true, fixtureId: true, renderOptions: true } });
  if (!record || record.contentType !== "AI_MARKET_PREDICTION" || !vitrinKindSchema.safeParse(record.renderOptions).success) return { ok: true, data: null };
  const [recordCount, fixture] = await Promise.all([prisma.predictionRecord.count({ where: { aiContentId: id } }), approvalFixture(record.fixtureId, record.renderOptions)]);
  const requiredRecords = parseVitrinOptions(record.renderOptions)?.open.length ?? OPEN_BOX_COUNT;
  const blocked = vitrinPublishGate({ status: record.status, recordCount, requiredRecords, fixture }, at);
  return blocked ? fail("VITRIN_NOT_PUBLISHABLE", blocked) : { ok: true, data: null };
}
