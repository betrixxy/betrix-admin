import { z } from "zod";
import { bannedWordsGate } from "@/lib/prediction/banned-words";
import { kickoffGate } from "@/lib/prediction/kickoff";
import { parseVitrinOptions, predictionRecordsFor, type PredictionRecordInput } from "@/lib/prediction/record";
import { prisma } from "@/lib/prisma";
import { getFixtureById, parseFixtureId } from "@/lib/services/api-football";
import type { Fixture } from "@/types/sports";
import type { Result } from "@/types/result";

/**
 * Vitrin onayı (`draft-engine.ts::decideDraft` çağırır): kayıt vitrin değilse boş dizi. Onay
 * reddedilir ve kayıt YAZILMAZ: gönderi metninde bahis dili varsa ya da onay anı kickoff'tan önce
 * değilse (`kickoff.ts`). Kickoff önce API'den (erteleme/saat değişikliği görülsün), API'ye
 * ulaşılamazsa kayıttaki anlık görüntüden okunur; ikisi de yoksa onay reddedilir.
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
