import { resolveImage } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { prepareMatchPhoto } from "@/lib/dashboard/match-photo";
import type { CropOffset, CropPlan } from "@/lib/dashboard/match-photo/crop";
import { shadeStrengthFor, textRegionLuminance } from "@/lib/dashboard/match-photo/legibility";
import type { PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { COMPETITION_COLORS, readableTeamColors } from "@/lib/dashboard/match-result-theme";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { renderTeamFallback, type FallbackArtOptions } from "@/lib/dashboard/team-fallback-art";
import type { ColumnSide } from "@/skills/render-engine/templates/checkmatch-set/landscape";
import { matchResultGeometry } from "@/skills/render-engine/templates/match-result/geometry";
import type { MatchResultFacts, MatchResultTemplateId } from "@/types/match-result";
import type { Result } from "@/types/result";

/**
 * Maç Sonucu 01'in sanat katmanı — fotoğraflı ya da FOTOĞRAFSIZ (canlı test 2026-10-31: arşivde fotoğrafı olmayan
 * maçta kart hiç üretilmiyordu). Fotoğraf varsa tam kadraj hattı (`prepareMatchPhoto`: kalite kapısı, yüz, kırpma,
 * tonlama); yoksa ORTAK YEDEK TASARIM (`templates/shared/team-fallback.tsx`) kart boyutunda: KAZANAN takım
 * (beraberlikte ev sahibi — fotoğraf varsayılanıyla aynı kural), arma fotoğrafın yazısız bölgesinde. Gradyan gücü
 * iki yolda da yazı bölgesinin parlaklığından (`legibility.ts`). Gerçek maç fotoğrafı yine önerilir (stüdyo notu).
 */

export interface ResultPhotoSource {
  image: UploadedImage;
}

export interface ResultArtInput {
  facts: Pick<MatchResultFacts, "outcome" | "home" | "away" | "competition">;
  frame: MatchDayFrame;
  template: MatchResultTemplateId;
  accentHex: string;
  /** null → fotoğrafsız yedek tasarım. */
  photo: ResultPhotoSource | null;
  offset?: CropOffset | undefined;
  zoom?: number | undefined;
  upscale?: PhotoUpscaler | undefined;
  /** Yedek tasarımın arması (`data:` URI) — verilmezse takımın logo adresinden çözülür (görsel test sentetik verir). */
  logo?: string | null | undefined;
}

export interface ResultArt {
  art: Buffer;
  shadeStrength: number;
  side: ColumnSide;
  /** Fotoğraf yoksa null. */
  crop: CropPlan | null;
  sharpness: number | null;
  paidCalls: number;
  fallback: boolean;
  /** Stüdyo notları (kalite uyarıları, kırpma, yedek tasarım). */
  notes: string[];
}

export const NO_PHOTO_NOTE = "Maç fotoğrafı yok — fotoğrafsız yedek tasarım çizildi (kazanan takımın rengi ve arması). Gerçek maç fotoğrafı önerilir: arşivden seçin ya da yükleyin.";

/** Saf: yedek tasarımın takımı ve yeri — kazanan (beraberlikte ev sahibi), arma yazısız bölgenin ortasında. */
export function resultFallbackPlan(input: Pick<ResultArtInput, "facts" | "frame" | "template" | "accentHex">): { team: "home" | "away"; hex: string; options: FallbackArtOptions } {
  const team = input.facts.outcome === "AWAY" ? "away" : "home";
  const hex = readableTeamColors(input.facts[team])[0] ?? input.accentHex;
  const safe = matchResultGeometry(input.frame, "right", input.template).photoSafe;
  const landscape = input.frame.orientation === "landscape";
  const focus = { x: (safe.left + safe.right) / 2 / input.frame.width, y: landscape ? 0.42 : Math.min(0.42, (safe.top + (safe.bottom - safe.top) * 0.4) / input.frame.height) };
  return { team, hex, options: { side: landscape ? "home" : "center", focus } };
}

export async function prepareResultArt(input: ResultArtInput): Promise<Result<ResultArt>> {
  if (!input.photo) {
    const plan = resultFallbackPlan(input);
    const team = input.facts[plan.team];
    const art = await renderTeamFallback({ name: team.name, hex: plan.hex, logo: input.logo === undefined ? await resolveImage(team.logoUrl, 600) : input.logo }, input.frame, plan.options);
    const luminance = await textRegionLuminance(art, matchResultGeometry(input.frame, "right", input.template));
    return { ok: true, data: { art, shadeStrength: shadeStrengthFor(luminance), side: "right", crop: null, sharpness: null, paidCalls: 0, fallback: true, notes: [NO_PHOTO_NOTE] } };
  }
  const prepared = await prepareMatchPhoto({
    image: input.photo.image,
    frame: input.frame,
    accentHex: input.accentHex,
    deepHex: COMPETITION_COLORS[input.facts.competition.kind]?.deep,
    template: input.template,
    offset: input.offset,
    zoom: input.zoom,
    upscale: input.upscale,
  });
  if (!prepared.ok) return prepared;
  const photo = prepared.data;
  const notes = [...photo.quality.warnings];
  if (!photo.crop.facesInSafe) notes.push("Yüzler yazısız bölgeye tam sığmadı — kırpmayı elle kaydırmayı deneyin.");
  if (photo.side === "left") notes.push("16:9: özne sağda olduğu için yazı sütunu sola aynalandı.");
  if (photo.quality.upscaled && photo.quality.paidCalls === 0) notes.push("AI büyütme önbellekten");
  return { ok: true, data: { art: photo.art, shadeStrength: photo.shadeStrength, side: photo.side, crop: photo.crop, sharpness: photo.quality.sharpness, paidCalls: photo.quality.paidCalls, fallback: false, notes } };
}
