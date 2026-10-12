import type { Metadata } from "next";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { StandingsForm } from "@/components/features/dashboard/standings/standings-form";
import { getFixtureById, parseFixtureId } from "@/lib/services/api-football";
import { SUPPORTED_LEAGUES, type SupportedLeagueId } from "@/lib/services/api-football/leagues";

export const metadata: Metadata = {
  title: "Puan Durumu — betrix.pro",
  description: "Lig ve sezon seçin; puan tablosu seçilen platform formatında tek kartta",
};

// Canlı puan durumu — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

const DEFAULT_LEAGUE: SupportedLeagueId = "super-lig";

interface StandingsPageProps {
  /** Maç Merkezi / Takvim'in "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile açar: o maçın ligi seçilir. */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

async function initialSelection(fixtureId: string | null): Promise<{ leagueId: SupportedLeagueId; anchor: string | null }> {
  const apiId = fixtureId ? parseFixtureId(fixtureId) : null;
  if (apiId === null) return { leagueId: DEFAULT_LEAGUE, anchor: null };
  const fixture = await getFixtureById(apiId);
  if (!fixture.ok) return { leagueId: DEFAULT_LEAGUE, anchor: null };
  // Kanonik fikstürde desteklenen ligin kimliği `competition.id`dir; desteklenmeyen ligde varsayılan.
  const league = SUPPORTED_LEAGUES.find((candidate) => candidate.id === fixture.data.competition.id);
  return league ? { leagueId: league.id, anchor: fixture.data.id } : { leagueId: DEFAULT_LEAGUE, anchor: null };
}

export default async function StandingsPage({ searchParams }: StandingsPageProps) {
  const params = await searchParams;
  const selection = await initialSelection(typeof params.fixtureId === "string" ? params.fixtureId : null);

  return (
    <>
      <PageHeader
        title="Puan Durumu"
        description="Lig ve sezonu seçin; puan tablosu (kupa grup aşamasında gruplar) seçilen platform formatında çizilir. Dar formatlarda O · AV · P, yatayda tam tablo gösterilir."
      />
      <StandingsForm initialLeagueId={selection.leagueId} anchorFixtureId={selection.anchor} />
    </>
  );
}
