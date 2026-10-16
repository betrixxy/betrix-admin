import { isFixtureInStudioWindow, MATCH_CENTER_PAST_DAYS } from "@/lib/dashboard/match-center-window";
import { matchRowState } from "@/lib/dashboard/match-row-state";
import { mapApiFootballFixtureToFixture } from "@/lib/services/api-football/mappers";
import { toMatchResultFacts } from "@/lib/services/api-football/match-result-mappers";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import type { MatchResultFacts } from "@/types/match-result";
import type { Result } from "@/types/result";

/**
 * Maç Sonucu stüdyosunun maç doğrulaması — saf. Sıra: maç var mı → maç sonrası penceresinde mi
 * (MATCH_CENTER_PAST_DAYS gün geriye kadar) → bitti mi (FT/AET/PEN). Bitmemiş maçta kart üretilmez.
 */
export function validateMatchResultFixture(raw: ApiFootballFixtureResultRaw | null, now: Date): Result<MatchResultFacts, { message: string }> {
  if (!raw) return { ok: false, error: { message: "Maç API-Football'da bulunamadı." } };

  if (!isFixtureInStudioWindow(raw.fixture.date, "post_match", now)) {
    const days = MATCH_CENTER_PAST_DAYS === 1 ? "dün" : `son ${MATCH_CENTER_PAST_DAYS} gün`;
    return { ok: false, error: { message: `Bu maç Maç Merkezi penceresinin dışında — maç sonrası içerik yalnızca ${days} ve sonrasında oynanan maçlar için üretilir.` } };
  }

  const facts = toMatchResultFacts(raw);
  if (!facts) {
    const state = matchRowState(mapApiFootballFixtureToFixture(raw));
    const status =
      state.kind === "live" ? `canlı${state.minute ? `, ${state.minute}` : ""}` : state.kind === "inactive" ? state.label.toLocaleLowerCase("tr-TR") : "başlamadı";
    return {
      ok: false,
      error: { message: `Maç henüz bitmedi (durum: ${status}). Maç Sonucu kartı yalnızca biten maçlar (FT/AET/PEN) için üretilir.` },
    };
  }
  return { ok: true, data: facts };
}
