import type { ReelsCheck, ReelsMatchDetail } from "@/lib/services/reels-schema";

/**
 * Sahne uygunluğu — dondurulmuş yanıttan hangi sahnelerin kullanılabileceği. Saf fonksiyon; sonuç
 * `ReelSnapshot.sceneAvailability`'e yazılır, video her zaman dondurulmuş rakamları gösterir.
 */

export const REEL_SCENE_IDS = ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"] as const;
export type ReelSceneId = (typeof REEL_SCENE_IDS)[number];

export const REEL_SCENE_LABELS: Record<ReelSceneId, string> = {
  M1: "Kanca",
  M2: "En olası skor",
  M3: "Kim kazanır",
  M4: "3+ gol",
  M5: "İki takım da gol",
  M6: "İlk gol",
  M7: "Golcü adayı",
  M8: "Form",
  M9: "Kafa kafaya",
};

export interface ReelSceneState {
  available: boolean;
  reason: string;
}

export interface ReelSceneAvailability {
  scenes: Record<ReelSceneId, ReelSceneState>;
  /** Proje genelinde sarı uyarılar. */
  warnings: string[];
}

const MIN_FORM_MATCHES = 3;
const MIN_H2H_MATCHES = 3;

/** Bu kontroller geçmezse veri kullanılamaz; diğerleri sahne bazında ya da yalnız bilgi amaçlıdır. */
const CORE_CHECKS = ["outcome_sum", "probabilities_in_range", "score_distribution_aligned"] as const;

const ready = (reason = "Veri hazır"): ReelSceneState => ({ available: true, reason });
const blocked = (reason: string): ReelSceneState => ({ available: false, reason });

function checkOf(checks: readonly ReelsCheck[], name: string): ReelsCheck | undefined {
  return checks.find((check) => check.name === name);
}

const formMatches = (form: string | null): number => form?.length ?? 0;

export function reelSceneAvailability(detail: ReelsMatchDetail): ReelSceneAvailability {
  const { checks } = detail.quality;
  const hasLeaders = detail.season_xg_leaders.home.length > 0 || detail.season_xg_leaders.away.length > 0;
  const firstGoal = detail.first_goal;
  const formCount = Math.min(formMatches(detail.form.home), formMatches(detail.form.away));
  const played = detail.h2h.played;

  const m7 = (): ReelSceneState => {
    if (!hasLeaders) return blocked("Bu takımlar için sezon xG verisi yok");
    if (checkOf(checks, "season_xg_fresh")?.ok !== true) return blocked("Sezon xG verisi güncel değil");
    return ready();
  };

  const scenes: Record<ReelSceneId, ReelSceneState> = {
    M1: detail.model.simulations !== null ? ready() : blocked("Simülasyon sayısı yok"),
    M2: detail.score_scene_allowed ? ready() : blocked("Skor dağılımı diğer sahnelerle çelişiyor"),
    M3: ready(),
    M4: detail.goals.three_plus !== null ? ready() : blocked("3+ gol verisi yok"),
    M5: detail.both_score !== null ? ready() : blocked("İki takım da gol verisi yok"),
    M6: firstGoal.home !== null && firstGoal.away !== null && firstGoal.none !== null ? ready() : blocked("İlk gol verisi eksik"),
    M7: m7(),
    M8: formCount >= MIN_FORM_MATCHES ? ready() : blocked(`Form için en az ${MIN_FORM_MATCHES} maç gerekli (${formCount})`),
    M9: played !== null && played >= MIN_H2H_MATCHES ? ready() : blocked(`Kafa kafaya en az ${MIN_H2H_MATCHES} maç gerekli (${played ?? 0})`),
  };

  const warnings = checkOf(checks, "computed_at_fresh")?.ok === false ? ["Model hesabı 72 saatten eski: yeniden dondurmadan önce kontrol edin."] : [];
  return { scenes, warnings };
}

/** Çekirdek kalite: sonuç toplamı, olasılık aralığı ve skor hizalaması. Eksik kontrol geçmemiş sayılır. */
export function reelQualityOk(detail: ReelsMatchDetail): boolean {
  return CORE_CHECKS.every((name) => checkOf(detail.quality.checks, name)?.ok === true);
}

/** Kalite kontrollerinin ekrandaki adı. Sözleşmedeki kontrol adı arayüze çıkmaz. */
const CHECK_LABELS: Record<string, string> = {
  outcome_sum: "Sonuç olasılıkları toplamı",
  probabilities_in_range: "Olasılıklar 0–1 arasında",
  computed_at_fresh: "Hesap güncel (72 saat)",
  score_distribution_aligned: "Skor dağılımı sonuçla hizalı",
  models_disagree: "Modeller uyumlu",
  scene_both_score_close: "Skor matrisi: iki takım da gol",
  scene_three_plus_close: "Skor matrisi: 3+ gol",
  scene_nil_nil_within_first_goal: "Skor matrisi: 0-0 ile ilk gol",
  player_data_fresh: "Kadro verisi güncel",
  scorer_value_within_team_chance: "Oyuncu değeri takım değerini aşmıyor",
  season_xg_fresh: "Sezon xG verisi güncel (10 gün)",
};

export const reelCheckLabel = (name: string): string => CHECK_LABELS[name] ?? "Diğer kontrol";
