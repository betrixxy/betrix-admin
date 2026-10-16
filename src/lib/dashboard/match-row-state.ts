import type { Fixture } from "@/types/sports";

/**
 * Maç Merkezi satır durumu — `fixture.status.short`'tan. Hangi içerik evresinin açık olduğunu
 * belirler: biten maçta yalnızca maç sonrası, başlamamış maçta yalnızca maç öncesi türler;
 * canlı ve ertelenen/iptal maçta menü pasif. Saf; istemci bileşenleri de kullanır.
 */
export type MatchRowState =
  | { kind: "finished"; phase: "post_match"; score: string }
  | { kind: "upcoming"; phase: "pre_match" }
  | { kind: "live"; phase: null; minute: string | null }
  | { kind: "inactive"; phase: null; label: string };

const FINISHED = new Set(["FT", "AET", "PEN"]);
const UPCOMING = new Set(["NS", "TBD"]);
const LIVE = new Set(["1H", "HT", "2H", "ET", "BT", "P", "LIVE"]);
const INACTIVE_LABELS: Record<string, string> = {
  PST: "Ertelendi",
  CANC: "İptal",
  ABD: "Yarıda kaldı",
  SUSP: "Askıya alındı",
  INT: "Durduruldu",
  AWD: "Hükmen",
  WO: "Hükmen",
  // Kanonik durum (progress yoksa)
  POSTPONED: "Ertelendi",
  CANCELLED: "İptal",
};

/** "2 – 3", penaltıyla bittiyse "2 – 2 (P 4-3)". */
export function formatFinalScore(progress: NonNullable<Fixture["progress"]>): string {
  const score = `${progress.homeGoals ?? 0} – ${progress.awayGoals ?? 0}`;
  return progress.penalty ? `${score} (P ${progress.penalty.home}-${progress.penalty.away})` : score;
}

export function matchRowState(fixture: Pick<Fixture, "status" | "progress">): MatchRowState {
  const progress = fixture.progress;
  // `progress` yoksa (eski kayıt/başka sağlayıcı) kanonik duruma düşülür.
  const short = progress?.statusShort ?? (fixture.status === "SCHEDULED" ? "NS" : fixture.status);

  if (FINISHED.has(short)) return { kind: "finished", phase: "post_match", score: progress ? formatFinalScore(progress) : "Bitti" };
  if (UPCOMING.has(short)) return { kind: "upcoming", phase: "pre_match" };
  if (LIVE.has(short)) {
    const minute = short === "HT" ? "Devre arası" : progress?.elapsed ? `${progress.elapsed}'` : null;
    return { kind: "live", phase: null, minute };
  }
  return { kind: "inactive", phase: null, label: INACTIVE_LABELS[short] ?? "Durum bilinmiyor" };
}

/** Pasif menünün kısa etiketi + ipucu; menü açıksa null. */
export function disabledMenu(state: MatchRowState): { label: string; reason: string } | null {
  if (state.kind === "live") return { label: "Maç bitince açılır", reason: "Maç sürüyor — içerik menüsü maç bitince açılır." };
  if (state.kind === "inactive") return { label: state.label, reason: `${state.label} — bu maç için içerik üretilemez.` };
  return null;
}
