import { z } from "zod";
import { foldName } from "@/lib/names/person-name";
import { sportmonksRequest } from "@/lib/services/sportmonks/client";
import type { SportmonksPerson } from "@/types/person-name";

/**
 * Kişi adları (Türkçe karakterli) ve uyruk — Sportmonks (yalnızca okuma, 24 saat önbellek). API-Football
 * Türk adlarını ASCII verir ("U. Cakir"); kart adı bu kaynaktan harf geri yüklenerek yazılır (bkz.
 * `lib/names/person-name.ts`). Kimlik tablosu yok: takım ad + ülkeyle, koç soyadıyla aranır; bulunamazsa
 * null — tahmin edilmez. Anahtar yoksa null.
 */

const TTL_MS = 24 * 60 * 60 * 1000;

const nationality = z.object({ name: z.string() }).nullish();
const personSchema = z.object({
  display_name: z.string().nullish(),
  common_name: z.string().nullish(),
  firstname: z.string().nullish(),
  lastname: z.string().nullish(),
  nationality,
});
const teamSearchSchema = z.object({ data: z.array(z.object({ id: z.number(), name: z.string(), country: z.object({ name: z.string() }).nullish() })) });
const squadSchema = z.object({ data: z.array(z.object({ jersey_number: z.number().nullish(), player: personSchema.nullish() })) });
const coachSearchSchema = z.object({
  data: z.array(personSchema.extend({ teams: z.array(z.object({ team_id: z.number(), end: z.string().nullish() })).nullish() })),
});

type RawPerson = z.infer<typeof personSchema>;

function toPerson(raw: RawPerson, jersey: number | null): SportmonksPerson | null {
  const displayName = raw.display_name?.trim() || [raw.firstname, raw.lastname].filter(Boolean).join(" ").trim();
  if (!displayName) return null;
  return { displayName, firstname: raw.firstname?.trim() ?? "", lastname: raw.lastname?.trim() ?? "", nationality: raw.nationality?.name ?? null, jersey };
}

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
  if (!raw.ok) return null;
  const parsed = squadSchema.safeParse(raw.data);
  if (!parsed.success) return null;
  return parsed.data.data.flatMap((entry) => {
    const person = entry.player ? toPerson(entry.player, entry.jersey_number ?? null) : null;
    return person ? [person] : [];
  });
}

/** Teknik direktör adayları (soyadıyla arama); `sportmonksTeamId` verilirse o takımı çalıştırmış olanlar öne. */
export async function searchSportmonksCoaches(surname: string, sportmonksTeamId: number | null): Promise<SportmonksPerson[]> {
  const raw = await sportmonksRequest(`/coaches/search/${encodeURIComponent(surname)}`, { include: "nationality;teams" }, { ttlMs: TTL_MS });
  if (!raw.ok) return [];
  const parsed = coachSearchSchema.safeParse(raw.data);
  if (!parsed.success) return [];
  const coached = (coach: (typeof parsed.data.data)[number]) => (sportmonksTeamId !== null && coach.teams?.some((team) => team.team_id === sportmonksTeamId) ? 0 : 1);
  return [...parsed.data.data].sort((a, b) => coached(a) - coached(b)).flatMap((coach) => {
    const person = toPerson(coach, null);
    return person ? [person] : [];
  });
}
