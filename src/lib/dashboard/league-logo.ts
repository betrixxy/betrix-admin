import { apiLeagueLogoUrl, chooseLeagueLogo } from "@/lib/dashboard/league-logo-source";
import { findLeagueLogoUrl, leagueLogoTag } from "@/lib/dashboard/media-library";
import { prisma } from "@/lib/prisma";
import { SUPPORTED_LEAGUES } from "@/lib/services/api-football/leagues";

/**
 * Kartta kullanılacak lig logosu adresi (`league-logo-source.ts` kuralı): kütüphane okunamazsa API-Football logosuyla
 * devam eder — logo kartı düşürmez. Adres `embedLeagueLogo` ile gömülür.
 */
export async function preferredLeagueLogo(leagueId: number | null, apiUrl: string | null | undefined): Promise<string> {
  if (leagueId === null) return chooseLeagueLogo(null, apiUrl);
  const admin = await findLeagueLogoUrl(leagueId).catch((error: unknown) => {
    console.error("[league-logo] kütüphane okunamadı:", error);
    return null;
  });
  return chooseLeagueLogo(admin, apiUrl);
}

export type LeagueLogoSource = "admin" | "api" | "none";

export const LEAGUE_LOGO_SOURCE_LABELS: Record<LeagueLogoSource, string> = {
  admin: "Yüklenen logo",
  api: "API-Football logosu",
  none: "Logo yok — yalnızca lig adı",
};

export interface LeagueLogoRow {
  id: number;
  name: string;
  activeUrl: string;
  source: LeagueLogoSource;
  adminAssetId: string | null;
}

/** Lig logoları listesi: desteklenen ligler + arşiv ağacındaki ligler (kimliğe göre tekil; desteklenenler önce). */
export async function listLeagueLogos(): Promise<LeagueLogoRow[]> {
  const leagues = await prisma.league.findMany({ orderBy: [{ sortOrder: "asc" }, { officialName: "asc" }], select: { id: true, officialName: true, logoUrl: true } });
  const known = new Map(leagues.map((league) => [league.id, league]));
  const seen = new Set<number>();
  const base = [
    ...SUPPORTED_LEAGUES.map((league) => ({ id: league.apiFootballId, name: league.name, apiUrl: known.get(league.apiFootballId)?.logoUrl ?? apiLeagueLogoUrl(league.apiFootballId) })),
    ...leagues.map((league) => ({ id: league.id, name: league.officialName, apiUrl: league.logoUrl ?? "" })),
  ].filter((league) => {
    if (seen.has(league.id)) return false;
    seen.add(league.id);
    return true;
  });

  const assets = await prisma.mediaAsset.findMany({
    where: { category: "LOGO", teamId: { in: base.map((league) => leagueLogoTag(league.id)) } },
    orderBy: { createdAt: "desc" },
    select: { id: true, teamId: true, fileUrl: true },
  });
  const newest = new Map<string, { id: string; fileUrl: string }>();
  for (const asset of assets) if (asset.teamId && !newest.has(asset.teamId)) newest.set(asset.teamId, asset);

  return base.map((league) => {
    const admin = newest.get(leagueLogoTag(league.id)) ?? null;
    return {
      id: league.id,
      name: league.name,
      activeUrl: chooseLeagueLogo(admin?.fileUrl, league.apiUrl),
      source: admin ? "admin" : league.apiUrl ? "api" : "none",
      adminAssetId: admin?.id ?? null,
    };
  });
}
