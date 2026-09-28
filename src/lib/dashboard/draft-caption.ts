import { FORM_LETTER_TR } from "@/lib/dashboard/studio-stats";
import type { MatchStats, TeamRecentForm } from "@/types/sports";

/**
 * Gerçek maç verisinden gönderi metni taslağı üretir. Saf fonksiyon — LLM yok, uydurma yok:
 * metindeki her sayı `MatchStats`'tan gelir, olmayan metrik cümleye hiç girmez. Admin, "sistemin
 * dilini oturtma" sürecinde bu taslağı inceleme ekranında düzenler (bkz. CLAUDE.md 1.10).
 */

const kickoffFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "long",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
});

function formLine(team: TeamRecentForm): string | null {
  if (team.last5.length === 0) return null;
  return `${team.teamName}: ${team.last5.map((letter) => FORM_LETTER_TR[letter]).join(" ")}`;
}

function pair(label: string, home: number | null, away: number | null, names: [string, string]): string | null {
  if (home === null || away === null) return null;
  return `${label}: ${names[0]} ${home.toFixed(2)} · ${names[1]} ${away.toFixed(2)}`;
}

/** Hashtag'e uygun hale getirir — harf/rakam dışı her şey atılır (Türkçe harfler korunur). */
export function toHashtag(value: string): string | null {
  const cleaned = value.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "");
  return cleaned.length > 1 ? `#${cleaned}` : null;
}

export function buildDraftCaption(stats: MatchStats): string {
  const { fixture, home, away, headToHead } = stats;
  const names: [string, string] = [home.teamName, away.teamName];

  const header = [
    `⚽ ${fixture.homeTeam.name} – ${fixture.awayTeam.name}`,
    `🏆 ${fixture.competition.name} · ${kickoffFormatter.format(new Date(fixture.kickoffUtc))}`,
  ];

  const forms = [formLine(home), formLine(away)].filter((line): line is string => line !== null);
  const numbers = [
    pair("🎯 Maç başı gol", home.goalsForAvg, away.goalsForAvg, names),
    pair("📈 xG (maç başı)", home.xgForAvg, away.xgForAvg, names),
  ].filter((line): line is string => line !== null);

  const h2h =
    headToHead.matches.length > 0
      ? `🤝 Son ${headToHead.matches.length} karşılaşma: ${names[0]} ${headToHead.homeWins}G · ${headToHead.draws}B · ${names[1]} ${headToHead.awayWins}G`
      : null;

  const hashtags = [fixture.homeTeam.name, fixture.awayTeam.name, fixture.competition.shortName]
    .map(toHashtag)
    .filter((tag): tag is string => tag !== null);

  return [
    header.join("\n"),
    forms.length > 0 ? `📊 Son 5 maç formu\n${forms.join("\n")}` : null,
    numbers.length > 0 ? numbers.join("\n") : null,
    h2h,
    "Detaylı analiz ve maç tahmini checkmatch.net'te 👉",
    hashtags.join(" "),
  ]
    .filter((block): block is string => block !== null && block.length > 0)
    .join("\n\n");
}
