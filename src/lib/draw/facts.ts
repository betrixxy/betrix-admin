import { isFinishedStatus } from "@/lib/services/api-football/mappers";
import type { ApiFootballFixtureRaw } from "@/lib/services/api-football/types";
import type { HeadToHeadRecord } from "@/types/draw";

/**
 * Kura kartının olgu satırı — kural tabanlı, isteğe bağlı: eşleşmenin geçmiş karşılaşma verisi varsa
 * "Fenerbahçe ile Benfica daha önce 4 kez karşılaştı: 1G 1B 2M". Veri yoksa satır yok, uydurma yok.
 */

/** Odak takımın gözünden bitmiş karşılaşmalar (`beforeUtc` öncesi); hiç yoksa null. */
export function headToHeadRecord(fixtures: ApiFootballFixtureRaw[], teamId: number, beforeUtc: string): HeadToHeadRecord | null {
  const cutoff = Date.parse(beforeUtc);
  const record = { played: 0, wins: 0, draws: 0, losses: 0 };
  for (const fixture of fixtures) {
    if (!isFinishedStatus(fixture.fixture.status.short) || fixture.fixture.timestamp * 1000 >= cutoff) continue;
    const home = fixture.teams.home.id === teamId;
    if (!home && fixture.teams.away.id !== teamId) continue;
    const [own, other] = home ? [fixture.goals.home, fixture.goals.away] : [fixture.goals.away, fixture.goals.home];
    if (own === null || own === undefined || other === null || other === undefined) continue;
    record.played += 1;
    if (own > other) record.wins += 1;
    else if (own === other) record.draws += 1;
    else record.losses += 1;
  }
  return record.played > 0 ? record : null;
}

export function headToHeadFact(teamName: string, opponentName: string, record: HeadToHeadRecord | null): string {
  if (!record || record.played === 0) return "";
  return `${teamName} ile ${opponentName} daha önce ${record.played} kez karşılaştı: ${record.wins}G ${record.draws}B ${record.losses}M`;
}
