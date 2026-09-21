import {
  addDays,
  nextSaturday,
  nextSunday,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
  subDays,
} from "date-fns";
import {
  getSupportedLeague,
  type SupportedLeague,
  type SupportedLeagueId,
} from "@/lib/services/api-football/leagues";
import type {
  AdPlatform,
  AdSpend,
  CalendarFixture,
  CompetitionRef,
  ContentPlan,
  DerbyIntensity,
} from "@/types/calendar";

function atTime(base: Date, hours: number, minutes: number): Date {
  return setMilliseconds(setSeconds(setMinutes(setHours(base, hours), minutes), 0), 0);
}

function toIso(date: Date): string {
  return date.toISOString();
}

/** API-Football'un standart takım logosu medya URL'i (bkz. media.api-sports.io). */
function teamLogo(apiFootballTeamId: number): string {
  return `https://media.api-sports.io/football/teams/${apiFootballTeamId}.png`;
}

function competitionOf(leagueId: SupportedLeagueId): CompetitionRef {
  const league: SupportedLeague = getSupportedLeague(leagueId);
  return { id: league.id, name: league.name, shortName: league.shortName };
}

/**
 * İçerik planı yalnızca RIVALRY/DERBY/ELITE_DERBY seviyesindeki maçlara otomatik
 * atanır — sıradan (`NONE`) maçlar plansız kalır ve bu yüzden takvimde gösterilmez
 * (bkz. `hasContentPlan` + month-grid.tsx).
 */
function buildContentPlan(
  fixtureId: string,
  derbyIntensity: DerbyIntensity,
  kickoff: Date,
  leadDays: number,
  platforms: AdPlatform[],
  adSpend: Omit<AdSpend, "currency">,
): ContentPlan | undefined {
  if (derbyIntensity === "NONE") return undefined;

  return {
    id: `cp-${fixtureId}`,
    fixtureId,
    scheduledFor: toIso(subDays(kickoff, leadDays)),
    platforms,
    adSpend: { ...adSpend, currency: "TRY" },
  };
}

/**
 * API-Football'dan geliyormuş gibi kurgulanmış fikstür + içerik planı verisi.
 * Sadece `SUPPORTED_LEAGUES` kapsamındaki liglerden üretilir (bkz. CLAUDE.md 2.1).
 * Hafta sonu için kritik derbileri, hafta içi için sıradan maçları ve CRM'in geriye
 * dönük veri tutma vizyonunu göstermek için birkaç arşiv (geçmiş) kaydı içerir.
 */
export function getMockFixtures(referenceDate: Date = new Date()): CalendarFixture[] {
  const saturday = nextSaturday(referenceDate);
  const sunday = nextSunday(referenceDate);

  const besiktasKickoff = atTime(addDays(referenceDate, 1), 19, 0);
  const bayernKickoff = atTime(addDays(referenceDate, 2), 21, 30);
  const psgKickoff = atTime(addDays(referenceDate, 4), 22, 0);
  const gsFbKickoff = atTime(saturday, 19, 0);
  const livMciKickoff = atTime(saturday, 16, 30);
  const rmaFcbKickoff = atTime(sunday, 21, 0);
  const arsTotKickoff = atTime(sunday, 17, 0);
  const trabzonKonyaKickoff = atTime(sunday, 19, 0);

  const archiveInterMilanKickoff = atTime(subDays(referenceDate, 5), 21, 45);
  const archiveChelseaArsenalKickoff = atTime(subDays(referenceDate, 14), 18, 30);
  const archiveFbGsKickoff = atTime(subDays(referenceDate, 33), 19, 0);

  const fixtures: CalendarFixture[] = [
    {
      id: "fx-besiktas-basaksehir",
      providerIds: { apiFootball: 19301 },
      kickoffUtc: toIso(besiktasKickoff),
      status: "SCHEDULED",
      homeTeam: { id: "bjk", name: "Beşiktaş", shortName: "BJK", primaryColorHex: "#000000", logoUrl: teamLogo(549) },
      awayTeam: { id: "ibfk", name: "İstanbul Başakşehir", shortName: "İBFK", primaryColorHex: "#F58220", logoUrl: teamLogo(558) },
      competition: competitionOf("super-lig"),
      derbyIntensity: "NONE",
      // NONE yoğunluk -> otomatik içerik planı yok, takvime düşmez.
      contentStatus: "idea",
      contentPlan: buildContentPlan("fx-besiktas-basaksehir", "NONE", besiktasKickoff, 1, [], {}),
    },
    {
      id: "fx-bayern-dortmund",
      providerIds: { apiFootball: 19302 },
      kickoffUtc: toIso(bayernKickoff),
      status: "SCHEDULED",
      homeTeam: { id: "fcb", name: "Bayern Münih", shortName: "FCB", primaryColorHex: "#DC052D", logoUrl: teamLogo(157) },
      awayTeam: { id: "bvb", name: "Borussia Dortmund", shortName: "BVB", primaryColorHex: "#FDE100", logoUrl: teamLogo(165) },
      competition: competitionOf("bundesliga"),
      derbyIntensity: "DERBY",
      contentStatus: "pending",
      contentPlan: buildContentPlan("fx-bayern-dortmund", "DERBY", bayernKickoff, 2, ["meta", "tiktok"], {
        meta: 1500,
        tiktok: 600,
      }),
    },
    {
      id: "fx-psg-marsilya",
      providerIds: { apiFootball: 19303 },
      kickoffUtc: toIso(psgKickoff),
      status: "SCHEDULED",
      homeTeam: { id: "psg", name: "Paris Saint-Germain", shortName: "PSG", primaryColorHex: "#004170", logoUrl: teamLogo(85) },
      awayTeam: { id: "om", name: "Olympique de Marseille", shortName: "OM", primaryColorHex: "#2FAEE0", logoUrl: teamLogo(81) },
      competition: competitionOf("ligue-1"),
      derbyIntensity: "RIVALRY",
      contentStatus: "idea",
      contentPlan: buildContentPlan("fx-psg-marsilya", "RIVALRY", psgKickoff, 1, ["meta", "tiktok"], {}),
    },
    {
      id: "fx-gs-fb",
      providerIds: { apiFootball: 19310 },
      kickoffUtc: toIso(gsFbKickoff),
      status: "SCHEDULED",
      homeTeam: { id: "gs", name: "Galatasaray", shortName: "GS", primaryColorHex: "#A90432", logoUrl: teamLogo(645) },
      awayTeam: { id: "fb", name: "Fenerbahçe", shortName: "FB", primaryColorHex: "#FFDD00", logoUrl: teamLogo(611) },
      competition: competitionOf("super-lig"),
      derbyIntensity: "ELITE_DERBY",
      contentStatus: "pending",
      contentPlan: buildContentPlan(
        "fx-gs-fb",
        "ELITE_DERBY",
        gsFbKickoff,
        2,
        ["meta", "tiktok", "youtube", "x"],
        { meta: 4500, tiktok: 3000, youtube: 1500, x: 800 },
      ),
    },
    {
      id: "fx-liv-mci",
      providerIds: { apiFootball: 19311 },
      kickoffUtc: toIso(livMciKickoff),
      status: "SCHEDULED",
      homeTeam: { id: "liv", name: "Liverpool", shortName: "LIV", primaryColorHex: "#C8102E", logoUrl: teamLogo(40) },
      awayTeam: { id: "mci", name: "Manchester City", shortName: "MCI", primaryColorHex: "#6CABDD", logoUrl: teamLogo(50) },
      competition: competitionOf("premier-league"),
      derbyIntensity: "DERBY",
      contentStatus: "pending",
      contentPlan: buildContentPlan("fx-liv-mci", "DERBY", livMciKickoff, 1, ["meta", "tiktok", "x"], {
        meta: 2200,
        tiktok: 1200,
        x: 400,
      }),
    },
    {
      id: "fx-rma-fcb",
      providerIds: { apiFootball: 19312 },
      kickoffUtc: toIso(rmaFcbKickoff),
      status: "SCHEDULED",
      homeTeam: { id: "rma", name: "Real Madrid", shortName: "RMA", primaryColorHex: "#FEBE10", logoUrl: teamLogo(541) },
      awayTeam: { id: "fcb-la-liga", name: "Barcelona", shortName: "FCB", primaryColorHex: "#A50044", logoUrl: teamLogo(529) },
      competition: competitionOf("la-liga"),
      derbyIntensity: "ELITE_DERBY",
      contentStatus: "produced",
      contentPlan: buildContentPlan(
        "fx-rma-fcb",
        "ELITE_DERBY",
        rmaFcbKickoff,
        2,
        ["meta", "tiktok", "youtube", "x"],
        { meta: 5500, tiktok: 3200, youtube: 2000, x: 1000 },
      ),
    },
    {
      id: "fx-ars-tot",
      providerIds: { apiFootball: 19313 },
      kickoffUtc: toIso(arsTotKickoff),
      status: "SCHEDULED",
      homeTeam: { id: "ars", name: "Arsenal", shortName: "ARS", primaryColorHex: "#EF0107", logoUrl: teamLogo(42) },
      awayTeam: { id: "tot", name: "Tottenham", shortName: "TOT", primaryColorHex: "#132257", logoUrl: teamLogo(47) },
      competition: competitionOf("premier-league"),
      derbyIntensity: "DERBY",
      contentStatus: "idea",
      contentPlan: buildContentPlan("fx-ars-tot", "DERBY", arsTotKickoff, 1, ["meta"], {}),
    },
    {
      id: "fx-trabzon-konya",
      providerIds: { apiFootball: 19314 },
      kickoffUtc: toIso(trabzonKonyaKickoff),
      status: "SCHEDULED",
      homeTeam: { id: "trabzon", name: "Trabzonspor", shortName: "TS", primaryColorHex: "#800000", logoUrl: teamLogo(998) },
      awayTeam: { id: "konya", name: "Konyaspor", shortName: "KON", primaryColorHex: "#00A651", logoUrl: teamLogo(1004) },
      competition: competitionOf("super-lig"),
      derbyIntensity: "NONE",
      // NONE yoğunluk -> otomatik içerik planı yok, takvime düşmez.
      contentStatus: "idea",
      contentPlan: buildContentPlan("fx-trabzon-konya", "NONE", trabzonKonyaKickoff, 1, [], {}),
    },
    // Arşiv — CRM'in geriye dönük veri tutma vizyonunu göstermek için tamamlanmış içerikler.
    {
      id: "fx-archive-inter-milan",
      providerIds: { apiFootball: 19320 },
      kickoffUtc: toIso(archiveInterMilanKickoff),
      status: "FT",
      homeTeam: { id: "inter", name: "Inter", shortName: "INT", primaryColorHex: "#0068A8", logoUrl: teamLogo(505) },
      awayTeam: { id: "milan", name: "AC Milan", shortName: "MIL", primaryColorHex: "#FB090B", logoUrl: teamLogo(489) },
      competition: competitionOf("serie-a"),
      derbyIntensity: "ELITE_DERBY",
      contentStatus: "produced",
      contentPlan: buildContentPlan(
        "fx-archive-inter-milan",
        "ELITE_DERBY",
        archiveInterMilanKickoff,
        2,
        ["meta", "tiktok", "youtube", "x"],
        { meta: 3000, tiktok: 1800, youtube: 900, x: 400 },
      ),
    },
    {
      id: "fx-archive-chelsea-arsenal",
      providerIds: { apiFootball: 19321 },
      kickoffUtc: toIso(archiveChelseaArsenalKickoff),
      status: "FT",
      homeTeam: { id: "chelsea", name: "Chelsea", shortName: "CHE", primaryColorHex: "#034694", logoUrl: teamLogo(49) },
      awayTeam: { id: "arsenal-away", name: "Arsenal", shortName: "ARS", primaryColorHex: "#EF0107", logoUrl: teamLogo(42) },
      competition: competitionOf("premier-league"),
      derbyIntensity: "DERBY",
      contentStatus: "produced",
      contentPlan: buildContentPlan(
        "fx-archive-chelsea-arsenal",
        "DERBY",
        archiveChelseaArsenalKickoff,
        1,
        ["meta", "tiktok"],
        { meta: 2200, tiktok: 1000 },
      ),
    },
    {
      id: "fx-archive-fb-gs",
      providerIds: { apiFootball: 19322 },
      kickoffUtc: toIso(archiveFbGsKickoff),
      status: "FT",
      homeTeam: { id: "fb-home", name: "Fenerbahçe", shortName: "FB", primaryColorHex: "#FFDD00", logoUrl: teamLogo(611) },
      awayTeam: { id: "gs-away", name: "Galatasaray", shortName: "GS", primaryColorHex: "#A90432", logoUrl: teamLogo(645) },
      competition: competitionOf("super-lig"),
      derbyIntensity: "ELITE_DERBY",
      contentStatus: "produced",
      contentPlan: buildContentPlan(
        "fx-archive-fb-gs",
        "ELITE_DERBY",
        archiveFbGsKickoff,
        2,
        ["meta", "tiktok", "youtube", "x"],
        { meta: 7500, tiktok: 4500, youtube: 2500, x: 1200 },
      ),
    },
  ];

  return fixtures.sort((a, b) =>
    (a.contentPlan?.scheduledFor ?? a.kickoffUtc).localeCompare(
      b.contentPlan?.scheduledFor ?? b.kickoffUtc,
    ),
  );
}
