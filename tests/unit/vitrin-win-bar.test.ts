import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkLayout, describeLayoutIssues } from "@/lib/dashboard/layout-check";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { buildVitrinCard } from "@/lib/dashboard/vitrin-card";
import { POSTER_BLOCKS, renderVitrinLayer, vitrinGeometries } from "@/lib/dashboard/vitrin-render";
import { scenarioSummary, scenariosFrom } from "@/lib/prediction/internal-source";
import { matchProbabilities } from "@/lib/prediction/poisson";
import { BAR_LABEL_EM, barLabelWidth, winBarColumns } from "@/skills/render-engine/templates/vitrin/win-bar-layout";
import type { PredictionSet } from "@/types/prediction";
import type { VitrinCard } from "@/types/vitrin";

/**
 * Vitrin 01 kazanma çubuğu (canlı test 2026-10-31, Trabzonspor–Gaziantep FK 4:5): %64 / %19 / %17 dağılımında
 * "BERABERLİK" ile "GAZİANTEP FK" birbirine değdi ve kapı GEÇTİ. Sebep: üç etiket (+ üç yüzde) tek blok
 * ("win-bar") olarak tek sınır kutusuyla ölçülüyordu — blok içi çakışma görünmezdi; yerleşim de yalnızca yüzde
 * genişliğini sıkıştırıyordu. Şimdi üç sütun sırayla mürekkep katmanında (stack-a/b) ve sütun genişliği etiketi de kapsar.
 */

function prediction(): PredictionSet {
  const p = matchProbabilities({ home: 1.9, away: 0.7 });
  const scenarios = scenariosFrom(p).map((scenario) => ({ ...scenario, reason: "Trabzonspor son 5 maçında 4 galibiyet aldı." }));
  return { sourceId: "internal", sourceVersion: "test", computedAtUtc: "2026-10-31T10:00:00.000Z", scenarios, ...scenarioSummary(scenarios, p) };
}

async function trabzonGaziantep(): Promise<VitrinCard> {
  const card = buildVitrinCard(
    prediction(),
    { open: ["RESULT_1X2", "BTTS"], locked: ["HT_RESULT", "GOALS_4PLUS", "COMBO"] },
    { sides: { home: "Trabzonspor", away: "Gaziantep FK" }, homeTeamId: 998, awayTeamId: 3573, kickoffUtc: "2026-11-01T16:00:00Z", competitionName: "Trendyol Süper Lig", roundLabel: "10. Hafta", homeForm: ["W", "W", "D", "W", "L"], awayForm: ["L", "D", "W", "L", "D"] },
    { homeLogo: null, awayLogo: null, brandLogo: await loadBrandLogo() },
  );
  // Canlı testteki dağılım birebir.
  return { ...card, winBar: { ...card.winBar, home: 64, draw: 19, away: 17 } };
}

const FRAME = MATCH_DAY_FRAMES.IG_PORTRAIT;

describe("Vitrin kazanma çubuğu etiketleri", () => {
  it("saf yerleşim: %64/%19/%17 + GAZİANTEP FK — üç sütun arasında asgari boşluk", () => {
    const labels: [string, string, string] = ["TRABZONSPOR", "BERABERLİK", "GAZİANTEP FK"];
    const width = 952;
    const columns = winBarColumns({ values: [64, 19, 17], labels, width, drawSegmentCenter: 690, percentSize: 92, labelSize: 22, minLabel: 15, gap: 28 });
    const [home, draw, away] = columns.widths;
    assert.ok(columns.drawLeft >= home + 28, `beraberlik sütunu ev sütununa değiyor (${columns.drawLeft} < ${home + 28})`);
    assert.ok(columns.drawLeft + draw <= width - away - 28, `beraberlik sütunu deplasman sütununa değiyor (${columns.drawLeft + draw} > ${width - away - 28})`);
    assert.equal(columns.labelSize, 22);
    assert.equal(barLabelWidth("BERABERLİK", 22), Math.ceil(10 * 22 * BAR_LABEL_EM));
  });

  it("sütunlar sığmıyorsa etiket puntosu küçülür", () => {
    const columns = winBarColumns({ values: [34, 33, 33], labels: ["ÇOK UZUN BİR TAKIM ADI", "BERABERLİK", "BİR BAŞKA UZUN TAKIM"], width: 700, drawSegmentCenter: 350, percentSize: 92, labelSize: 22, minLabel: 12, gap: 28 });
    assert.ok(columns.labelSize < 22);
    assert.ok(columns.widths[0] + columns.widths[1] + columns.widths[2] + 56 <= 700);
  });

  it("POSTER_BLOCKS sütun katmanlarını ölçer", () => {
    assert.ok(POSTER_BLOCKS.includes("stack-a") && POSTER_BLOCKS.includes("stack-b"));
  });

  it("kapı: canlı testin dağılımı artık temiz geçer", async () => {
    const card = await trabzonGaziantep();
    const { poster } = vitrinGeometries(FRAME);
    const { issues } = await checkLayout(FRAME, (only) => renderVitrinLayer(card, poster, only), POSTER_BLOCKS);
    assert.equal(issues.length, 0, describeLayoutIssues(issues));
  });

  it("kapı: sığmayan etiketler artık YAKALANIR (mürekkep teması, eskiden tek blok olduğu için geçiyordu)", async () => {
    const card = await trabzonGaziantep();
    const long = { ...card, shortTeams: { ...card.shortTeams, home: "TRABZONSPOR FUTBOL İŞLETMECİLİĞİ TİCARET", away: "GAZİANTEP FUTBOL KULÜBÜ ANONİM ŞİRKETİ" } };
    const { poster } = vitrinGeometries(FRAME);
    const { issues } = await checkLayout(FRAME, (only) => renderVitrinLayer(long, poster, only), POSTER_BLOCKS);
    assert.ok(
      issues.some((issue) => issue.kind === "INK_TOUCH" && new Set([issue.a, issue.b]).size === 2 && [issue.a, issue.b].every((id) => id === "stack-a" || id === "stack-b")),
      `beklenen stack-a ↔ stack-b mürekkep teması yok: ${describeLayoutIssues(issues)}`,
    );
  });
});
