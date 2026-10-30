import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { MatchScorecardForm, PeriodScorecardForm, SettleButton } from "@/components/features/dashboard/prediction-scorecard-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFixtureRecords } from "@/lib/dashboard/prediction-scorecard-data";
import { loadScorecardMatch } from "@/lib/dashboard/prediction-scorecard-engine";
import { istanbulDay } from "@/lib/metrics/istanbul-time";
import { scorecardBlocker, studioRecordRows } from "@/lib/prediction/scorecard-studio";
import { FINISHED_STATUSES } from "@/lib/prediction/settle";
import { parseFixtureId, toFixtureId } from "@/lib/services/api-football";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tahmin Karnesi — betrix.pro",
  description: "Onaylanan tahminlerin tuttu/tutmadı karnesi — maç ve dönem",
};

// Sonuçlar admin tıklamasıyla yazılır, liste her açılışta güncel okunur (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

interface ScorecardPageProps {
  /** Maç Merkezi'nin "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile A'yı açar; yoksa yalnızca B. */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

async function MatchSection({ apiId }: { apiId: number }) {
  const fixtureId = toFixtureId(apiId);
  const match = await loadScorecardMatch(fixtureId);
  if (!match.ok) return <Notice>{match.error.message}</Notice>;
  const { home, away, score } = match.data;
  const finished = FINISHED_STATUSES.has(score.statusShort);
  const loaded = await loadFixtureRecords(fixtureId);
  const rows = studioRecordRows(loaded, { home: home.name, away: away.name });
  const blocker = finished ? scorecardBlocker(loaded) : `Maç bitmedi (${score.statusShort}) — Tahmin Karnesi yalnızca biten maçta üretilir.`;
  const fulltime = score.fulltime ? `${score.fulltime.home}–${score.fulltime.away}` : "–";
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {home.name} {fulltime} {away.name}
          </CardTitle>
          <CardDescription>
            {match.data.competition.name} · {match.data.roundLabel} · normal süre skoru{score.halftime ? ` · İY ${score.halftime.home}–${score.halftime.away}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {rows.length === 0 ? (
            <p className="text-amber-300">Bu maç için onaylanmış tahmin yok — kart üretilmez.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rows.map((row) => (
                <li key={row.id} className={cn("flex flex-wrap items-baseline gap-x-2 rounded-md border border-border/60 px-3 py-2", !row.counted && "opacity-60")}>
                  <span className="font-medium text-white">{row.question}</span>
                  <span className="text-muted-foreground">{row.answer}</span>
                  <span className="text-xs text-muted-foreground">{row.approved}</span>
                  <span className="ml-auto text-xs">{row.counted ? row.status : "Tekrar onay — karneye girmez (kayıt silinmez)"}</span>
                </li>
              ))}
            </ul>
          )}
          {rows.length > 0 ? <SettleButton fixtureId={fixtureId} disabledReason={finished ? null : "Maç bitmedi — sonuç hesaplanamaz."} /> : null}
        </CardContent>
      </Card>
      <MatchScorecardForm fixtureId={fixtureId} blocker={blocker} />
    </>
  );
}

export default async function PredictionScorecardPage({ searchParams }: ScorecardPageProps) {
  const params = await searchParams;
  const apiId = typeof params.fixtureId === "string" ? parseFixtureId(params.fixtureId) : null;
  return (
    <>
      <PageHeader
        title="Tahmin Karnesi"
        description="Onaylanan tahminlerin tuttu/tutmadı karnesi. Sayılan tahmin = onaylanmış tahmin; aynı maç + senaryo için yalnızca ilk onay sayılır. Tutmayan tahmin düşürülemez, seçme yok."
      />
      {apiId ? <MatchSection apiId={apiId} /> : <Notice>Maç karnesi (A) için Maç Merkezi&apos;nden biten bir maçta &quot;Tahmin Karnesi&quot;ni seçin. Dönem karnesi (B) aşağıda.</Notice>}
      <PeriodScorecardForm today={istanbulDay(new Date())} />
    </>
  );
}
