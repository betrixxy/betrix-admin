import { DEFAULT_FORMATION, isValidFormation } from "@/lib/dashboard/lineup-formations";
import {
  DEFAULT_LINEUP_TEMPLATE_STYLE,
  LINEUP_SIZE,
  type LineupDraft,
  type LineupReference,
  type LineupSlot,
  type LineupSource,
  type LineupTemplateStyle,
  type TeamLineupDraft,
  type TeamLineupReference,
} from "@/types/lineup";
import { DEFAULT_SOCIAL_FORMAT } from "@/types/studio-formats";

/** Muhtemel 11 taslağı — referans veriden form durumu (saf; istemci de içe aktarır). */

export const HEADLINE_PREDICTED = "MUHTEMEL 11";
export const HEADLINE_ANNOUNCED = "İLK 11";

export const emptySlot = (): LineupSlot => ({ playerId: null, name: "", number: "" });

export function emptyTeamLineup(teamName = "", logoUrl = ""): TeamLineupDraft {
  return {
    teamName,
    logoUrl,
    colorHex: "",
    heroPhotoId: "",
    heroAdjust: null,
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
          return { playerId: s.id, name: s.name, number: number !== null ? String(number) : "", ...(s.origin !== undefined ? { origin: s.origin } : {}) };
        })
      : base.slots;
  return { ...base, formation, slots, coach: ref.coach ?? "", colorHex: ref.colorHex };
}

export function lineupDraftFromReference(ref: LineupReference, matchLabel: string): LineupDraft {
  return {
    fixtureId: ref.fixtureId,
    templateStyle: DEFAULT_LINEUP_TEMPLATE_STYLE,
    headline: lineupHeadline({ home: ref.home.source.kind === "announced", away: ref.away.source.kind === "announced" }),
    matchLabel,
    format: DEFAULT_SOCIAL_FORMAT,
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

/**
 * Tek kartın gerçekte çizileceği şablon = admin'in seçimi. "Kahraman Liste"de kapak fotoğrafı olmayan takım da liste
 * olarak çizilir: kapak yerine ORTAK YEDEK TASARIM (takım rengi gradyanı + dev filigran arma + soluk dev ad + arma —
 * `templates/shared/team-fallback.tsx`; canlı test 2026-10-31, eskiden taktik tahtasına düşüyordu).
 */
export function cardTemplateStyle(selected: LineupTemplateStyle, team: Pick<TeamLineupDraft, "heroPhotoId">): LineupTemplateStyle {
  void team;
  return selected;
}

/**
 * Kart başlığı API durumundan (canlı prova 2026-11-01): iki takımın resmi ilk 11'i açıklandıysa "İLK 11",
 * değilse "MUHTEMEL 11" (son maç kadrosu). Formdaki başlığa güvenilmez — sunucu kayıtta yeniden belirler.
 */
export function lineupHeadline(announced: { home: boolean; away: boolean }): string {
  return announced.home && announced.away ? HEADLINE_ANNOUNCED : HEADLINE_PREDICTED;
}

/** Stüdyoda kadro kaynağının tek satırlık özeti (hangi başlıkla çizileceği). */
export function lineupStatusLine(teams: { home: { teamName: string; announced: boolean }; away: { teamName: string; announced: boolean } }): string {
  const { home, away } = teams;
  if (home.announced && away.announced) return `Resmi ilk 11'ler açıklandı (API-Football) — kart başlığı ${HEADLINE_ANNOUNCED}, gerçek kadro kullanılır.`;
  const one = home.announced ? home : away.announced ? away : null;
  if (one) return `Yalnızca ${one.teamName} ilk 11'ini açıkladı — kart başlığı ${HEADLINE_PREDICTED}; açıklanan tarafta gerçek kadro, diğerinde son maç kadrosu.`;
  return `Resmi ilk 11 henüz açıklanmadı — kart başlığı ${HEADLINE_PREDICTED}, son maçın ilk 11'i. Kadrolar açıklanınca "Veriden doldur".`;
}

/**
 * Açıklanmış resmi 11 varsa kayıttaki 11 onunla aynı oyuncular olmalı (sıra/konum serbest). Açıklanmadıysa
 * (null) denetim yok. Sorun metni ya da null.
 */
export function officialLineupIssue(team: Pick<TeamLineupDraft, "teamName" | "slots">, announcedIds: number[] | null): string | null {
  if (announcedIds === null) return null;
  const official = new Set(announcedIds);
  const chosen = team.slots.flatMap((slot) => (slot.playerId !== null ? [slot.playerId] : []));
  const same = chosen.length === official.size && chosen.every((id) => official.has(id));
  return same ? null : `${team.teamName} resmi ilk 11'ini açıkladı — kart gerçek kadroyla çizilir: "Veriden doldur" ile yükleyin.`;
}
