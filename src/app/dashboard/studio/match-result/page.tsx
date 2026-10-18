import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { MatchResultForm } from "@/components/features/dashboard/match-result-form";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { getMatchResultRaw, parseFixtureId, toFixtureId } from "@/lib/services/api-football";
import type { MatchResultFacts, ScorerLine } from "@/types/match-result";

export const metadata: Metadata = {
  title: "Maç Sonucu — betrix.pro",
  description: "Biten maçın skoru, golcüleri ve maçın oyuncusu — maç sonu kartı",
};

// Canlı maç durumu — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Scorers({ lines }: { lines: ScorerLine[] }) {
  if (lines.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((line) => (
        <li key={`${line.playerId ?? line.name}-${line.minutes[0] ?? ""}`}>
          {line.name} <span className="text-orange-300">{line.minutes.join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

function FactsSummary({ facts }: { facts: MatchResultFacts }) {
  const penalty = facts.penaltyScore ? ` (P ${facts.penaltyScore})` : "";
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {facts.home.name} {facts.home.goals} – {facts.away.goals} {facts.away.name}
          {penalty}
        </CardTitle>
        <CardDescription>
          {facts.competition.name} · {facts.roundLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm text-white sm:grid-cols-3">
        <div>
          <div className="mb-1 text-xs text-muted-foreground">{facts.home.name} golleri</div>
          <Scorers lines={facts.home.scorers} />
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">{facts.away.name} golleri</div>
          <Scorers lines={facts.away.scorers} />
        </div>
        <div>
          <div className="mb-1 text-xs text-muted-foreground">Maçın oyuncusu (öneri)</div>
          {facts.mvp ? (
            <span>
              {facts.mvp.name}
              {facts.mvp.rating !== null ? ` · ${facts.mvp.rating.toFixed(1)}` : ""}
              {facts.mvp.goals > 0 ? ` · ${facts.mvp.goals} gol` : ""}
            </span>
          ) : (
            <span className="text-muted-foreground">Veri yok — elle seçilecek</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface MatchResultPageProps {
  /** Maç Merkezi'nin "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile açar. */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

export default async function MatchResultPage({ searchParams }: MatchResultPageProps) {
  const params = await searchParams;
  const apiId = typeof params.fixtureId === "string" ? parseFixtureId(params.fixtureId) : null;
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  const validation = raw?.ok ? validateMatchResultFixture(raw.data, new Date()) : null;

  return (
    <>
      <PageHeader
        title="Maç Sonucu"
        description="Biten maçın skoru ve golcüleri, gerçek maç fotoğrafı üstünde (tam kadraj). Maçı Maç Merkezi'nden seçin; kart yalnızca biten maçlar (FT/AET/PEN) için üretilir."
      />

      {!apiId ? (
        <Notice>
          Maç seçilmedi. <Link href="/dashboard/matches" className="underline">Maç Merkezi</Link>&apos;nden biten bir maç için &quot;Maç Sonucu&quot;nu seçin.
        </Notice>
      ) : null}
      {raw && !raw.ok ? <Notice>Maç verisi alınamadı: {raw.error.message}</Notice> : null}
      {validation && !validation.ok ? <Notice>{validation.error.message}</Notice> : null}
      {validation?.ok && apiId ? (
        <>
          <FactsSummary facts={validation.data} />
          <MatchResultForm
            fixtureId={toFixtureId(apiId)}
            facts={validation.data}
          />
        </>
      ) : null}
    </>
  );
}
