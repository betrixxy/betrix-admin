import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FORM_LETTER_TR, MISSING_STAT } from "@/lib/dashboard/studio-stats";
import type { MatchResultLetter, MatchStats, TeamRecentForm } from "@/types/sports";

const LETTER_CLASS: Record<MatchResultLetter, string> = {
  W: "bg-emerald-500/20 text-emerald-300",
  D: "bg-zinc-500/20 text-zinc-300",
  L: "bg-rose-500/20 text-rose-300",
};

const fetchedFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function decimal(value: number | null): string {
  return value === null ? MISSING_STAT : value.toFixed(2);
}

function TeamColumn({ team }: { team: TeamRecentForm }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-sm font-medium text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={team.logoUrl} alt="" className="size-5 object-contain" />
        {team.teamName}
      </span>
      <span className="flex gap-1">
        {team.last5.length === 0 ? <span className="text-xs text-muted-foreground">{MISSING_STAT}</span> : null}
        {team.last5.map((letter, index) => (
          <span key={index} className={`flex size-5 items-center justify-center rounded text-[10px] font-bold ${LETTER_CLASS[letter]}`}>
            {FORM_LETTER_TR[letter]}
          </span>
        ))}
      </span>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Gol / maç</dt>
        <dd className="text-white">{decimal(team.goalsForAvg)}</dd>
        <dt className="text-muted-foreground">Yenilen / maç</dt>
        <dd className="text-white">{decimal(team.goalsAgainstAvg)}</dd>
        <dt className="text-muted-foreground">xG / xGA</dt>
        <dd className="text-white">
          {decimal(team.xgForAvg)} / {decimal(team.xgAgainstAvg)}
        </dd>
      </dl>
      <span className="text-[10px] text-muted-foreground/80">
        {team.matchesSampled} maç · xG {team.xgMatchesSampled} maçta mevcut
      </span>
    </div>
  );
}

/**
 * Taslağın dayandığı gerçek veri — admin görseldeki her sayının kaynağını buradan doğrular.
 * Üretim anındaki snapshot'tır; sonradan değişen veri taslağı sessizce değiştirmez.
 */
export function DraftStatsCard({ stats }: { stats: MatchStats }) {
  const { headToHead } = stats;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Maç Verisi</CardTitle>
        <CardDescription>
          Kaynak: API-Football · {fetchedFormatter.format(new Date(stats.fetchedAtUtc))} itibarıyla · son 5 bitmiş maç
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <TeamColumn team={stats.home} />
          <TeamColumn team={stats.away} />
        </div>
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <span className="text-xs font-medium text-white">
            Aralarındaki son {headToHead.matches.length} maç: {headToHead.homeWins}G · {headToHead.draws}B · {headToHead.awayWins}M
            <span className="font-normal text-muted-foreground"> ({stats.home.teamName} açısından)</span>
          </span>
          <ul className="text-[11px] text-muted-foreground">
            {headToHead.matches.map((match) => (
              <li key={match.kickoffUtc}>
                {match.kickoffUtc.slice(0, 10)} · {match.homeTeamName} {match.homeGoals}-{match.awayGoals} {match.awayTeamName}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
