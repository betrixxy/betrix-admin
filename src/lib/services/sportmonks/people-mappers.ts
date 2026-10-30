import { z } from "zod";
import type { SportmonksPerson } from "@/types/person-name";

/**
 * Sportmonks kişi yanıtları (kadro, koç ve hakem araması) → `SportmonksPerson` — saf; servis (`people.ts`) ve görsel
 * testlerin sabit Sportmonks yanıtı aynı yoldan geçer.
 */

const nationality = z.object({ name: z.string() }).nullish();
const personSchema = z.object({
  display_name: z.string().nullish(),
  common_name: z.string().nullish(),
  firstname: z.string().nullish(),
  lastname: z.string().nullish(),
  nationality,
});
const squadSchema = z.object({ data: z.array(z.object({ jersey_number: z.number().nullish(), player: personSchema.nullish() })) });
const personSearchSchema = z.object({ data: z.array(personSchema) });
const coachSearchSchema = z.object({
  data: z.array(personSchema.extend({ teams: z.array(z.object({ team_id: z.number(), end: z.string().nullish() })).nullish() })),
});

type RawPerson = z.infer<typeof personSchema>;

/** Yaygın ad `display_name`, yoksa `common_name`; resmi firstname + lastname yaygın ad yerine GEÇMEZ (yalnızca eşleme). */
function toPerson(raw: RawPerson, jersey: number | null): SportmonksPerson | null {
  const displayName = raw.display_name?.trim() || raw.common_name?.trim() || null;
  const firstname = raw.firstname?.trim() ?? "";
  const lastname = raw.lastname?.trim() ?? "";
  if (!displayName && !firstname && !lastname) return null;
  return { displayName, firstname, lastname, nationality: raw.nationality?.name ?? null, jersey };
}

/** `/squads/teams/{id}` yanıtı → kişiler (saf; görsel testler sabit yanıtı da buradan geçirir). */
export function squadPeople(data: unknown): SportmonksPerson[] | null {
  const parsed = squadSchema.safeParse(data);
  if (!parsed.success) return null;
  return parsed.data.data.flatMap((entry) => {
    const person = entry.player ? toPerson(entry.player, entry.jersey_number ?? null) : null;
    return person ? [person] : [];
  });
}

/** `/coaches/search/{ad}` yanıtı → adaylar, takımı çalıştırmış olan önde (saf). */
export function coachPeople(data: unknown, sportmonksTeamId: number | null): SportmonksPerson[] {
  const parsed = coachSearchSchema.safeParse(data);
  if (!parsed.success) return [];
  const coached = (coach: (typeof parsed.data.data)[number]) => (sportmonksTeamId !== null && coach.teams?.some((team) => team.team_id === sportmonksTeamId) ? 0 : 1);
  return [...parsed.data.data].sort((a, b) => coached(a) - coached(b)).flatMap((coach) => {
    const person = toPerson(coach, null);
    return person ? [person] : [];
  });
}

/** `/referees/search/{ad}` yanıtı → hakem adayları (saf). */
export function searchedPeople(data: unknown): SportmonksPerson[] {
  const parsed = personSearchSchema.safeParse(data);
  if (!parsed.success) return [];
  return parsed.data.data.flatMap((raw) => {
    const person = toPerson(raw, null);
    return person ? [person] : [];
  });
}
