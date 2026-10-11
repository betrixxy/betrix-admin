import { ImageResponse } from "next/og";
import { loadDeepAnalysisFonts } from "@/lib/dashboard/deep-analysis-fonts";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { WEEKLY_FIXTURES_CARD_SIZE, WeeklyFixturesCard } from "@/skills/render-engine/templates/weekly-fixtures/weekly-fixtures";
import type { WeeklyFixturesCardInput } from "@/types/weekly-fixtures";

/** Logolar yalnızca API-Football medya sunucusundan gömülür — başka adres çizilmez (SSRF). */
const ALLOWED_IMAGE_ORIGIN = "https://media.api-sports.io/";
const TEAM_LOGO_SIDE = 160;
const LEAGUE_LOGO_SIDE = 240;
const MAX_CACHE = 400;

/** Takım/lig logoları değişmez — süreç içinde bir kez indirilir (kartta 20'ye kadar logo var). */
const logoCache = new Map<string, Promise<string>>();

function embedLogo(url: string, side: number): Promise<string> {
  if (!url.startsWith(ALLOWED_IMAGE_ORIGIN)) return Promise.resolve("");
  const key = `${side}:${url}`;
  const cached = logoCache.get(key);
  if (cached) return cached;
  // Geçici ağ hatasına karşı bir kez yeniden denenir; olmazsa logo boş kalır ve önbelleğe girmez.
  const pending = (async () => (await resolveImage(url, side)) ?? (await resolveImage(url, side)) ?? "")();
  if (logoCache.size >= MAX_CACHE) logoCache.clear();
  logoCache.set(key, pending);
  void pending.then((value) => {
    if (!value) logoCache.delete(key);
  });
  return pending;
}

/** "Haftanın Maçları" kartını PNG olarak çizer (Fal.ai yok — ücretsiz). */
export async function renderWeeklyFixturesCard(input: WeeklyFixturesCardInput): Promise<Buffer> {
  const [fonts, brandLogo, leagueLogoUrl, teamLogoEntries] = await Promise.all([
    loadDeepAnalysisFonts(),
    loadBrandLogo(),
    embedLogo(input.leagueLogoUrl, LEAGUE_LOGO_SIDE),
    Promise.all(
      input.matches.map(async (match) => {
        const [home, away] = await Promise.all([embedLogo(match.home.logoUrl, TEAM_LOGO_SIDE), embedLogo(match.away.logoUrl, TEAM_LOGO_SIDE)]);
        return [match.id, { home, away }] as const;
      }),
    ),
  ]);
  const response = new ImageResponse(
    <WeeklyFixturesCard {...input} leagueLogoUrl={leagueLogoUrl} brandLogo={brandLogo} teamLogos={Object.fromEntries(teamLogoEntries)} />,
    { ...WEEKLY_FIXTURES_CARD_SIZE, fonts },
  );
  return Buffer.from(await response.arrayBuffer());
}
