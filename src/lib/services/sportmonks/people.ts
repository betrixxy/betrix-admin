import { z } from "zod";
import { sportmonksRequest } from "@/lib/services/sportmonks/client";
import { coachPeople, pickSportmonksTeam, searchedPeople, squadPeople } from "@/lib/services/sportmonks/people-mappers";
import type { SportmonksPerson } from "@/types/person-name";

/**
 * Kişi adları (Türkçe karakterli) ve uyruk — Sportmonks (yalnızca okuma, 24 saat önbellek). API-Football
 * Türk adlarını ASCII verir ("U. Cakir"); kart adı bu kaynaktan harf geri yüklenerek yazılır (bkz.
 * `lib/names/person-name.ts`). Kimlik tablosu yok: takım ad + ülkeyle, koç soyadıyla aranır; bulunamazsa
 * null — tahmin edilmez. Anahtar yoksa null.
 */

const TTL_MS = 24 * 60 * 60 * 1000;

const teamSearchSchema = z.object({ data: z.array(z.object({ id: z.number(), name: z.string(), country: z.object({ name: z.string() }).nullish() })) });

/**
 * Sportmonks takım kimliği. Arama önce tam adla; sonuç yoksa adın en uzun sözcüğüyle (Sportmonks "Gaziantep F.K."
 * yazar, "Gaziantep FK" araması boş döner — 2026-10-31: Gaziantep kadrosu hiç eşleşmiyordu). Eşleme her iki
 * aramada da aynı kural (`pickSportmonksTeam`); tahmin yok.
 */
export async function findSportmonksTeamId(teamName: string, country: string | null): Promise<number | null> {
  const longest = [...teamName.split(/\s+/u)].sort((a, b) => b.length - a.length)[0] ?? "";
  for (const term of [...new Set([teamName, longest.length >= 4 ? longest : teamName])]) {
    const raw = await sportmonksRequest(`/teams/search/${encodeURIComponent(term)}`, { include: "country" }, { ttlMs: TTL_MS });
    if (!raw.ok) return null;
    const parsed = teamSearchSchema.safeParse(raw.data);
    if (!parsed.success) return null;
    const id = pickSportmonksTeam(parsed.data.data, teamName, country);
    if (id !== null) return id;
  }
  return null;
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
