import { DEFAULT_FORMATION, isValidFormation } from "@/lib/dashboard/lineup-formations";
import {
  LINEUP_SIZE,
  type LineupDraft,
  type LineupReference,
  type LineupSlot,
  type LineupSource,
  type TeamLineupDraft,
  type TeamLineupReference,
} from "@/types/lineup";

/** Muhtemel 11 taslağı — referans veriden form durumu (saf; istemci de içe aktarır). */

export const HEADLINE_PREDICTED = "MUHTEMEL 11";
export const HEADLINE_ANNOUNCED = "İLK 11";

export const emptySlot = (): LineupSlot => ({ playerId: null, name: "", number: "" });

export function emptyTeamLineup(teamName = "", logoUrl = ""): TeamLineupDraft {
  return {
    teamName,
    logoUrl,
    colorHex: "",
    formation: DEFAULT_FORMATION,
    slots: Array.from({ length: LINEUP_SIZE }, emptySlot),
    coach: "",
  };
}

export function teamDraftFromReference(ref: TeamLineupReference): TeamLineupDraft {
  const base = emptyTeamLineup(ref.teamName, ref.logoUrl);
  const formation = ref.formation && isValidFormation(ref.formation) ? ref.formation : DEFAULT_FORMATION;
  const squadNumbers = new Map(ref.squad.map((p) => [p.id, p.number]));
  const slots =
    ref.starters.length === LINEUP_SIZE
      ? ref.starters.map((s) => {
          // Güncel kadrodaki numara esas (transfer sonrası değişmiş olabilir); yoksa maçtaki numara.
          const number = (s.id !== null ? squadNumbers.get(s.id) : null) ?? s.number;
          return { playerId: s.id, name: s.name, number: number !== null ? String(number) : "" };
        })
      : base.slots;
  return { ...base, formation, slots, coach: ref.coach ?? "", colorHex: ref.colorHex };
}

export function lineupDraftFromReference(ref: LineupReference, matchLabel: string): LineupDraft {
  const announced = ref.home.source.kind === "announced" && ref.away.source.kind === "announced";
  return {
    fixtureId: ref.fixtureId,
    headline: announced ? HEADLINE_ANNOUNCED : HEADLINE_PREDICTED,
    matchLabel,
    home: teamDraftFromReference(ref.home),
    away: teamDraftFromReference(ref.away),
  };
}

export function describeSource(source: LineupSource): string {
  switch (source.kind) {
    case "announced":
      return "Maçın açıklanmış ilk 11'i";
    case "last-match": {
      const [y, m, d] = source.date.split("-");
      return `Son maçın ilk 11'i (${d}.${m}.${y} · ${source.opponent})`;
    }
    case "none":
      return "Referans 11 bulunamadı — kadrodan seçin";
  }
}

/** Kayıt/önizleme öncesi denetim: 11 isim dolu, aynı oyuncu iki kez yok, diziliş geçerli. */
export function lineupIssues(team: TeamLineupDraft): string[] {
  const issues: string[] = [];
  if (!isValidFormation(team.formation)) issues.push(`${team.teamName}: diziliş geçersiz (${team.formation}).`);
  const empty = team.slots.filter((slot) => !slot.name.trim()).length;
  if (empty > 0) issues.push(`${team.teamName}: ${empty} pozisyon boş.`);
  const seen = new Set<string>();
  for (const slot of team.slots) {
    const key = slot.playerId !== null ? `id:${slot.playerId}` : `name:${slot.name.trim().toLocaleLowerCase("tr-TR")}`;
    if (!slot.name.trim()) continue;
    if (seen.has(key)) issues.push(`${team.teamName}: "${slot.name}" iki kez seçilmiş.`);
    seen.add(key);
  }
  return issues;
}
