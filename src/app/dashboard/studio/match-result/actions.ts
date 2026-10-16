"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { isPlayerPhoto } from "@/lib/dashboard/media-library";
import { createMatchResultCard, type FeaturedPlayer } from "@/lib/dashboard/match-result-engine";
import { featuredSlots, mvpOf, type FeaturedSlot } from "@/lib/dashboard/match-result-featured";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { resolveStudioImage } from "@/lib/dashboard/studio-image-input";
import { getMatchResultRaw, parseFixtureId } from "@/lib/services/api-football";
import { isFalConfigured } from "@/lib/services/fal";
import { MATCH_DAY_FORMAT_IDS, MATCH_DAY_QUALITY_MODES } from "@/types/match-day";
import { MATCH_IMPORTANCE_LEVELS, type MatchResultActionState, type MatchResultFacts } from "@/types/match-result";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined);

const playerId = z.coerce.number().int().positive();

const matchResultSchema = z.object({
  fixtureId: z.string().regex(/^api-football-\d+$/, "Maç seçilmedi — Maç Merkezi'nden açın."),
  template: z.literal("HERO_SCORE", "Bu şablon henüz hazır değil — şimdilik Kahraman-Skor."),
  format: z.enum(MATCH_DAY_FORMAT_IDS, "Bir platform formatı seçin."),
  // Maç Günü'ndeki tansiyon kuralıyla aynı: önem sınıflandırılmadan sahne üretilmez (CLAUDE.md 3.2.3).
  importance: z.enum(MATCH_IMPORTANCE_LEVELS, "Maç önemini seçin."),
  quality: z.enum(MATCH_DAY_QUALITY_MODES, "Kalite modunu seçin."),
  strength: z.coerce.number().min(0.15).max(0.6),
  preservePlayers: z.boolean(),
  reuseBackground: z.boolean(),
  customPrompt: optionalText(500),
  player1Id: playerId,
  player2Id: z.union([z.literal(""), playerId]).optional(),
});

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Yuvanın oyuncusu + fotoğrafı. Kütüphaneden seçilen görsel gerçekten o oyuncuya ait olmalı
 * (form kimliğine güvenilmez); yoksa yeni yükleme oyuncu kimliğiyle kütüphaneye etiketlenir —
 * bir sonraki maçta otomatik bulunur. Fotoğraf yoksa kart üretilmez.
 */
async function resolveFeatured(formData: FormData, slot: FeaturedSlot, selectedId: number, facts: MatchResultFacts): Promise<FeaturedPlayer | string> {
  const candidate = slot.options.find((option) => option.playerId === selectedId);
  if (!candidate) return `${slot.label}: seçilen oyuncu bu maçın kadrosunda değil.`;

  const assetId = text(formData, `${slot.key}AssetId`);
  if (assetId && !(await isPlayerPhoto(assetId, candidate.playerId))) return `${candidate.name}: seçilen kütüphane fotoğrafı bu oyuncuya ait değil.`;

  const team = candidate.side === "HOME" ? facts.home : facts.away;
  const resolved = await resolveStudioImage(formData, slot.key, "PLAYER", `${candidate.name} fotoğrafı`, {
    playerId: candidate.playerId,
    playerName: candidate.name,
    teamId: String(team.id),
    teamName: team.name,
  });
  if (!resolved.ok) return resolved.error.message;
  if (!resolved.data) return `${candidate.name} için kütüphanede fotoğraf yok — fotoğraf yükleyin. Kart üretilmedi.`;
  return { candidate, image: resolved.data.image, fileUrl: resolved.data.fileUrl };
}

/** "Maç Sonucu" kartı: form → doğrulama → maç (sunucuda yeniden çekilir) → oyuncu fotoğrafları → motor. DRAFT doğar. */
export async function generateMatchResultAction(_prevState: MatchResultActionState, formData: FormData): Promise<MatchResultActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  if (!isFalConfigured()) return { error: "FAL_KEY tanımlı değil — .env.local dosyasına ekleyip sunucuyu yeniden başlatın." };

  const fields = ["fixtureId", "template", "format", "importance", "quality", "strength", "customPrompt", "player1Id", "player2Id"] as const;
  const parsed = matchResultSchema.safeParse({
    ...Object.fromEntries(fields.map((name) => [name, text(formData, name)])),
    preservePlayers: formData.get("preservePlayers") === "on",
    reuseBackground: formData.get("reuseBackground") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  const data = parsed.data;

  const apiId = parseFixtureId(data.fixtureId);
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  if (!raw?.ok) return { error: `Maç verisi alınamadı: ${raw?.error.message ?? "geçersiz maç kimliği"}` };
  const validated = validateMatchResultFixture(raw.data, new Date());
  if (!validated.ok) return { error: validated.error.message };
  const facts = validated.data;

  const slots = featuredSlots(facts);
  const selectedIds = [data.player1Id, data.player2Id === "" ? undefined : data.player2Id];
  const players: FeaturedPlayer[] = [];
  try {
    for (const [index, slot] of slots.entries()) {
      const selected = selectedIds[index];
      if (selected === undefined) return { error: `${slot.label} seçin.` };
      const featured = await resolveFeatured(formData, slot, selected, facts);
      if (typeof featured === "string") return { error: featured };
      players.push(featured);
    }
  } catch {
    return { error: "Oyuncu fotoğrafı medya kütüphanesine kaydedilemedi." };
  }
  const mvp = mvpOf(players.map((player) => player.candidate));
  if (!mvp) return { error: "Maçın oyuncusunu seçin." };

  const result = await createMatchResultCard({
    facts,
    format: data.format,
    importance: data.importance,
    quality: data.quality,
    reuseBackground: data.reuseBackground,
    players,
    mvp,
    strength: data.strength,
    preservePlayers: data.preservePlayers,
    customPrompt: data.customPrompt,
  });
  if (!result.ok) return { error: result.error.message };

  refreshDashboard();
  return { result: result.data };
}
