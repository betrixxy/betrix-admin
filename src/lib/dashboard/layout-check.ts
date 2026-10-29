import sharp from "sharp";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { INK_LAYERS, LAYOUT_BLOCK_LABELS, LAYOUT_BLOCKS, type LayoutBlockId } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { SAFE_MARGIN, type FrameBox } from "@/skills/render-engine/templates/match-result/geometry";
import type { Result } from "@/types/result";

/**
 * Yerleşim çakışma kontrolü — set kartlarının (01 Maç Sonucu, 02 İstatistikler) KALİTE KAPISI.
 * Satori yerleşim kutusu vermez; bu yüzden her blok aynı yerleşimle tek başına görünür çizilir
 * (`only`, bkz. `checkmatch-set/blocks.ts`) ve opak piksellerinin sınır kutusu ölçülür. Kural:
 * hiçbir blok başka bir blokla çakışmaz ve hiçbiri güvenli kenarın (64px + platform bantları)
 * dışına taşmaz. Ölçü MÜREKKEPTİR (satır kutusu değil): Anton'da Ç/Ş/Ğ kuyruğu satır kutusunun ~0,23 em altına,
 * İ noktası ~0,13 em üstüne taşar — bunlar da sınır kutusuna girer. Bir bloğun içindeki tekrar eden satırlar
 * (liste: ad → alt satır) mürekkep katmanı olarak çizilir ve PİKSEL düzeyinde denetlenir: iki katmanın
 * mürekkebi `INK_CLEARANCE` pikselden yakınsa çakışma. Çakışma varsa kart üretilmez, sebep yazılır.
 * Görsel testte de aynı kontrol koşar (4 format × 01/02 × 3 şablon).
 *
 * KAPSAM: kartın HER öğesi bir bloğa aittir (logo dahil). Sonda bloğuyla (`unassigned`, hiçbir şablon
 * kullanmaz) çizilince bütün bloklar gizlenir; görünen kalan öğe hiçbir bloğa ait değildir ve ölçülmüyordur
 * → `UNMEASURED`. Zemin ve süsler (gradyan, ışıma, saha çizgileri) ölçüm sırasında gizlenir (`only ? 0 : 1`).
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
  | { kind: "OUTSIDE_SAFE"; a: LayoutBlockId; by: number }
  | { kind: "INK_TOUCH"; a: LayoutBlockId; b: LayoutBlockId; pixels: number; x: number; y: number }
  | { kind: "UNMEASURED"; left: number; top: number; right: number; bottom: number };

/** Sonda bloğu (bkz. KAPSAM). */
export const UNASSIGNED_PROBE: LayoutBlockId = "unassigned";

/** Gölge/ışıma (glow) gibi yarı saydam kenarlar ölçülmez — yalnızca belirgin pikseller. */
const ALPHA_THRESHOLD = 64;
/** Kenar yumuşatma ve yuvarlama payı (px). */
const TOLERANCE = 2;
/** Mürekkep katmanları arasında bırakılması gereken asgari boşluk (px, 1080 genişlikte okunur bir ara). */
export const INK_CLEARANCE = 4;

/** Kartın güvenli alanı: 64px kenar + 9:16 platform bantları. */
export function layoutSafeArea(frame: Pick<MatchDayFrame, "width" | "height" | "safeTop" | "safeBottom">): FrameBox {
  return { left: SAFE_MARGIN, top: frame.safeTop + SAFE_MARGIN, right: frame.width - SAFE_MARGIN, bottom: frame.height - frame.safeBottom - SAFE_MARGIN };
}

/**
 * Kendi kenar boşluğu set kartlarından dar olan kartların (Maç Günü, Muhtemel 11, lig kartları) güvenli alanı:
 * platform bantları (9:16) + `margin` px kenar. Kapı bunlarda asıl olarak blok çakışmasını denetler.
 */
export function bandSafeArea(frame: Pick<MatchDayFrame, "width" | "height" | "safeTop" | "safeBottom">, margin = 24): FrameBox {
  return { left: margin, top: frame.safeTop + margin, right: frame.width - margin, bottom: frame.height - frame.safeBottom - margin };
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
        : issue.kind === "INK_TOUCH"
          ? `${LAYOUT_BLOCK_LABELS[issue.a]} ↔ ${LAYOUT_BLOCK_LABELS[issue.b]} mürekkebi birbirine ${INK_CLEARANCE}px'ten yakın (${issue.pixels} piksel, ilk: x${issue.x} y${issue.y})`
          : issue.kind === "UNMEASURED"
            ? `${LAYOUT_BLOCK_LABELS[UNASSIGNED_PROBE]} ölçülmüyor (x${issue.left}–${issue.right}, y${issue.top}–${issue.bottom})`
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

/** Her bloğu tek başına çizip ölçer; görünmeyen (boş) bloklar ve mürekkep katmanları atlanır. */
export async function measureBlocks(render: (only: LayoutBlockId) => Promise<Buffer>, blocks: readonly LayoutBlockId[] = LAYOUT_BLOCKS): Promise<BlockBox[]> {
  const measured = await Promise.all(blocks.filter((id) => !INK_LAYERS.has(id) && id !== UNASSIGNED_PROBE).map(async (id) => ({ id, bounds: await opaqueBounds(await render(id)) })));
  return measured.flatMap(({ id, bounds }) => (bounds ? [{ id, ...bounds }] : []));
}

export interface InkMask {
  id: LayoutBlockId;
  width: number;
  height: number;
  /** 1 = belirgin mürekkep (alfa ≥ eşik). */
  data: Uint8Array;
}

export async function inkMask(id: LayoutBlockId, png: Buffer): Promise<InkMask> {
  const { data, info } = await sharp(png).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const mask = new Uint8Array(info.width * info.height);
  for (let i = 0; i < mask.length; i++) mask[i] = (data[i] ?? 0) >= ALPHA_THRESHOLD ? 1 : 0;
  return { id, width: info.width, height: info.height, data: mask };
}

/** Maskeyi `radius` piksel genişletir (kare komşuluk; yatay sonra dikey koşu). */
export function dilate(mask: InkMask, radius: number): Uint8Array {
  const { width, height, data } = mask;
  const horizontal = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    let last = -Infinity;
    for (let x = 0; x < width; x++) if (data[y * width + x]) last = x; else if (x - last <= radius) horizontal[y * width + x] = 1;
    last = Infinity;
    for (let x = width - 1; x >= 0; x--) {
      const i = y * width + x;
      if (data[i]) { last = x; horizontal[i] = 1; } else if (last - x <= radius) horizontal[i] = 1;
    }
  }
  const out = new Uint8Array(data.length);
  for (let x = 0; x < width; x++) {
    let last = -Infinity;
    for (let y = 0; y < height; y++) if (horizontal[y * width + x]) { last = y; out[y * width + x] = 1; } else if (y - last <= radius) out[y * width + x] = 1;
    last = Infinity;
    for (let y = height - 1; y >= 0; y--) if (horizontal[y * width + x]) last = y; else if (last - y <= radius) out[y * width + x] = 1;
  }
  return out;
}

/** Saf: katman çiftlerinde mürekkep teması (biri `clearance` kadar genişletilir). */
export function findInkTouches(masks: InkMask[], clearance = INK_CLEARANCE): LayoutIssue[] {
  const issues: LayoutIssue[] = [];
  masks.forEach((a, index) => {
    const grown = dilate(a, clearance);
    for (const b of masks.slice(index + 1)) {
      let pixels = 0;
      let first = -1;
      for (let i = 0; i < b.data.length; i++) {
        if (!b.data[i] || !grown[i]) continue;
        pixels += 1;
        if (first < 0) first = i;
      }
      if (pixels > 0) issues.push({ kind: "INK_TOUCH", a: a.id, b: b.id, pixels, x: first % b.width, y: Math.floor(first / b.width) });
    }
  });
  return issues;
}

async function measureLayers(render: (only: LayoutBlockId) => Promise<Buffer>, blocks: readonly LayoutBlockId[]): Promise<InkMask[]> {
  const layers = blocks.filter((id) => INK_LAYERS.has(id));
  return Promise.all(layers.map(async (id) => inkMask(id, await render(id))));
}

export interface LayoutReport {
  boxes: BlockBox[];
  issues: LayoutIssue[];
}

export async function checkLayout(
  frame: Pick<MatchDayFrame, "width" | "height" | "safeTop" | "safeBottom">,
  render: (only: LayoutBlockId) => Promise<Buffer>,
  blocks: readonly LayoutBlockId[] = LAYOUT_BLOCKS,
  /** Kartın güvenli alanı (verilmezse set kartlarınınki: 64px + bantlar). */
  safe: FrameBox = layoutSafeArea(frame),
): Promise<LayoutReport> {
  // Sonda yalnızca kutu bloğu ölçülen çağrıda: salt mürekkep katmanı düzeneğinde (birim test) kapsayıcı blok yoktur.
  const probe = blocks.some((id) => !INK_LAYERS.has(id) && id !== UNASSIGNED_PROBE);
  const [boxes, layers, residual] = await Promise.all([measureBlocks(render, blocks), measureLayers(render, blocks), probe ? render(UNASSIGNED_PROBE).then(opaqueBounds) : null]);
  const unmeasured: LayoutIssue[] = residual ? [{ kind: "UNMEASURED", ...residual }] : [];
  return { boxes, issues: [...findLayoutIssues(boxes, safe), ...findInkTouches(layers), ...unmeasured] };
}

/** Üretim kapısı: çakışma varsa kart üretilmez, sebep yazılır. */
export async function layoutGate(
  label: string,
  frame: Pick<MatchDayFrame, "width" | "height" | "safeTop" | "safeBottom" | "ratioLabel">,
  render: (only: LayoutBlockId) => Promise<Buffer>,
  /** Kartın blokları (verilmezse hepsi; olmayan blok boş çizilir ve atlanır). */
  blocks: readonly LayoutBlockId[] = LAYOUT_BLOCKS,
  safe?: FrameBox,
): Promise<Result<LayoutReport>> {
  const report = await checkLayout(frame, render, blocks, safe);
  if (report.issues.length === 0) return { ok: true, data: report };
  return {
    ok: false,
    error: { code: "LAYOUT_OVERLAP", message: `${label} (${frame.ratioLabel}) yerleşimi bozuk — kart üretilmedi: ${describeLayoutIssues(report.issues)}.` },
  };
}
