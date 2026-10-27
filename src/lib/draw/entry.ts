import { cardTeamName } from "@/lib/archive/names";
import type { DrawEdit, DrawState, DrawTeam, KnockoutTie, LeagueFixture } from "@/types/draw";

/**
 * Kura eşleşme girişi — saf, istemcide de çalışır (her girişte önizleme anında güncellenir). Kurallar:
 * eleme turunda bir takım yalnızca bir eşleşmede; lig aşamasında takım başına en fazla N rakip (ŞL/AL 8,
 * KL 6), aynı rakip iki kez yok, takım kendisiyle eşleşmez. Eksik giriş geçerlidir (kart girilenlerle).
 */

/** Konferans Ligi lig aşamasında 6 rakip, diğerlerinde 8. */
export function leagueOpponentLimit(competitionId: number): number {
  return competitionId === 848 ? 6 : 8;
}

/** Kart adı (büyük harfe çevrilmeden): admin düzeltmesi > yayıncı adı tablosu > Türkçe eşleme > API adı. */
export function drawTeamName(state: Pick<DrawState, "teams" | "nameOverrides">, id: number): string {
  const override = state.nameOverrides[id]?.trim();
  if (override) return override;
  const team = state.teams.find((entry) => entry.id === id);
  return team ? cardTeamName(team.apiName) : String(id);
}

const fail = (error: string): DrawEdit => ({ ok: false, error });

export function emptyDraw(init: Pick<DrawState, "competition" | "season" | "roundLabel" | "stage" | "drawDateUtc"> & { teams?: DrawTeam[] }): DrawState {
  return { ...init, teams: init.teams ?? [], ties: [], fixtures: [], nameOverrides: {} };
}

function known(state: DrawState, ...ids: number[]): string | null {
  const unknown = ids.find((id) => !state.teams.some((team) => team.id === id));
  return unknown === undefined ? null : `Takım ${unknown} katılımcı listesinde yok — önce torbalara/katılımcılara ekleyin.`;
}

/** Eleme eşleşmesi ekler: `first` ilk maçın ev sahibi. */
export function addTie(state: DrawState, tie: KnockoutTie): DrawEdit {
  if (state.stage !== "KNOCKOUT") return fail("Bu tur lig aşaması — eşleşme değil rakip girin.");
  if (tie.first === tie.second) return fail("Takım kendisiyle eşleşemez.");
  const missing = known(state, tie.first, tie.second);
  if (missing) return fail(missing);
  const used = [tie.first, tie.second].find((id) => state.ties.some((t) => t.first === id || t.second === id));
  if (used !== undefined) return fail(`${drawTeamName(state, used)} zaten bir eşleşmede.`);
  return { ok: true, state: { ...state, ties: [...state.ties, tie] } };
}

export function removeTie(state: DrawState, index: number): DrawState {
  return { ...state, ties: state.ties.filter((_, i) => i !== index) };
}

/** Lig aşaması: takıma rakip ekler. */
export function addLeagueFixture(state: DrawState, fixture: LeagueFixture): DrawEdit {
  if (state.stage !== "LEAGUE_PHASE") return fail("Bu tur eleme — rakip değil eşleşme girin.");
  if (fixture.teamId === fixture.opponentId) return fail("Takım kendisiyle eşleşemez.");
  const missing = known(state, fixture.teamId, fixture.opponentId);
  if (missing) return fail(missing);
  const own = state.fixtures.filter((f) => f.teamId === fixture.teamId);
  const limit = leagueOpponentLimit(state.competition.id);
  if (own.length >= limit) return fail(`${drawTeamName(state, fixture.teamId)} için ${limit} rakip zaten girildi.`);
  if (own.some((f) => f.opponentId === fixture.opponentId)) return fail(`${drawTeamName(state, fixture.opponentId)}, ${drawTeamName(state, fixture.teamId)} için zaten girildi.`);
  return { ok: true, state: { ...state, fixtures: [...state.fixtures, fixture] } };
}

export function removeLeagueFixture(state: DrawState, teamId: number, opponentId: number): DrawState {
  return { ...state, fixtures: state.fixtures.filter((f) => !(f.teamId === teamId && f.opponentId === opponentId)) };
}

/** Takımın girilen rakipleri (giriş sırası). */
export const opponentsOf = (state: DrawState, teamId: number): LeagueFixture[] => state.fixtures.filter((f) => f.teamId === teamId);
