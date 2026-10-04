"use server";

import { z } from "zod";
import { getCurrentSession } from "@/lib/auth/require-session";
import { refreshDashboard, UNAUTHORIZED_MESSAGE } from "@/lib/dashboard/action-utils";
import { createMatchDayCard } from "@/lib/dashboard/match-day-engine";
import { RANDOM_TEMPLATE, isMatchDayTemplateId, pickRandomTemplate } from "@/lib/dashboard/match-day-templates";
import { resolveStudioImage } from "@/lib/dashboard/studio-image-input";
import { isFalConfigured } from "@/lib/services/fal";
import { MATCH_DAY_FORMAT_IDS, MATCH_DAY_QUALITY_MODES, type MatchDayActionState } from "@/types/match-day";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined);

/** Logolar yalnızca API-Football CDN'inden gelir — sunucu rastgele adreslere istek atmaz. */
const LOGO_PATTERNS = {
  teams: /^https:\/\/media\.api-sports\.io\/football\/teams\/\d+\.png$/,
  leagues: /^https:\/\/media\.api-sports\.io\/football\/leagues\/\d+\.png$/,
} as const;

const apiSportsLogo = (kind: keyof typeof LOGO_PATTERNS) =>
  z
    .string()
    .trim()
    .refine((value) => value === "" || LOGO_PATTERNS[kind].test(value), {
      message: "Logo adresi API-Football'a ait değil.",
    })
    .transform((value) => value || undefined);

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Takım rengi geçersiz.");

const matchDaySchema = z.object({
  fixtureId: optionalText(100),
  homeTeam: z.string().trim().min(1, "Ev sahibi takım adı gerekli.").max(40),
  awayTeam: z.string().trim().min(1, "Deplasman takım adı gerekli.").max(40),
  league: optionalText(40),
  week: optionalText(20),
  date: optionalText(30),
  time: optionalText(10),
  stadium: optionalText(60),
  referee: optionalText(50),
  homeLogo: apiSportsLogo("teams"),
  awayLogo: apiSportsLogo("teams"),
  leagueLogo: apiSportsLogo("leagues"),
  template: z
    .string()
    .refine((value) => value === RANDOM_TEMPLATE || isMatchDayTemplateId(value), "Geçersiz tasarım şablonu.")
    .transform((value) => (isMatchDayTemplateId(value) ? value : pickRandomTemplate())),
  homeColorHex: hexColor,
  awayColorHex: hexColor,
  // Bkz. CLAUDE.md 3.2.3 — derbi tansiyonu sınıflandırılmadan render tetiklenmez.
  derbyIntensity: z.enum(["NONE", "RIVALRY", "DERBY", "ELITE_DERBY"], "Maç tansiyonunu seçin."),
  format: z.enum(MATCH_DAY_FORMAT_IDS, "Bir platform formatı seçin."),
  quality: z.enum(MATCH_DAY_QUALITY_MODES, "Kalite modunu seçin."),
  strength: z.coerce.number().min(0.15).max(0.6),
  preservePlayers: z.boolean(),
  reuseBackground: z.boolean(),
  customPrompt: optionalText(500),
});

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * "Maç Günü" kartı üretimi: form → doğrulama → oyuncu görselleri (kütüphane/yükleme) →
 * `createMatchDayCard` (Fal.ai birefnet + flux + image-to-image, bkz. match-day-engine.ts).
 * Sonuç DRAFT olarak kaydedilir.
 */
export async function generateMatchDayAction(
  _prevState: MatchDayActionState,
  formData: FormData,
): Promise<MatchDayActionState> {
  if (!(await getCurrentSession())) return { error: UNAUTHORIZED_MESSAGE };
  if (!isFalConfigured()) return { error: "FAL_KEY tanımlı değil — .env.local dosyasına ekleyip sunucuyu yeniden başlatın." };

  const fields = [
    "fixtureId", "homeTeam", "awayTeam", "league", "week", "date", "time", "stadium", "referee",
    "homeLogo", "awayLogo", "leagueLogo", "template", "format", "quality", "homeColorHex", "awayColorHex", "derbyIntensity", "strength", "customPrompt",
  ] as const;
  const parsed = matchDaySchema.safeParse({
    ...Object.fromEntries(fields.map((name) => [name, text(formData, name)])),
    preservePlayers: formData.get("preservePlayers") === "on",
    reuseBackground: formData.get("reuseBackground") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Geçersiz form verisi." };
  const data = parsed.data;

  let home: Awaited<ReturnType<typeof resolveStudioImage>>;
  let away: Awaited<ReturnType<typeof resolveStudioImage>>;
  try {
    [home, away] = await Promise.all([
      resolveStudioImage(formData, "homePlayer", "PLAYER", "Ev sahibi oyuncu fotoğrafı"),
      resolveStudioImage(formData, "awayPlayer", "PLAYER", "Deplasman oyuncu fotoğrafı"),
    ]);
  } catch {
    return { error: "Oyuncu fotoğrafları medya kütüphanesine kaydedilemedi." };
  }
  if (!home.ok) return { error: home.error.message };
  if (!away.ok) return { error: away.error.message };
  if (!home.data || !away.data) return { error: "İki takım için de oyuncu fotoğrafı seçin veya yükleyin." };

  const result = await createMatchDayCard({
    fixtureId: data.fixtureId ?? null,
    info: {
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      league: data.league,
      week: data.week,
      date: data.date,
      time: data.time,
      stadium: data.stadium,
      referee: data.referee,
      homeLogo: data.homeLogo,
      awayLogo: data.awayLogo,
      leagueLogo: data.leagueLogo,
    },
    template: data.template,
    format: data.format,
    quality: data.quality,
    reuseBackground: data.reuseBackground,
    homePlayer: home.data.image,
    awayPlayer: away.data.image,
    homeColorHex: data.homeColorHex,
    awayColorHex: data.awayColorHex,
    derbyIntensity: data.derbyIntensity,
    customPrompt: data.customPrompt,
    strength: data.strength,
    preservePlayers: data.preservePlayers,
  });
  if (!result.ok) return { error: result.error.message };

  refreshDashboard();
  return { result: result.data };
}
