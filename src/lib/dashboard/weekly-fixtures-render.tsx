import { renderSatori } from "@/skills/render-engine/satori-text";
import { bandSafeArea, layoutGate } from "@/lib/dashboard/layout-check";
import { loadStudioFonts } from "@/lib/dashboard/studio-fonts";
import type { BlockFilter } from "@/skills/render-engine/templates/checkmatch-set/blocks";
import { LEAGUE_CARD_BLOCKS } from "@/skills/render-engine/templates/weekly-fixtures/league-card-chrome";
import type { Result } from "@/types/result";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { WeeklyFixturesCard } from "@/skills/render-engine/templates/weekly-fixtures/weekly-fixtures";
import { SOCIAL_FORMATS } from "@/types/studio-formats";
import type { WeeklyFixturesCardInput } from "@/types/weekly-fixtures";

/** Logolar yalnızca API-Football medya sunucusundan gömülür — başka adres çizilmez (SSRF). */
const ALLOWED_IMAGE_ORIGIN = "https://media.api-sports.io/";
const TEAM_LOGO_SIDE = 160;
const MAX_CACHE = 400;

/** Takım/lig logoları değişmez — süreç içinde bir kez indirilir (kartta 20'ye kadar logo var). */
const logoCache = new Map<string, Promise<string>>();

/** API-Football logosunu data URL olarak gömer (önbellekli) — lig kartları (Haftanın Maçları, Puan Durumu) ortak kullanır. */
export function embedLogo(url: string, side: number): Promise<string> {
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

/** Kartı (ya da yerleşim kapısı için tek bloğunu) çizer — logolar/fontlar süreç içinde önbellekli. */
export async function drawWeeklyFixturesCard(input: WeeklyFixturesCardInput, only?: BlockFilter): Promise<Buffer> {
  const [fonts, brandLogo, leagueLogoUrl, teamLogoEntries] = await Promise.all([
    loadStudioFonts(),
    loadBrandLogo(),
    // Lig logosu kartta kullanılmaz — lig adı üst satırda tipografik.
    Promise.resolve(""),
    Promise.all(
      input.matches.map(async (match) => {
        const [home, away] = await Promise.all([embedLogo(match.home.logoUrl, TEAM_LOGO_SIDE), embedLogo(match.away.logoUrl, TEAM_LOGO_SIDE)]);
        return [match.id, { home, away }] as const;
      }),
    ),
  ]);
  const response = renderSatori(
    <WeeklyFixturesCard {...input} leagueLogoUrl={leagueLogoUrl} brandLogo={brandLogo} teamLogos={Object.fromEntries(teamLogoEntries)} only={only} />,
    { width: SOCIAL_FORMATS[input.format].width, height: SOCIAL_FORMATS[input.format].height, fonts },
  );
  return Buffer.from(await response.arrayBuffer());
}

/**
 * "Haftanın Maçları" kartını PNG olarak çizer (Fal.ai yok — ücretsiz). Önce yerleşim kapısı: logo dahil
 * bütün bloklar birbiriyle ve güvenli alanla çakışmamalı; çakışmada kart üretilmez, sebep döner.
 */
export async function renderWeeklyFixturesCard(input: WeeklyFixturesCardInput): Promise<Result<Buffer>> {
  const frame = SOCIAL_FORMATS[input.format];
  const gate = await layoutGate("Haftanın Maçları", frame, (only) => drawWeeklyFixturesCard(input, only), LEAGUE_CARD_BLOCKS, bandSafeArea(frame));
  if (!gate.ok) return gate;
  return { ok: true, data: await drawWeeklyFixturesCard(input) };
}
