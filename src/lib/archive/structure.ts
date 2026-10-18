import { compareTr } from "./names";

/**
 * Arşiv ağacının sabit yapısı — saf. Takım klasörünün altındaki gruplar SABİT sırada: Takım
 * Fotoğrafları, Teknik Direktör, Kaleciler, Defans, Orta Saha, Forvet; grup içinde tr-TR alfabetik.
 */

export type ArchivePosition = "GK" | "DEF" | "MID" | "FWD";
export type ArchiveRole = "PLAYER" | "COACH";

export const ARCHIVE_GROUPS = ["TEAM", "COACH", "GK", "DEF", "MID", "FWD"] as const;
export type ArchiveGroup = (typeof ARCHIVE_GROUPS)[number];

export const ARCHIVE_GROUP_LABELS: Record<ArchiveGroup, string> = {
  TEAM: "Takım Fotoğrafları",
  COACH: "Teknik Direktör",
  GK: "Kaleciler",
  DEF: "Defans",
  MID: "Orta Saha",
  FWD: "Forvet",
};

/** API-Football mevki adı → mevki grubu ("Goalkeeper" → GK); bilinmeyen null. */
export function positionFromApi(position: string | null | undefined): ArchivePosition | null {
  switch ((position ?? "").trim().toLowerCase()) {
    case "goalkeeper":
    case "g":
      return "GK";
    case "defender":
    case "d":
      return "DEF";
    case "midfielder":
    case "m":
      return "MID";
    case "attacker":
    case "forward":
    case "f":
      return "FWD";
    default:
      return null;
  }
}

/** Kişinin ağaçtaki grubu: teknik direktör → COACH; mevkisi bilinmeyen oyuncu orta sahaya değil, null (ağaçta "Mevkisi bilinmeyen" yok — senkron doldurur). */
export function groupOf(person: { role: ArchiveRole; position: ArchivePosition | null }): ArchiveGroup | null {
  if (person.role === "COACH") return "COACH";
  return person.position;
}

export interface GroupedPerson<T> {
  group: ArchiveGroup;
  label: string;
  people: T[];
}

/**
 * Kişileri sabit grup sırasına ve grup içinde tr-TR ada göre dizer. TEAM grubu her zaman en üstte
 * (kişisi olmayan takım fotoğrafları için); boş gruplar da döner (klasörler boşken de görünür).
 */
export function groupPeople<T extends { role: ArchiveRole; position: ArchivePosition | null; name: string }>(people: T[]): GroupedPerson<T>[] {
  return ARCHIVE_GROUPS.map((group) => ({
    group,
    label: ARCHIVE_GROUP_LABELS[group],
    people: group === "TEAM" ? [] : people.filter((person) => groupOf(person) === group).sort((a, b) => compareTr(a.name, b.name)),
  }));
}

/** API-Football `/leagues?team=&current=true` girdisi — yalnızca kullanılan alanlar. */
export interface TeamLeagueEntry {
  id: number;
  name: string;
  type: string;
  country: string | null;
}

/**
 * Takımın o sezonki yurt içi ligi: `type = "League"` (kupa ve UEFA turnuvaları `Cup`). Küme düşen
 * ya da çıkan takım yeni sezonda yeni ligiyle döner → ağaçta kendiliğinden yeni ligin altına geçer.
 * Birden fazla lig dönerse (nadir) takımın ülkesindeki ilk lig.
 */
export function domesticLeague<T extends TeamLeagueEntry>(entries: T[], teamCountry: string | null): T | null {
  const leagues = entries.filter((entry) => entry.type.toLowerCase() === "league");
  return leagues.find((entry) => teamCountry && entry.country === teamCountry) ?? leagues[0] ?? null;
}

/**
 * Kadro senkronunda kişinin takımı: yeni kişi ya da takımsız kişi → doğrudan bu takım; aynı takım →
 * değişiklik yok; BAŞKA takım → otomatik taşıma YOK, yalnızca "taşınsın mı?" önerisi. Milli kadro
 * kulübe dokunmaz (`nationalTeamId`).
 */
export type TeamDecision = { kind: "ASSIGN"; teamId: number } | { kind: "KEEP" } | { kind: "SUGGEST"; teamId: number };

export function clubTeamDecision(currentTeamId: number | null, squadTeamId: number): TeamDecision {
  if (currentTeamId === null) return { kind: "ASSIGN", teamId: squadTeamId };
  if (currentTeamId === squadTeamId) return { kind: "KEEP" };
  return { kind: "SUGGEST", teamId: squadTeamId };
}

/** Teknik direktör kariyeri — API-Football `/coachs` girdisinin kullanılan alanları. */
export interface CoachCareer {
  career: { team: { id: number }; end: string | null }[];
}

/** Takımın GÜNCEL teknik direktörü — kariyerinde bu takımla bitiş tarihi olmayan kayıt. */
export function currentCoach<T extends CoachCareer>(coaches: T[], teamId: number): T | null {
  return coaches.find((coach) => coach.career.some((stint) => stint.team.id === teamId && stint.end === null)) ?? null;
}
