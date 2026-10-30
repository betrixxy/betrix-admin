import { z } from "zod";
import { foldName } from "@/lib/names/person-name";
import { sportmonksRequest } from "@/lib/services/sportmonks/client";
import { coachPeople, searchedPeople, squadPeople } from "@/lib/services/sportmonks/people-mappers";
import type { SportmonksPerson } from "@/types/person-name";

/**
 * Kişi adları (Türkçe karakterli) ve uyruk — Sportmonks (yalnızca okuma, 24 saat önbellek). API-Football
 * Türk adlarını ASCII verir ("U. Cakir"); kart adı bu kaynaktan harf geri yüklenerek yazılır (bkz.
 * `lib/names/person-name.ts`). Kimlik tablosu yok: takım ad + ülkeyle, koç soyadıyla aranır; bulunamazsa
 * null — tahmin edilmez. Anahtar yoksa null.
 */

const TTL_MS = 24 * 60 * 60 * 1000;

const teamSearchSchema = z.object({ data: z.array(z.object({ id: z.number(), name: z.string(), country: z.object({ name: z.string() }).nullish() })) });

/** Sportmonks takım kimliği: adı (katlanmış) birebir tutan, yoksa adı içeren; ülke verilirse o ülkeden. */
export async function findSportmonksTeamId(teamName: string, country: string | null): Promise<number | null> {
  const raw = await sportmonksRequest(`/teams/search/${encodeURIComponent(teamName)}`, { include: "country" }, { ttlMs: TTL_MS });
  if (!raw.ok) return null;
  const parsed = teamSearchSchema.safeParse(raw.data);
  if (!parsed.success) return null;
  const wanted = foldName(teamName);
  const inCountry = parsed.data.data.filter((team) => !country || !team.country || foldName(team.country.name) === foldName(country));
  return (inCountry.find((team) => foldName(team.name) === wanted) ?? inCountry.find((team) => foldName(team.name).includes(wanted)))?.id ?? null;
}

/** Takımın güncel kadrosu (ad + uyruk + forma numarası). */
export async function getSportmonksSquad(sportmonksTeamId: number): Promise<SportmonksPerson[] | null> {
  const raw = await sportmonksRequest(`/squads/teams/${sportmonksTeamId}`, { include: "player.nationality" }, { ttlMs: TTL_MS });
  return raw.ok ? squadPeople(raw.data) : null;
}

/** Teknik direktör adayları (soyadıyla arama); `sportmonksTeamId` verilirse o takımı çalıştırmış olanlar öne. */
export async function searchSportmonksCoaches(surname: string, sportmonksTeamId: number | null): Promise<SportmonksPerson[]> {
  const raw = await sportmonksRequest(`/coaches/search/${encodeURIComponent(surname)}`, { include: "nationality;teams" }, { ttlMs: TTL_MS });
  return raw.ok ? coachPeople(raw.data, sportmonksTeamId) : [];
}

/** Hakem adayları (soyadıyla arama; Türkçe karakterli ad + uyruk). */
export async function searchSportmonksReferees(surname: string): Promise<SportmonksPerson[]> {
  const raw = await sportmonksRequest(`/referees/search/${encodeURIComponent(surname)}`, { include: "nationality" }, { ttlMs: TTL_MS });
  return raw.ok ? searchedPeople(raw.data) : [];
}
