import type { Metadata } from "next";
import { WeeklyFixturesForm } from "@/components/features/dashboard/weekly-fixtures/weekly-fixtures-form";
import { PageHeader } from "@/components/features/dashboard/page-header";
import { getFixtureById, parseFixtureId } from "@/lib/services/api-football";
import { SUPPORTED_LEAGUES, type SupportedLeagueId } from "@/lib/services/api-football/leagues";
import { roundKeyOf } from "@/lib/services/api-football/weekly-mappers";

export const metadata: Metadata = {
  title: "Haftanın Maçları — betrix.pro",
  description: "Lig ve hafta seçin; maç programı ve skorlar Türkiye saatiyle tek kartta",
};

// Canlı fikstür/skor — statik önbelleğe alınmaz (bkz. CLAUDE.md 1.5).
export const dynamic = "force-dynamic";

const DEFAULT_LEAGUE: SupportedLeagueId = "super-lig";

interface WeeklyFixturesPageProps {
  /** Maç Merkezi / Takvim'in "Stüdyoya Git" bağlantısı `?fixtureId=api-football-<id>` ile açar: o maçın ligi ve turu seçilir. */
  searchParams: Promise<{ fixtureId?: string | string[] }>;
}

async function initialSelection(fixtureId: string | null): Promise<{ leagueId: SupportedLeagueId; roundKey: string | null; anchor: string | null }> {
  const apiId = fixtureId ? parseFixtureId(fixtureId) : null;
  if (apiId === null) return { leagueId: DEFAULT_LEAGUE, roundKey: null, anchor: null };
  const fixture = await getFixtureById(apiId);
  if (!fixture.ok) return { leagueId: DEFAULT_LEAGUE, roundKey: null, anchor: null };
  const round = fixture.data.details?.round;
  // Kanonik fikstürde desteklenen ligin kimliği `competition.id`dir (bkz. mappers.ts::mapCompetition); desteklenmeyen ligde varsayılan.
  const league = SUPPORTED_LEAGUES.find((candidate) => candidate.id === fixture.data.competition.id);
  if (!league) return { leagueId: DEFAULT_LEAGUE, roundKey: null, anchor: null };
  return { leagueId: league.id, roundKey: round ? roundKeyOf(round) : null, anchor: fixture.data.id };
}

export default async function WeeklyFixturesPage({ searchParams }: WeeklyFixturesPageProps) {
  const params = await searchParams;
  const selection = await initialSelection(typeof params.fixtureId === "string" ? params.fixtureId : null);

  return (
    <>
      <PageHeader
        title="Haftanın Maçları"
        description="Lig ve haftayı seçin; turun maçları günlere (kupa grup aşamasında gruplara) bölünmüş tek kartta, oynanmamışsa saatiyle, oynanmışsa skoruyla çizilir. Tüm saatler Türkiye saatidir."
      />
      <WeeklyFixturesForm initialLeagueId={selection.leagueId} initialRoundKey={selection.roundKey} anchorFixtureId={selection.anchor} />
    </>
  );
}
