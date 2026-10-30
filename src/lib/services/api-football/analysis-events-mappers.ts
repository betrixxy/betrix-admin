import { countedGoals, formatMinute } from "@/lib/services/api-football/match-result-mappers";
import type { ApiFootballEventRaw, ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { AnalysisEvent, AnalysisEventKind, AnalysisPerson } from "@/types/match-analysis";
import type { MatchSide } from "@/types/match-result";

/**
 * Maç Analizi 01: API-Football olay akışı → sıralı `AnalysisEvent` listesi (saf). Kurallar:
 * - Gol: sayılan goller Maç Sonucu ile AYNI fonksiyondan (`countedGoals`: kaçan penaltı, penaltı atışları ve
 *   VAR'ın iptal ettiği gol düşülür). Kaçan penaltı ayrı olay (skoru değiştirmez). İptal edilen golün yerine
 *   VAR olayı görünür.
 * - (KK) olayın takımına yazılır: API-Football KK olayında `team` alanını golün YAZILDIĞI takımla verir
 *   (Gençlerbirliği 0-1 Galatasaray regresyonu) — taraf çevrilmez, oyuncu rakiptendir.
 * - Kart: sarı, ikinci sarı (kırmızıya döner), kırmızı. Değişiklik: `player` ÇIKAN, `assist` GİREN.
 * - VAR: karar metni kısa Türkçe etikete eşlenir; tanınmayan karar "VAR".
 * - Penaltı atışları (uzatmalardan sonra) zaman çizelgesine girmez.
 * - Sıralama: dakika, sonra uzatma dakikası ("45+2'" 46'dan önce, "90+5'" 90'dan sonra); aynı dakikada
 *   sağlayıcının sırası korunur (kararlı sıralama).
 */

/** VAR karar metni → kısa Türkçe etiket (ilk eşleşen). */
const VAR_LABELS: readonly [RegExp, string][] = [
  [/goal (cancel|disallow)/i, "Gol iptal"],
  [/goal confirm/i, "Gol onaylandı"],
  [/penalty (cancel|overturn|disallow)/i, "Penaltı iptal"],
  [/penalty confirm|penalty awarded/i, "Penaltı verildi"],
  [/card upgrade|red card/i, "Kırmızı kart"],
  [/card (cancel|overturn|downgrade)/i, "Kart iptal"],
];

export const GENERIC_VAR_LABEL = "VAR";

export function varLabel(detail: string | null | undefined): string {
  return VAR_LABELS.find(([pattern]) => pattern.test(detail ?? ""))?.[1] ?? GENERIC_VAR_LABEL;
}

const person = (raw: { id?: number | null | undefined; name?: string | null | undefined } | null | undefined): AnalysisPerson | null => {
  const name = raw?.name?.trim();
  return name ? { playerId: raw?.id ?? null, name } : null;
};

const isShootout = (event: ApiFootballEventRaw) => /penalty shootout/i.test(event.comments ?? "");

function kindOf(event: ApiFootballEventRaw, counted: ReadonlySet<ApiFootballEventRaw>): AnalysisEventKind | null {
  const type = event.type.toLowerCase();
  const detail = event.detail ?? "";
  if (type === "goal") {
    if (/missed penalty/i.test(detail)) return "MISSED_PENALTY";
    if (!counted.has(event)) return null;
    if (/own goal/i.test(detail)) return "OWN_GOAL";
    return /penalty/i.test(detail) ? "PENALTY_GOAL" : "GOAL";
  }
  if (type === "card") {
    if (/second yellow/i.test(detail)) return "SECOND_YELLOW";
    if (/red/i.test(detail)) return "RED";
    return /yellow/i.test(detail) ? "YELLOW" : null;
  }
  if (type === "subst") return "SUBSTITUTION";
  if (type === "var") return "VAR";
  return null;
}

/** Sıralama anahtarı: dakika, uzatma dakikası (yoksa 0). */
export const minuteOrder = (event: Pick<AnalysisEvent, "elapsed" | "extra">) => event.elapsed * 100 + (event.extra ?? 0);

/** Kararlı sıralama — aynı dakikada giriş sırası korunur. */
export function sortEvents<T extends Pick<AnalysisEvent, "elapsed" | "extra">>(events: readonly T[]): T[] {
  return events.map((event, index) => ({ event, index })).sort((a, b) => minuteOrder(a.event) - minuteOrder(b.event) || a.index - b.index).map(({ event }) => event);
}

export function toAnalysisEvents(raw: ApiFootballFixtureResultRaw): AnalysisEvent[] {
  const counted = new Set(countedGoals(raw.events));
  const sideOf = (teamId: number): MatchSide | null => (teamId === raw.teams.home.id ? "HOME" : teamId === raw.teams.away.id ? "AWAY" : null);
  const events: AnalysisEvent[] = [];
  for (const event of raw.events) {
    const side = sideOf(event.team.id);
    const elapsed = event.time.elapsed;
    if (!side || elapsed === null || isShootout(event)) continue;
    const kind = kindOf(event, counted);
    if (!kind) continue;
    const extra = event.time.extra ?? null;
    events.push({
      kind,
      side,
      elapsed,
      extra: extra && extra > 0 ? extra : null,
      minuteLabel: formatMinute(elapsed, extra),
      player: person(event.player),
      related: kind === "SUBSTITUTION" ? person(event.assist) : null,
      varLabel: kind === "VAR" ? varLabel(event.detail) : null,
      score: null,
      breakMoment: null,
    });
  }
  return sortEvents(events);
}
