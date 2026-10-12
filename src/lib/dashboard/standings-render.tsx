import { ImageResponse } from "next/og";
import { loadDeepAnalysisFonts } from "@/lib/dashboard/deep-analysis-fonts";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { embedLogo } from "@/lib/dashboard/weekly-fixtures-render";
import { StandingsCard } from "@/skills/render-engine/templates/standings/standings-card";
import type { StandingsCardInput } from "@/types/standings";
import { SOCIAL_FORMATS } from "@/types/studio-formats";

const TEAM_LOGO_SIDE = 128;
const LEAGUE_LOGO_SIDE = 240;

/** "Puan Durumu" kartını PNG olarak çizer (Fal.ai yok — ücretsiz). Logolar yalnızca API-Football medya sunucusundan gömülür. */
export async function renderStandingsCard(input: StandingsCardInput): Promise<Buffer> {
  const rows = input.sections.flatMap((section) => section.rows);
  const [fonts, brandLogo, leagueLogoUrl, teamLogoEntries] = await Promise.all([
    loadDeepAnalysisFonts(),
    loadBrandLogo(),
    embedLogo(input.leagueLogoUrl, LEAGUE_LOGO_SIDE),
    Promise.all(rows.map(async (row) => [row.teamId, await embedLogo(row.logoUrl, TEAM_LOGO_SIDE)] as const)),
  ]);
  const { width, height } = SOCIAL_FORMATS[input.format];
  const response = new ImageResponse(<StandingsCard {...input} leagueLogoUrl={leagueLogoUrl} brandLogo={brandLogo} teamLogos={Object.fromEntries(teamLogoEntries)} />, {
    width,
    height,
    fonts,
  });
  return Buffer.from(await response.arrayBuffer());
}
