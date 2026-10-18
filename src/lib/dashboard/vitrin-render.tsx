import { ImageResponse } from "next/og";
import sharp from "sharp";
import { layoutGate } from "@/lib/dashboard/layout-check";
import { loadMatchDayFonts } from "@/lib/dashboard/match-day-assets";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import type { PhotoUpscaler } from "@/lib/dashboard/match-photo/quality";
import { finalizeSetImage } from "@/lib/dashboard/set-finish";
import type { UploadedImage } from "@/lib/dashboard/studio-images";
import { vitrinTextGate } from "@/lib/dashboard/vitrin-card";
import { prepareVitrinArt } from "@/lib/dashboard/vitrin-photo";
import type { BlockFilter, LayoutBlockId } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { vitrinGeometry, type VitrinGeometry } from "@/skills/render-engine/templates/vitrin/geometry";
import type { VitrinLayer } from "@/skills/render-engine/templates/vitrin/parts";
import { VitrinTemplate } from "@/skills/render-engine/templates/vitrin/vitrin-card";
import type { Result } from "@/types/result";
import type { VitrinCard } from "@/types/vitrin";

/**
 * Vitrin kartının çizimi — DB'siz (motor, önizleme, görsel test ve offline script ortak). Sıra:
 * dil kapısı → yerleşim kapısı (bloklar tek tek ölçülür) → sanat (fotoğraf ya da programatik) →
 * ana yazı katmanı + bulanıklaştırılmış yer tutucu katmanı → gren/vinyet (`finalizeSetImage`).
 * Kapılardan biri geçmezse kart üretilmez, sebep yazılır.
 */

export const VITRIN_BLOCKS: readonly LayoutBlockId[] = ["header-label", "header-date", "teams", "open-1", "open-2", "locked", "hook", "footer-text", "footer-logo"];

/** Kilitli kutu yer tutucusunun bulanıklığı (sigma, k = 1). */
const LOCKED_BLUR = 9;

export function geometryFor(card: VitrinCard, frame: MatchDayFrame): VitrinGeometry {
  return vitrinGeometry(frame, [card.open[0].lines.length === 3, card.open[1].lines.length === 3]);
}

export async function renderVitrinLayer(card: VitrinCard, g: VitrinGeometry, layer: VitrinLayer, only?: BlockFilter): Promise<Buffer> {
  const fonts = await loadMatchDayFonts();
  const response = new ImageResponse(<VitrinTemplate card={card} g={g} layer={layer} only={only} />, { width: g.frame.width, height: g.frame.height, fonts });
  return sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().png().toBuffer();
}

/** Ana katman + bulanık yer tutucu (kilitli kutuların cevap alanı) tek şeffaf katmanda. */
export async function renderVitrinOverlay(card: VitrinCard, g: VitrinGeometry): Promise<Buffer> {
  const [main, placeholder] = await Promise.all([renderVitrinLayer(card, g, "main"), renderVitrinLayer(card, g, "placeholder")]);
  const blurred = await sharp(placeholder).blur(Math.max(4, LOCKED_BLUR * g.k)).png().toBuffer();
  return sharp(main).composite([{ input: blurred }]).png().toBuffer();
}

export interface VitrinImageInput {
  card: VitrinCard;
  frame: MatchDayFrame;
  /** Kart için hazırlanmış fotoğraf (arşivin büyütülmüş sürümü); yoksa programatik zemin. */
  image: UploadedImage | null;
  /** Gren tohumu — aynı maç aynı greni alır. */
  seedKey: string;
  upscale?: PhotoUpscaler | undefined;
}

export async function renderVitrinImage(input: VitrinImageInput): Promise<Result<Buffer>> {
  const language = vitrinTextGate(input.card);
  if (language) return { ok: false, error: { code: "BANNED_LANGUAGE", message: `${language} — kart üretilmedi.` } };
  const g = geometryFor(input.card, input.frame);
  const gate = await layoutGate("Vitrin", input.frame, (only) => renderVitrinLayer(input.card, g, "main", only), VITRIN_BLOCKS);
  if (!gate.ok) return gate;
  const art = await prepareVitrinArt({ image: input.image, g, accentHex: input.card.accentHex, upscale: input.upscale });
  if (!art.ok) return art;
  const overlay = await renderVitrinOverlay(input.card, g);
  return { ok: true, data: await finalizeSetImage(art.data, overlay, input.frame, input.seedKey) };
}
