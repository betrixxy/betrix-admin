import { renderSatori } from "@/skills/render-engine/satori-text";
import { bandSafeArea, layoutGate } from "@/lib/dashboard/layout-check";
import { loadStudioFonts } from "@/lib/dashboard/studio-fonts";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { LEAGUE_CARD_BLOCKS } from "@/skills/render-engine/templates/weekly-fixtures/league-card-chrome";
import type { Result } from "@/types/result";
import { loadBrandLogo } from "@/lib/dashboard/match-day-assets";
import { embedLogo } from "@/lib/dashboard/weekly-fixtures-render";
import { StandingsCard } from "@/skills/render-engine/templates/standings/standings-card";
import type { StandingsCardInput } from "@/types/standings";
import { SOCIAL_FORMATS } from "@/types/studio-formats";

const TEAM_LOGO_SIDE = 128;

/** Kartı (ya da yerleşim kapısı için tek bloğunu) çizer. Logolar yalnızca API-Football medya sunucusundan gömülür. */
export async function drawStandingsCard(input: StandingsCardInput, only?: BlockFilter): Promise<Buffer> {
  const rows = input.sections.flatMap((section) => section.rows);
  const [fonts, brandLogo, leagueLogoUrl, teamLogoEntries] = await Promise.all([
    loadStudioFonts(),
    loadBrandLogo(),
    // Lig logosu kartta kullanılmaz — lig adı üst satırda tipografik.
    Promise.resolve(""),
    Promise.all(rows.map(async (row) => [row.teamId, await embedLogo(row.logoUrl, TEAM_LOGO_SIDE)] as const)),
  ]);
  const { width, height } = SOCIAL_FORMATS[input.format];
  const response = renderSatori(<StandingsCard {...input} leagueLogoUrl={leagueLogoUrl} brandLogo={brandLogo} teamLogos={Object.fromEntries(teamLogoEntries)} only={only} />, {
    width,
    height,
    fonts,
  });
  return Buffer.from(await response.arrayBuffer());
}

/** "Puan Durumu" kartını PNG olarak çizer (Fal.ai yok — ücretsiz) — önce yerleşim kapısı (logo dahil bütün bloklar). */
export async function renderStandingsCard(input: StandingsCardInput): Promise<Result<Buffer>> {
  const frame = SOCIAL_FORMATS[input.format];
  const gate = await layoutGate("Puan Durumu", frame, (only) => drawStandingsCard(input, only), LEAGUE_CARD_BLOCKS, bandSafeArea(frame));
  if (!gate.ok) return gate;
  return { ok: true, data: await drawStandingsCard(input) };
}
