import assert from "node:assert/strict";
import { layoutSafeArea, type BlockBox } from "@/lib/dashboard/layout-check";
import type { MatchDayFrame } from "@/lib/dashboard/match-day-formats";
import { balanceProblem, verticalGaps } from "@/skills/render-engine/templates/shared/vertical-balance";

/**
 * Dikey denge ölçümü (canlı test 2026-10-31: Story ve Tahmin Karnesi'nde alt bant boş). Yerleşim kapısının
 * blok kutularından: künye bloklarının (künye yazısı, logo, dipnot) üstündeki içerik birleşimi ile künye
 * arasındaki boşluk, güvenli alanın tepesi ile ilk içerik arasındaki boşluğa oranla sınırlı
 * (`shared/vertical-balance.ts::balanceProblem`). 16:9 ölçülmez (yan yana sütunlar).
 */
const FOOTER_BLOCKS = new Set(["footer-text", "footer-logo", "footnote"]);

export function assertVerticalBalance(label: string, frame: MatchDayFrame, boxes: readonly BlockBox[]): void {
  if (frame.orientation === "landscape") return;
  const footer = boxes.filter((box) => FOOTER_BLOCKS.has(box.id));
  const content = boxes.filter((box) => !FOOTER_BLOCKS.has(box.id) && box.id !== "header-label" && box.id !== "header-date");
  if (footer.length === 0 || content.length === 0) return;
  const safe = layoutSafeArea(frame);
  const header = boxes.filter((box) => box.id === "header-label" || box.id === "header-date");
  // Üst etiket satırı (01 — …, tarih) güvenli alanın tepesine sabittir; ölçüm onun altından başlar.
  const from = header.length ? Math.max(...header.map((box) => box.bottom)) : safe.top;
  const gaps = verticalGaps(content, Math.min(...footer.map((box) => box.top)), from);
  const problem = balanceProblem(gaps, safe.bottom - safe.top);
  if (process.env.BALANCE_REPORT === "1") {
    console.log(`BALANCE ${label} üst=${Math.round(gaps.top)} alt=${Math.round(gaps.bottom)} ${problem ?? "OK"}`);
    return;
  }
  assert.equal(problem, null, `${label}: dikey denge — ${problem}`);
}
