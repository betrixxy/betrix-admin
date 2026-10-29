"use server";

import { z } from "zod";
import { resolveArchivePhoto } from "@/lib/archive/picker-input";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { createPlayerStatsDraft } from "@/lib/dashboard/player-stats-engine";
import { loadPlayerStatsFacts } from "@/lib/dashboard/player-stats-studio";
import { reportJobStep, startStudioJob } from "@/lib/jobs/studio-jobs";
import { getMatchResultRaw, parseFixtureId } from "@/lib/services/api-football";
import { MATCH_DAY_FORMAT_IDS } from "@/types/match-day";
import { PLAYER_STATS_TEMPLATE_IDS, type PlayerStatsActionState } from "@/types/player-match-stats";

const schema = z.object({
  fixtureId: z.string().regex(/^api-football-\d+$/, "Maç seçilmedi — Maç Merkezi'nden açın."),
  format: z.enum(MATCH_DAY_FORMAT_IDS, "Bir platform formatı seçin."),
  template: z.enum(PLAYER_STATS_TEMPLATE_IDS, "Bir şablon seçin."),
  count: z.enum(["3", "5"]).transform(Number),
  playerId: z.union([z.literal(""), z.coerce.number().int().positive()]).transform((value) => (value === "" ? null : value)),
  /** A fotoğrafı: auto (en yeni formalı) · picker (arşiv seçici / yeni yükleme) · none (tipografik). */
  photoMode: z.enum(["auto", "picker", "none"]),
});

const FIELDS = ["fixtureId", "format", "template", "count", "playerId", "photoMode"] as const;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * "Oyuncu İstatistikleri" kartı: form → doğrulama → maç (sunucuda yeniden çekilir, yalnızca biten maç) →
 * oyuncu verisi (kesinleşmediyse kart yok, "yeniden dene") → motor (yerleşim kapısı). DRAFT doğar. ARKA PLAN
 * İŞİ: A'nın arşiv fotoğrafı ilk kullanımda Fal ile büyütülebilir.
 */
export async function generatePlayerStatsAction(_prevState: PlayerStatsActionState, formData: FormData): Promise<PlayerStatsActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  const key = FIELDS.map((name) => text(formData, name)).join(":");
  const job = startStudioJob<PlayerStatsActionState>({
    kind: "player-stats",
    key: `player-stats:${key}`,
    firstStep: "Maç verisi alınıyor",
    run: () => runPlayerStats(formData),
    fail: (message) => ({ error: message }),
  });
  return { job };
}

async function runPlayerStats(formData: FormData): Promise<PlayerStatsActionState> {
  const parsed = schema.safeParse(Object.fromEntries(FIELDS.map((name) => [name, text(formData, name)])));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  const data = parsed.data;

  const apiId = parseFixtureId(data.fixtureId);
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  if (!raw?.ok) return { error: `Maç verisi alınamadı: ${raw?.error.message ?? "geçersiz maç kimliği"}` };
  const validated = validateMatchResultFixture(raw.data, new Date());
  if (!validated.ok || !raw.data) return { error: validated.ok ? "Maç bulunamadı." : validated.error.message };
  reportJobStep("Oyuncu verisi alınıyor");
  const facts = await loadPlayerStatsFacts(raw.data, new Date());
  if (!facts) return { error: "Oyuncu istatistikleri alınamadı — kart üretilmedi." };
  if (!facts.settlement.settled) return { error: `Oyuncu verisi henüz kesinleşmedi — ${facts.settlement.reason}`, notSettled: true };

  let photoId: string | null = data.photoMode === "none" ? "none" : null;
  if (data.template === "SPOTLIGHT" && data.photoMode === "picker") {
    const playerId = data.playerId ?? facts.match.mvp?.playerId ?? null;
    const line = facts.lines.find((candidate) => candidate.playerId === playerId);
    const resolved = await resolveArchivePhoto(formData, "photo", [facts.match.home.id, facts.match.away.id], data.fixtureId);
    if (!resolved.ok) return { error: resolved.error.message };
    if (resolved.data) {
      // Fotoğraf seçilen oyuncunun ve o maçtaki takımının forması olmalı.
      if (!line || resolved.data.playerApiId !== line.playerId) return { error: "Seçilen fotoğraf kartın oyuncusunun değil — fotoğraftaki kişi olarak bu oyuncuyu seçin." };
      if (resolved.data.kitTeamId !== line.teamId) return { error: "Fotoğraftaki forma oyuncunun bu maçtaki takımının değil — kart yalnızca o takımın formalı fotoğrafla üretilir." };
      photoId = resolved.data.photoId;
    }
  }

  const result = await createPlayerStatsDraft({ facts, template: data.template, format: data.format, playerId: data.playerId, photoId, count: data.count === 5 ? 5 : 3 });
  if (!result.ok) return result.error.notSettled ? { error: result.error.message, notSettled: true } : { error: result.error.message };
  try {
    refreshDashboard();
  } catch {
    // istek kapsamı kapanmış — sorun değil
  }
  return { result: result.data };
}
