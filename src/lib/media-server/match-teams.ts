import { nameSimilarity, normalizeCountry, normalizeName, stripClubAffixes } from "@/lib/media-server/names";
import type {
  CertainMatch,
  FmClub,
  ManualReview,
  MatchCandidate,
  MatchOutcome,
  MediaApiTeam,
  TeamMatchMethod,
} from "@/types/media-server";

/**
 * FM kulüp logosu → API-Football takımı. Kesin eşleşme kuralları:
 * 1. Ülke birebir aynı (FM "Nation" ↔ API `country`), ülkesi bilinmeyen kulüp asla kesinleşmez;
 * 2. normalize ad (veya FM kısa adı) API adıyla aynı — yoksa kulüp ekleri atılmış hâli aynı;
 * 3. o kademede tam olarak TEK API takımı uyuyor;
 * 4. o API takımına başka hiçbir FM kulübü kesin eşleşmemiş (ters tekillik).
 * Bunlardan biri sağlanmazsa ve benzer aday varsa dosya manuel kontrole gider.
 */

const CANDIDATE_MIN_SIMILARITY = 0.7;
const MAX_CANDIDATES = 5;

function indexBy(teams: MediaApiTeam[], key: (team: MediaApiTeam) => string): Map<string, MediaApiTeam[]> {
  const map = new Map<string, MediaApiTeam[]>();
  for (const team of teams) {
    const k = key(team);
    if (k === "") continue;
    map.set(k, [...(map.get(k) ?? []), team]);
  }
  return map;
}

function lookup(map: Map<string, MediaApiTeam[]>, keys: string[], country: string): MediaApiTeam[] {
  const found = new Map<number, MediaApiTeam>();
  for (const key of keys) {
    for (const team of map.get(key) ?? []) {
      if (normalizeCountry(team.country ?? "") === country) found.set(team.id, team);
    }
  }
  return [...found.values()];
}

export function describeTeam(team: MediaApiTeam): string {
  return `API ${team.id} | ${team.name} | ${team.country ?? "ülke yok"}`;
}

function describeClub(club: FmClub): string {
  const short = club.shortName && club.shortName !== club.name ? ` (kısa: ${club.shortName})` : "";
  return `FM: "${club.name}"${short} | Ülke: ${club.nation ?? "yok"}`;
}

export function matchTeams(fmClubs: FmClub[], apiTeams: MediaApiTeam[]): MatchOutcome<TeamMatchMethod> {
  const exactIndex = indexBy(apiTeams, (t) => normalizeName(t.name));
  const strippedIndex = indexBy(apiTeams, (t) => stripClubAffixes(t.name));
  const byCountry = indexBy(apiTeams, (t) => normalizeCountry(t.country ?? ""));

  const tentative: CertainMatch<TeamMatchMethod>[] = [];
  const manual: ManualReview[] = [];
  let outOfScope = 0;

  for (const club of fmClubs) {
    const forms = [club.name, club.shortName].filter((f): f is string => f !== null);
    const country = club.nation ? normalizeCountry(club.nation) : null;
    const pool = country !== null ? (byCountry.get(country) ?? []) : apiTeams;
    const candidates: MatchCandidate[] = pool
      .map((team) => ({
        apiId: team.id,
        label: describeTeam(team),
        similarity: Math.max(...forms.map((f) => nameSimilarity(f, team.name))),
      }))
      .filter((c) => c.similarity >= CANDIDATE_MIN_SIMILARITY)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, MAX_CANDIDATES);

    const review = (reason: string) => {
      if (candidates.length > 0) manual.push({ fmUid: club.uid, fmLabel: describeClub(club), reason, candidates });
      else outOfScope += 1;
    };

    if (country === null) {
      review("FM kulübünün ülkesi yok — ülke doğrulanamadan kesin eşleşme yapılmaz.");
      continue;
    }
    const exact = lookup(exactIndex, forms.map(normalizeName), country);
    const stripped = exact.length === 0 ? lookup(strippedIndex, forms.map(stripClubAffixes), country) : [];
    const [hits, method]: [MediaApiTeam[], TeamMatchMethod] =
      exact.length > 0 ? [exact, "NAME_EXACT+COUNTRY"] : [stripped, "NAME_AFFIX_STRIPPED+COUNTRY"];

    const hit = hits[0];
    if (hits.length === 1 && hit) {
      tentative.push({ fmUid: club.uid, fmName: club.name, apiId: hit.id, apiName: hit.name, method });
    } else if (hits.length > 1) {
      review(`Aynı ad + ülke ile ${hits.length} API takımı var — hangisi olduğu belirsiz.`);
    } else {
      review("Ad birebir uyuşmuyor (yalnızca benzer adaylar var).");
    }
  }

  return finalizeUnique(tentative, manual, outOfScope, fmClubs, apiTeams);
}

/** Ters tekillik: aynı API takımına birden fazla FM kulübü kesinleştiyse hepsi manuele düşer. */
function finalizeUnique(
  tentative: CertainMatch<TeamMatchMethod>[],
  manual: ManualReview[],
  outOfScope: number,
  fmClubs: FmClub[],
  apiTeams: MediaApiTeam[],
): MatchOutcome<TeamMatchMethod> {
  const claims = new Map<number, number>();
  for (const m of tentative) claims.set(m.apiId, (claims.get(m.apiId) ?? 0) + 1);
  const clubsByUid = new Map(fmClubs.map((c) => [c.uid, c]));
  const teamsById = new Map(apiTeams.map((t) => [t.id, t]));

  const certain: CertainMatch<TeamMatchMethod>[] = [];
  for (const m of tentative) {
    if (claims.get(m.apiId) === 1) {
      certain.push(m);
      continue;
    }
    const club = clubsByUid.get(m.fmUid);
    const team = teamsById.get(m.apiId);
    manual.push({
      fmUid: m.fmUid,
      fmLabel: club ? describeClub(club) : `FM: "${m.fmName}"`,
      reason: `Bu API takımı ${claims.get(m.apiId)} farklı FM kulübüyle eşleşti — hangisinin doğru olduğu belirsiz.`,
      candidates: [{ apiId: m.apiId, label: team ? describeTeam(team) : `API ${m.apiId} | ${m.apiName}`, similarity: 1 }],
    });
  }
  return { certain, manual, outOfScope };
}

/**
 * Oyuncu eşleştirmesinde kulüp doğrulaması için: API takım kimliği → normalize ad kümesi
 * (API adı, eki atılmış hâli ve KESİN eşleşmiş FM kulübünün ad/kısa adı).
 */
export function buildTeamAliases(
  apiTeams: MediaApiTeam[],
  certainTeams: CertainMatch<TeamMatchMethod>[],
  fmClubs: FmClub[],
): Map<number, Set<string>> {
  const aliases = new Map<number, Set<string>>();
  const add = (teamId: number, value: string) => {
    const set = aliases.get(teamId) ?? new Set<string>();
    for (const key of [normalizeName(value), stripClubAffixes(value)]) if (key !== "") set.add(key);
    aliases.set(teamId, set);
  };
  for (const team of apiTeams) add(team.id, team.name);
  const clubsByUid = new Map(fmClubs.map((c) => [c.uid, c]));
  for (const match of certainTeams) {
    const club = clubsByUid.get(match.fmUid);
    if (!club) continue;
    add(match.apiId, club.name);
    if (club.shortName) add(match.apiId, club.shortName);
  }
  return aliases;
}
