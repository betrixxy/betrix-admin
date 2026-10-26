import { sportmonksRequest } from "@/lib/services/sportmonks/client";
import {
  nameMatches,
  scopedRecords,
  sportmonksPlayerSchema,
  sportmonksPlayerSearchSchema,
  type SportmonksPlayerStat,
  type SportmonksScope,
} from "@/lib/services/sportmonks/player-season-mappers";

/**
 * Oyuncunun Sportmonks sezon kayıtları — API-Football'un boş bıraktığı istatistikleri (xG, büyük fırsat…)
 * doldurmak için. Kimlik tablosu yok: soyadıyla aranır, adayın adı API-Football adıyla tutmalı VE
 * kapsamda (sezon + takım [+ lig]) kaydı olmalı. Bulunamazsa null — tahmin edilmez. Anahtar yoksa null.
 */

const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const CANDIDATES = 5;

export interface SportmonksPlayerRecords {
  sportmonksId: number;
  records: SportmonksPlayerStat[];
}

export async function getSportmonksPlayerRecords(fullName: string, surname: string, scope: SportmonksScope): Promise<SportmonksPlayerRecords | null> {
  const search = await sportmonksRequest(`/players/search/${encodeURIComponent(surname)}`, {}, { ttlMs: SEARCH_TTL_MS });
  if (!search.ok) return null;
  const hits = sportmonksPlayerSearchSchema.safeParse(search.data);
  if (!hits.success) return null;
  const candidates = hits.data.data.filter((hit) => nameMatches(hit.display_name ?? hit.name ?? "", fullName, surname)).slice(0, CANDIDATES);
  for (const candidate of candidates) {
    const player = await sportmonksRequest(`/players/${candidate.id}`, { include: "statistics.details.type;statistics.season.league;statistics.team" });
    if (!player.ok) continue;
    const parsed = sportmonksPlayerSchema.safeParse(player.data);
    if (!parsed.success) continue;
    const records = scopedRecords(parsed.data.data.statistics, scope);
    if (records.length > 0) return { sportmonksId: candidate.id, records };
  }
  return null;
}
