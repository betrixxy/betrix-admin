import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReelFormLetter, ReelSnapshotView } from "@/lib/reels/snapshot-view";
import { cn } from "@/lib/utils";

const BAR_TONE = { home: "bg-emerald-400", draw: "bg-slate-400", away: "bg-sky-400" } as const;
const FORM_TONE: Record<ReelFormLetter, string> = {
  G: "bg-emerald-500/25 text-emerald-300",
  B: "bg-slate-500/30 text-slate-200",
  M: "bg-red-500/25 text-red-300",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-white">{title}</h2>
      {children}
    </section>
  );
}

function StatRows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {rows.map((row) => (
        <li key={row.label} className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-medium text-white tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Dondurulan sürümün rakamları, analist diliyle. */
export function ReelsSnapshotCard({ view }: { view: ReelSnapshotView }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dondurulan veriler</CardTitle>
        <CardDescription>Video bu rakamları gösterir. Yüzdeler tam sayıya yuvarlanmıştır.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <Section title="Kim kazanır">
          <ul className="flex flex-col gap-2 text-sm">
            {view.outcome.map((row) => (
              <li key={row.tone} className="flex flex-col gap-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium text-white tabular-nums">{row.percent}</span>
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-white/10">
                  <span className={cn("block h-full rounded-full", BAR_TONE[row.tone])} style={{ width: `${row.width}%` }} />
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="flex flex-col gap-5">
          <Section title="Gol beklentisi">
            <StatRows rows={view.highlights} />
          </Section>
          <Section title="İlk golü kim atar">
            <StatRows rows={view.firstGoal} />
          </Section>
        </div>

        <Section title="Form (son 5, en yeni solda)">
          <ul className="flex flex-col gap-2 text-sm">
            {view.form.map((team) => (
              <li key={team.name} className="flex items-center justify-between gap-3">
                <span className="truncate text-muted-foreground">{team.name}</span>
                <span className="flex gap-1">
                  {team.boxes.length === 0 ? <span className="text-muted-foreground">–</span> : null}
                  {team.boxes.map((letter, index) => (
                    <span key={index} className={cn("flex size-6 items-center justify-center rounded text-xs font-semibold", FORM_TONE[letter])}>{letter}</span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Kafa kafaya">
          {view.h2h ? <StatRows rows={view.h2h} /> : <p className="text-sm text-muted-foreground">Veri yok.</p>}
        </Section>

        <Section title="Skor dağılımı">
          {view.scores ? (
            <StatRows rows={view.scores.map((score) => ({ label: score.label, value: score.percent }))} />
          ) : (
            <p className="text-sm text-muted-foreground">Bu maçta skor sahnesi kullanılmayacak.</p>
          )}
        </Section>

        <Section title="Sezon xG liderleri">
          {view.leaders.length === 0 ? <p className="text-sm text-muted-foreground">Bu takımlar için veri yok.</p> : null}
          {view.leaders.map((block) => (
            <div key={block.team} className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">{block.team}{block.updated ? ` · güncelleme ${block.updated}` : ""}</span>
              <StatRows rows={block.players.map((player) => ({ label: player.name, value: player.line }))} />
            </div>
          ))}
        </Section>
      </CardContent>
    </Card>
  );
}
