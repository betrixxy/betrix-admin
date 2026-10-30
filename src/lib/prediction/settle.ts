import type { ScenarioOutcome, SideOutcome } from "@/types/prediction";
import type { FixtureScore, Goals, Settlement } from "@/types/prediction-scorecard";

/**
 * Tahmin Karnesi değerlendiricisi (saf) — makine okunur sonuç (`ScenarioOutcome`) + maç skoru → tuttu /
 * tutmadı / sonuçlanmadı. `PredictionRecord`'a hiçbir şey yazılmaz; sonuç `PredictionOutcome`'a ayrı satır.
 *
 * Skor kuralı: NORMAL SÜRE (90 dk + uzatma dakikaları) — API-Football `score.fulltime`. Uzatma (AET) ve
 * penaltı (PEN) golleri sayılmaz: senaryolar 90 dakikalık maç için hesaplandı (Poisson modeli 90 dk). Örnek:
 * 1–1 biten, uzatmada 2–1 kazanılan maçta "Kazanma" cevabı Beraberlik ise TUTTU. İlk yarı senaryosu
 * (`HT_RESULT`) yalnızca ilk yarı skoruyla (`score.halftime`).
 *
 * Durumlar: FT / AET / PEN → değerlendirilir. PST (ertelendi), CANC (iptal), ABD (yarıda kaldı), SUSP (askıya
 * alındı), AWD (hükmen), WO (rakip çıkmadı) → SONUÇLANMADI (VOID, karneye girmez — hükmen skor sahada
 * oynanmadı). Diğer her şey (NS, TBD, 1H, HT, 2H, ET, BT, P, INT, LIVE, bilinmeyen kod) → henüz
 * değerlendirilemez (PENDING); INT (kısa kesinti) maç sürdüğü için VOID değildir.
 */

/** Kural değişirse artar; eski sonuçlar yeniden değerlendirilince yeni revizyon yazılır. */
export const EVALUATOR_VERSION = "karne-v1";

export const FINISHED_STATUSES: ReadonlySet<string> = new Set(["FT", "AET", "PEN"]);
export const VOID_STATUSES: Readonly<Record<string, string>> = {
  PST: "Maç ertelendi",
  CANC: "Maç iptal edildi",
  ABD: "Maç yarıda kaldı",
  SUSP: "Maç askıya alındı",
  AWD: "Maç hükmen sonuçlandı",
  WO: "Rakip sahaya çıkmadı",
};

/** Skorun tarafı: ev sahibi önde → HOME, eşit → DRAW, deplasman önde → AWAY. */
export function sideOf(score: Goals): SideOutcome {
  return score.home > score.away ? "HOME" : score.home < score.away ? "AWAY" : "DRAW";
}

/** Saf: seçilen sonuç bu skorla gerçekleşti mi? (Skor, senaryonun okuduğu skor: ilk yarı ya da normal süre.) */
export function outcomeHappened(outcome: ScenarioOutcome, score: Goals): boolean {
  const total = score.home + score.away;
  const yes = (happened: boolean) => (outcome.pick === "YES" ? happened : !happened);
  switch (outcome.scenario) {
    case "RESULT_1X2":
    case "HT_RESULT":
      return sideOf(score) === outcome.pick;
    case "BTTS":
      return yes(score.home > 0 && score.away > 0);
    case "GOALS_3PLUS":
      return yes(total >= 3);
    case "GOALS_4PLUS":
      return yes(total >= 4);
    case "COMBO":
      return yes(sideOf(score) === outcome.team && total >= 3);
  }
}

/** Değerlendirme: durum → VOID / PENDING, bitmiş maçta senaryonun skoruyla HIT / MISS. */
export function settleOutcome(outcome: ScenarioOutcome, fixture: FixtureScore): Settlement {
  const status = fixture.statusShort.trim().toUpperCase();
  const voided = VOID_STATUSES[status];
  if (voided) return { kind: "VOID", status: "VOID", reason: `${voided} — sonuçlanmadı, karneye girmez.` };
  if (!FINISHED_STATUSES.has(status)) return { kind: "PENDING", reason: `Maç bitmedi (${status || "durum yok"}) — henüz değerlendirilemez.` };
  const basis = outcome.scenario === "HT_RESULT" ? "HALFTIME" : "FULLTIME";
  const score = basis === "HALFTIME" ? fixture.halftime : fixture.fulltime;
  if (!score) return { kind: "PENDING", reason: basis === "HALFTIME" ? "İlk yarı skoru yok — değerlendirilemez." : "Normal süre skoru yok — değerlendirilemez." };
  return { kind: "SETTLED", status: outcomeHappened(outcome, score) ? "HIT" : "MISS", basis, score };
}

/** `PredictionOutcome`'a eklenecek satır (Prisma girdisiyle aynı alanlar). */
export interface OutcomeRowInput {
  predictionRecordId: string;
  fixtureId: string;
  revision: number;
  status: "HIT" | "MISS" | "VOID";
  fixtureStatus: string;
  kickoffAt: Date;
  homeGoals: number | null;
  awayGoals: number | null;
  htHomeGoals: number | null;
  htAwayGoals: number | null;
  evaluatorVersion: string;
  note: string | null;
}

type LatestOutcome = Pick<OutcomeRowInput, "revision" | "status" | "fixtureStatus" | "homeGoals" | "awayGoals" | "htHomeGoals" | "htAwayGoals" | "evaluatorVersion">;

const scoreText = (home: number | null, away: number | null) => (home === null || away === null ? "—" : `${home}–${away}`);

/**
 * Yazılacak sonuç satırı (yalnızca ekleme). Değerlendirilemiyorsa (PENDING) ya da son revizyonla aynıysa
 * null — tekrar yazılmaz. Skor düzeltmesi, durum değişikliği ya da yeni değerlendirici sürümü → `revision + 1`
 * ve eski satır yerinde kalır (denetim izi); karne en yüksek revizyonu okur.
 */
export function outcomeRowFor(
  record: { id: string; fixtureId: string; outcome: ScenarioOutcome },
  fixture: FixtureScore & { kickoffUtc: string },
  latest: LatestOutcome | null,
): OutcomeRowInput | null {
  const settlement = settleOutcome(record.outcome, fixture);
  if (settlement.kind === "PENDING") return null;
  const settled = settlement.kind === "SETTLED";
  const row: OutcomeRowInput = {
    predictionRecordId: record.id,
    fixtureId: record.fixtureId,
    revision: (latest?.revision ?? 0) + 1,
    status: settlement.status,
    fixtureStatus: fixture.statusShort.trim().toUpperCase(),
    kickoffAt: new Date(fixture.kickoffUtc),
    homeGoals: settled ? (fixture.fulltime?.home ?? null) : null,
    awayGoals: settled ? (fixture.fulltime?.away ?? null) : null,
    htHomeGoals: settled ? (fixture.halftime?.home ?? null) : null,
    htAwayGoals: settled ? (fixture.halftime?.away ?? null) : null,
    evaluatorVersion: EVALUATOR_VERSION,
    note: settlement.kind === "VOID" ? settlement.reason : null,
  };
  if (!latest) return row;
  const same = (["status", "fixtureStatus", "homeGoals", "awayGoals", "htHomeGoals", "htAwayGoals", "evaluatorVersion"] as const).every((key) => latest[key] === row[key]);
  if (same) return null;
  const correction = `Düzeltme (rev. ${latest.revision} → ${row.revision}): ${latest.status} ${scoreText(latest.homeGoals, latest.awayGoals)} → ${row.status} ${scoreText(row.homeGoals, row.awayGoals)}`;
  return { ...row, note: row.note ? `${correction} · ${row.note}` : correction };
}
