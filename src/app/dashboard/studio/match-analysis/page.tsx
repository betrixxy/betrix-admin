import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { MatchAnalysisForm } from "@/components/features/dashboard/match-analysis-form";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadStudioAnalysisFacts } from "@/lib/dashboard/match-analysis-engine";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { analysisStudioSummary } from "@/lib/match-analysis/studio-summary";
import { getMatchResultRaw, parseFixtureId, toFixtureId } from "@/lib/services/api-football";

export const metadata: Metadata = {
  title: "Maç Analizi — betrix.pro",
  description: "Biten maçın kural tabanlı analizi — olay zaman çizelgesi ve devre devre istatistik",
};

// Maç sonrası olay/devre verisi bir süre değişebilir — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

interface MatchAnalysisPageProps {
  /** Maç Merkezi'nin "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile açar. */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

export default async function MatchAnalysisPage({ searchParams }: MatchAnalysisPageProps) {
  const params = await searchParams;
  const apiId = typeof params.fixtureId === "string" ? parseFixtureId(params.fixtureId) : null;
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  const validation = raw?.ok ? validateMatchResultFixture(raw.data, new Date()) : null;
  const facts = validation?.ok && raw?.ok && raw.data ? await loadStudioAnalysisFacts(raw.data) : null;
  const summary = facts ? analysisStudioSummary(facts) : null;

  return (
    <>
      <PageHeader
        title="Maç Analizi"
        description="Biten maçın kural tabanlı analizi (yapay zekâ yok): 01 olay zaman çizelgesi ve kırılma anları, 02 devre devre istatistik. Veri API-Football olaylarından; devre verisi tek kaynaktan."
      />
      {!apiId ? (
        <Notice>
          Maç seçilmedi. <Link href="/dashboard/matches" className="underline">Maç Merkezi</Link>&apos;nden biten bir maç için &quot;Maç Analizi&quot;ni seçin.
        </Notice>
      ) : null}
      {raw && !raw.ok ? <Notice>Maç verisi alınamadı: {raw.error.message}</Notice> : null}
      {validation && !validation.ok ? <Notice>{validation.error.message}</Notice> : null}
      {facts && summary && apiId ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{summary.title}</CardTitle>
              <CardDescription>{summary.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm text-white sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Kırılma anları (kartta en fazla 2)</div>
                {summary.moments.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {summary.moments.map((moment) => (
                      <li key={moment}>{moment}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">Yok</span>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{summary.events}</p>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">02 · Devre devre</div>
                <span className={facts.halves.available ? undefined : "text-amber-300"}>{summary.halves}</span>
                {summary.facts.map((fact) => (
                  <p key={fact} className="mt-1 text-xs text-muted-foreground">
                    {fact}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
          {facts.warnings.map((warning) => (
            <Notice key={warning}>{warning}</Notice>
          ))}
          <MatchAnalysisForm fixtureId={toFixtureId(apiId)} halvesAvailable={facts.halves.available} />
        </>
      ) : null}
    </>
  );
}
