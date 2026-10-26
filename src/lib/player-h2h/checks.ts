import type { H2HPosition, PlayerSeasonStats } from "@/types/player-h2h";
import type { Result } from "@/types/result";
import { POSITION_LABELS, SMALL_SAMPLE_MINUTES } from "./stats";

/**
 * Karşılaştırmanın kapıları ve uyarıları — saf. Kaleci ile saha oyuncusu karşılaştırılmaz (ret);
 * farklı mevki, farklı lig ve küçük örneklem stüdyoda tek satır uyarıdır (kart üretilir).
 */

type Player = Pick<PlayerSeasonStats, "shortName" | "position" | "minutes" | "league" | "scope" | "seasonLabel" | "freshness">;

const dayMonth = new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit" });
/** "2026-10-26T16:00:00Z" → "26.10" (İstanbul; tr-TR yalnız gün+ay'da "26/10" verir, parçalardan kurulur). */
export function asOfDay(iso: string): string {
  const parts = dayMonth.formatToParts(new Date(iso));
  const part = (type: "day" | "month") => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}.${part("month")}`;
}

/** Künyenin güncellik parçası: "26.10 İTİBARIYLA"; iki oyuncu farklıysa ikisi ("26.10 / 25.10"); bilinmiyorsa boş. */
export function freshnessLabel(left: Player, right: Player): string {
  const [a, b] = [left.freshness.asOfUtc, right.freshness.asOfUtc];
  if (!a || !b) return "";
  const [x, y] = [asOfDay(a), asOfDay(b)];
  return `${x === y ? x : `${x} / ${y}`} İTİBARIYLA`;
}

export const DIFFERENT_LEAGUES_WARNING = "Farklı ligler: istatistikler doğrudan karşılaştırılamaz";

/** Karşılaştırmanın mevkisi (öncelik listesi soldaki oyuncunun mevkisinden); kaleci × saha oyuncusu ret. */
export function comparisonPosition(left: Player, right: Player): Result<H2HPosition> {
  const keepers = [left.position, right.position].filter((position) => position === "GK").length;
  if (keepers === 1) {
    return { ok: false, error: { code: "GK_VS_OUTFIELD", message: "Kaleci ile saha oyuncusu karşılaştırılamaz — iki kaleci ya da iki saha oyuncusu seçin." } };
  }
  return { ok: true, data: left.position };
}

export function comparisonWarnings(left: Player, right: Player): string[] {
  const warnings: string[] = [];
  if (left.position !== right.position) {
    warnings.push(`Farklı mevkiler (${POSITION_LABELS[left.position]} – ${POSITION_LABELS[right.position]}): öncelik ${left.shortName} için (${POSITION_LABELS[left.position].toLocaleLowerCase("tr-TR")})`);
  }
  if (left.league.id !== right.league.id) warnings.push(DIFFERENT_LEAGUES_WARNING);
  const small = [left, right].filter((player) => player.minutes < SMALL_SAMPLE_MINUTES);
  if (small.length) warnings.push(`Küçük örneklem: ${small.map((player) => `${player.shortName} ${player.minutes} dk`).join(", ")} (${SMALL_SAMPLE_MINUTES} dakikanın altında)`);
  const unknown = [left, right].filter((player) => !player.freshness.asOfUtc);
  if (unknown.length) warnings.push(`Güncellik tarihi bilinmiyor: ${unknown.map((player) => player.shortName).join(", ")}`);
  else if (asOfDay(left.freshness.asOfUtc ?? "") !== asOfDay(right.freshness.asOfUtc ?? "")) {
    warnings.push(`Güncellik farklı: ${left.shortName} ${asOfDay(left.freshness.asOfUtc ?? "")}, ${right.shortName} ${asOfDay(right.freshness.asOfUtc ?? "")} itibarıyla`);
  }
  for (const player of [left, right]) {
    if (player.freshness.source === "sportmonks") warnings.push(`${player.shortName}: bütün satırlar Sportmonks'tan (${player.freshness.note ?? "API-Football güncellenemedi"})`);
  }
  return warnings;
}

/** Künyenin kapsamı: "2026/27 · SÜPER LİG", "2026/27 · TÜM TURNUVALAR", farklı liglerde iki lig birden. */
export function scopeLabel(left: Player, right: Player): string {
  const seasons = [...new Set([left.seasonLabel, right.seasonLabel])].join(" / ");
  if (left.scope === "ALL") return `${seasons} · TÜM TURNUVALAR`;
  const leagues = [...new Set([left.league.label, right.league.label])].join(" / ");
  return `${seasons} · ${leagues}`;
}
