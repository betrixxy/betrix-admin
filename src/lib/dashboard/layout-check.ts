import sharp from "sharp";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { LAYOUT_BLOCK_LABELS, LAYOUT_BLOCKS, type LayoutBlockId } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { SAFE_MARGIN, type FrameBox } from "@/skills/render-engine/templates/match-result/geometry";
import type { Result } from "@/types/result";

/**
 * Yerleşim çakışma kontrolü — set kartlarının (01 Maç Sonucu, 02 İstatistikler) KALİTE KAPISI.
 * Satori yerleşim kutusu vermez; bu yüzden her blok aynı yerleşimle tek başına görünür çizilir
 * (`only`, bkz. `checkmatch-set/blocks.ts`) ve opak piksellerinin sınır kutusu ölçülür. Kural:
 * hiçbir blok başka bir blokla çakışmaz ve hiçbiri güvenli kenarın (64px + platform bantları)
 * dışına taşmaz. Çakışma varsa kart üretilmez, sebep (hangi bloklar, kaç piksel) yazılır.
 * Görsel testte de aynı kontrol koşar (4 format × 01/02 × 3 şablon).
 */

export interface BlockBox {
  id: LayoutBlockId;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export type LayoutIssue =
  | { kind: "OVERLAP"; a: LayoutBlockId; b: LayoutBlockId; width: number; height: number }
  | { kind: "OUTSIDE_SAFE"; a: LayoutBlockId; by: number };

/** Gölge/ışıma (glow) gibi yarı saydam kenarlar ölçülmez — yalnızca belirgin pikseller. */
const ALPHA_THRESHOLD = 64;
/** Kenar yumuşatma ve yuvarlama payı (px). */
const TOLERANCE = 2;

/** Kartın güvenli alanı: 64px kenar + 9:16 platform bantları. */
export function layoutSafeArea(frame: MatchDayFrame): FrameBox {
  return { left: SAFE_MARGIN, top: frame.safeTop + SAFE_MARGIN, right: frame.width - SAFE_MARGIN, bottom: frame.height - frame.safeBottom - SAFE_MARGIN };
}

/** Saf: kutular arası çakışmalar + güvenli alan taşmaları. */
export function findLayoutIssues(boxes: BlockBox[], safe: FrameBox, tolerance = TOLERANCE): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  boxes.forEach((a, index) => {
    const by = Math.max(safe.left - a.left, safe.top - a.top, a.right - safe.right, a.bottom - safe.bottom);
    if (by > tolerance) issues.push({ kind: "OUTSIDE_SAFE", a: a.id, by: Math.round(by) });
    for (const b of boxes.slice(index + 1)) {
      const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (width > tolerance && height > tolerance) issues.push({ kind: "OVERLAP", a: a.id, b: b.id, width: Math.round(width), height: Math.round(height) });
    }
  });
  return issues;
}

export function describeLayoutIssues(issues: LayoutIssue[]): string {
  return issues
    .map((issue) =>
      issue.kind === "OVERLAP"
        ? `${LAYOUT_BLOCK_LABELS[issue.a]} ↔ ${LAYOUT_BLOCK_LABELS[issue.b]} çakışıyor (${issue.width}×${issue.height}px)`
        : `${LAYOUT_BLOCK_LABELS[issue.a]} güvenli kenarı ${issue.by}px aşıyor`,
    )
    .join("; ");
}

/** PNG'nin belirgin (alfa ≥ eşik) piksellerinin sınır kutusu; boşsa null. */
export async function opaqueBounds(png: Buffer): Promise<Omit<BlockBox, "id"> | null> {
  const { data, info } = await sharp(png).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y++) {
    const row = y * info.width;
    for (let x = 0; x < info.width; x++) {
      if ((data[row + x] ?? 0) < ALPHA_THRESHOLD) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  return right < 0 ? null : { left, top, right: right + 1, bottom: bottom + 1 };
}

/** Her bloğu tek başına çizip ölçer; görünmeyen (boş) bloklar atlanır. */
export async function measureBlocks(render: (only: LayoutBlockId) => Promise<Buffer>, blocks: readonly LayoutBlockId[] = LAYOUT_BLOCKS): Promise<BlockBox[]> {
  const measured = await Promise.all(blocks.map(async (id) => ({ id, bounds: await opaqueBounds(await render(id)) })));
  return measured.flatMap(({ id, bounds }) => (bounds ? [{ id, ...bounds }] : []));
}

export interface LayoutReport {
  boxes: BlockBox[];
  issues: LayoutIssue[];
}

export async function checkLayout(frame: MatchDayFrame, render: (only: LayoutBlockId) => Promise<Buffer>): Promise<LayoutReport> {
  const boxes = await measureBlocks(render);
  return { boxes, issues: findLayoutIssues(boxes, layoutSafeArea(frame)) };
}

/** Üretim kapısı: çakışma varsa kart üretilmez, sebep yazılır. */
export async function layoutGate(label: string, frame: MatchDayFrame, render: (only: LayoutBlockId) => Promise<Buffer>): Promise<Result<LayoutReport>> {
  const report = await checkLayout(frame, render);
  if (report.issues.length === 0) return { ok: true, data: report };
  return {
    ok: false,
    error: { code: "LAYOUT_OVERLAP", message: `${label} (${frame.ratioLabel}) yerleşimi bozuk — kart üretilmedi: ${describeLayoutIssues(report.issues)}.` },
  };
}
