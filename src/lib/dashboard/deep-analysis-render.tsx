import { ImageResponse } from "next/og";
import { loadDeepAnalysisFonts } from "@/lib/dashboard/deep-analysis-fonts";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { DEEP_ANALYSIS_SIZE, DeepAnalysisCard } from "@/skills/render-engine/templates/deep-analysis/deep-analysis-card";
import { HERO_FILE_PATTERN, type TeamAnalysisDraft } from "@/types/deep-analysis";

/**
 * Satori'nin sunucuda indireceği uzak görseller yalnızca API-Football medya sunucusundan olabilir
 * (logo, oyuncu fotoğrafı). Formdan gelen başka her adres çizilmez — SSRF'e karşı.
 */
const ALLOWED_IMAGE_ORIGIN = "https://media.api-sports.io/";

/** Logo/fotoğrafın çizildiği en büyük kenar (2x keskinlik için). */
const LOGO_SIDE = 152;
const PHOTO_SIDE = 112;
/** Kapak tam genişlikte çizilir. */
const HERO_SIDE = 1080;

/**
 * İzinli uzak görseli önceden indirip `data:` URI'sine gömer — Satori'nin kendi indirmesi ağ
 * hatasında görseli sessizce boş bırakıyordu. Geçici hatalara karşı bir kez yeniden denenir;
 * yine olmazsa görsel çizilmez (boş halka yerine bölüm fotoğrafsız kalır).
 */
async function embed(url: string, maxSide: number): Promise<string> {
  if (!url.startsWith(ALLOWED_IMAGE_ORIGIN)) return "";
  return (await resolveImage(url, maxSide)) ?? (await resolveImage(url, maxSide)) ?? "";
}

/** Kapak yalnızca kapak motorunun yazdığı depolama dosyası olabilir (bkz. analysis-hero.ts). */
async function embedHero(url: string): Promise<string> {
  if (!HERO_FILE_PATTERN.test(url)) return "";
  return (await resolveImage(url, HERO_SIDE)) ?? "";
}

async function sanitize(team: TeamAnalysisDraft): Promise<TeamAnalysisDraft> {
  const [heroImageUrl, logoUrl, ...photos] = await Promise.all([
    embedHero(team.heroImageUrl),
    embed(team.logoUrl, LOGO_SIDE),
    ...team.keyPlayers.map((player) => embed(player.photoUrl, PHOTO_SIDE)),
  ]);
  return {
    ...team,
    heroImageUrl: heroImageUrl ?? "",
    logoUrl: logoUrl ?? "",
    colorHex: /^#[0-9a-f]{6}$/i.test(team.colorHex) ? team.colorHex : "",
    keyPlayers: team.keyPlayers.map((player, index) => ({ ...player, photoUrl: photos[index] ?? "" })),
  };
}

/** Tek takımlık Derinlemesine Analiz kartını PNG olarak çizer (Fal.ai yok, ücretsiz). */
export async function renderDeepAnalysisCard(input: { team: TeamAnalysisDraft; opponentName: string }): Promise<Buffer> {
  const [fonts, brandLogo, team] = await Promise.all([loadDeepAnalysisFonts(), loadBrandLogo(), sanitize(input.team)]);
  const response = new ImageResponse(<DeepAnalysisCard team={team} opponentName={input.opponentName} brandLogo={brandLogo} />, {
    ...DEEP_ANALYSIS_SIZE,
    fonts,
  });
  return Buffer.from(await response.arrayBuffer());
}
