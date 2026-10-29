import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { PlayerStatsForm, type PlayerOption } from "@/components/features/dashboard/player-stats-form";
import { validateMatchResultFixture } from "@/lib/dashboard/match-result-studio";
import { loadPlayerStatsFacts, playerCardNames } from "@/lib/dashboard/player-stats-studio";
import { formatNumber } from "@/lib/format/number";
import { POSITION_LABELS } from "@/lib/player-stats/catalog";
import { spotlightOptions, topPlayers } from "@/lib/player-stats/picks";
import { getMatchResultRaw, parseFixtureId, toFixtureId } from "@/lib/services/api-football";

export const metadata: Metadata = {
  title: "Oyuncu İstatistikleri — betrix.pro",
  description: "Biten maçın oyuncu kartları — Maçın Oyuncusu ve Maçın En İyileri",
};

// Maç sonrası veri kesinleşene kadar değişir — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

interface PlayerStatsPageProps {
  /** Maç Merkezi'nin "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile açar. */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

export default async function PlayerStatsPage({ searchParams }: PlayerStatsPageProps) {
  const params = await searchParams;
  const apiId = typeof params.fixtureId === "string" ? parseFixtureId(params.fixtureId) : null;
  const raw = apiId ? await getMatchResultRaw(apiId) : null;
  const validation = raw?.ok ? validateMatchResultFixture(raw.data, new Date()) : null;
  const facts = validation?.ok && raw?.ok && raw.data ? await loadPlayerStatsFacts(raw.data, new Date()) : null;
  const candidates = facts ? spotlightOptions(facts.lines) : [];
  const names = facts ? await playerCardNames(facts, candidates) : new Map();
  const options: PlayerOption[] = facts
    ? candidates.map((line) => ({
        playerId: line.playerId,
        label: [names.get(line.playerId)?.name ?? line.name, line.side === "HOME" ? facts.match.home.name : facts.match.away.name, line.position ? POSITION_LABELS[line.position].toLocaleLowerCase("tr-TR") : null, line.rating !== null ? formatNumber(line.rating, { decimals: 1 }) : null, `${line.minutes ?? 0} dk`]
          .filter(Boolean)
          .join(" · "),
      }))
    : [];

  return (
    <>
      <PageHeader
        title="Oyuncu İstatistikleri"
        description="Biten maçın oyuncu kartları: A · Maçın Oyuncusu (tam kadraj ya da tipografik) ve B · Maçın En İyileri. Veri API-Football maç oyuncu istatistiklerinden; eksik satır yazılmaz."
      />
      {!apiId ? (
        <Notice>
          Maç seçilmedi. <Link href="/dashboard/matches" className="underline">Maç Merkezi</Link>&apos;nden biten bir maç için &quot;Oyuncu İstatistikleri&quot;ni seçin.
        </Notice>
      ) : null}
      {raw && !raw.ok ? <Notice>Maç verisi alınamadı: {raw.error.message}</Notice> : null}
      {validation && !validation.ok ? <Notice>{validation.error.message}</Notice> : null}
      {facts && !facts.settlement.settled ? (
        <Notice>
          Oyuncu verisi henüz kesinleşmedi — {facts.settlement.reason} Kart eksik veriyle üretilmez.{" "}
          <Link href={`/dashboard/studio/player-stats?fixtureId=${toFixtureId(facts.match.fixtureId)}`} className="inline-flex items-center gap-1 underline">
            <RotateCw className="size-3.5" /> Yeniden dene
          </Link>
        </Notice>
      ) : null}
      {facts && apiId ? (
        <PlayerStatsForm
          fixtureId={toFixtureId(apiId)}
          title={`${facts.match.home.name} ${facts.match.home.goals}–${facts.match.away.goals} ${facts.match.away.name}`}
          subtitle={`${facts.match.competition.name} · ${facts.match.roundLabel}`}
          teams={[{ id: facts.match.home.id, name: facts.match.home.name }, { id: facts.match.away.id, name: facts.match.away.name }]}
          players={options}
          defaultPlayerId={facts.match.mvp?.playerId ?? null}
          topAvailable={topPlayers(facts.lines, 5).length}
          xgNote={facts.sportmonksMatched ? `xG: Sportmonks'ta dakikası birebir tutan ${facts.xgMatched} oyuncu` : "xG yok: Sportmonks maçı eşleşmedi"}
          settled={facts.settlement.settled}
        />
      ) : null}
    </>
  );
}
