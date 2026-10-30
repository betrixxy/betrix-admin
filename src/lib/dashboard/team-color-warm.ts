import { CLUB_COLORS, registerClubColors } from "@/lib/dashboard/club-colors";

/**
 * Logodan otomatik takım rengi — depodan bağımsız çekirdek (2026-10-31). Kart akışlarının `warmTeamColors`'ı ve
 * admin'in "Bütün liglerin takım renklerini çıkar" işi AYNI yoldan geçer: kod tablosundaki takıma dokunulmaz,
 * kaydı olan takım (AUTO ya da APPROVED) yeniden çıkarılmaz (onaylı kayıt asla ezilmez), kalanın rengi logodan
 * çıkarılıp AUTO kaydı açılır (Ad Raporu "Otomatik renkler" onayına düşer). Depo enjekte edilir: sunucu Prisma,
 * birim test bellek içi depo kullanır (DB'siz).
 */

export interface TeamColorRef {
  id: number;
  name: string;
  logoUrl?: string | null | undefined;
}

export interface TeamColorRow {
  teamId: number;
  teamName: string;
  primary: string;
  secondary: string;
  status: "AUTO" | "APPROVED";
}

export interface TeamColors {
  primary: string;
  secondary: string;
}

export interface TeamColorStore {
  /** Verilen takımların mevcut kayıtları. */
  rows(teamIds: readonly number[]): Promise<TeamColorRow[]>;
  /** Logodan renk (`team-color-pick.ts`); logo okunamazsa ya da okunur renk yoksa null. */
  extract(team: TeamColorRef): Promise<TeamColors | null>;
  /** AUTO kaydı açar; aynı anda başka akış yazdıysa ilk yazan kalır (yalnızca oluşturma). */
  create(team: TeamColorRef, colors: TeamColors): Promise<void>;
}

/** Takım başına sonuç: kod tablosunda · kaydı var · yeni AUTO kaydı · renk çıkmadı (logo yok/okunmadı). */
export type TeamColorOutcome = "table" | "existing" | "created" | "no-color";

export async function warmWithStore(teams: readonly TeamColorRef[], store: TeamColorStore): Promise<Map<number, TeamColorOutcome>> {
  const outcomes = new Map<number, TeamColorOutcome>();
  const unique = [...new Map(teams.filter((team) => team.id > 0).map((team) => [team.id, team])).values()];
  for (const team of unique) if (CLUB_COLORS[team.id]) outcomes.set(team.id, "table");
  const missing = unique.filter((team) => !outcomes.has(team.id));
  if (missing.length === 0) return outcomes;
  const rows = await store.rows(missing.map((team) => team.id));
  for (const row of rows) {
    registerClubColors(row.teamId, { name: row.teamName, primary: row.primary, secondary: row.secondary }, row.status);
    outcomes.set(row.teamId, "existing");
  }
  for (const team of missing.filter((candidate) => !outcomes.has(candidate.id))) {
    const colors = team.logoUrl ? await store.extract(team) : null;
    if (!colors) {
      outcomes.set(team.id, "no-color");
      continue;
    }
    await store.create(team, colors);
    registerClubColors(team.id, { name: team.name, ...colors }, "AUTO");
    outcomes.set(team.id, "created");
  }
  return outcomes;
}

/** Ligin güncel sezonu ve takımları — sunucu API-Football'dan (yalnızca okuma), test sabit listeden. */
export interface LeagueTeamSource {
  season(leagueId: number): Promise<number | null>;
  teams(leagueId: number, season: number): Promise<TeamColorRef[] | null>;
}

export type BulkColorStep = { kind: "league"; leagueId: number } | { kind: "extract"; teams: number };

export interface LeagueColorReport {
  /** Ligler boyunca tekil takım sayısı. */
  teams: number;
  table: number;
  existing: number;
  created: number;
  noColor: number;
  /** Sezonu ya da takım listesi okunamayan ligler (API-Football kimliği). */
  failedLeagues: number[];
}

/**
 * Bütün kapsanan liglerin takımları (Avrupa kupalarında aynı takım bir kez) → `warmWithStore`. Yalnızca admin
 * tıklamasıyla çağrılır (zamanlayıcı yok, 1.10). `onStep`: arka plan işinin adımı.
 */
export async function extractLeagueTeamColors(
  leagueIds: readonly number[],
  source: LeagueTeamSource,
  store: TeamColorStore,
  onStep: (step: BulkColorStep) => void = () => {},
): Promise<LeagueColorReport> {
  const teams: TeamColorRef[] = [];
  const failedLeagues: number[] = [];
  for (const leagueId of leagueIds) {
    onStep({ kind: "league", leagueId });
    const season = await source.season(leagueId);
    const list = season === null ? null : await source.teams(leagueId, season);
    if (list === null) failedLeagues.push(leagueId);
    else teams.push(...list);
  }
  onStep({ kind: "extract", teams: new Set(teams.map((team) => team.id)).size });
  const outcomes = [...(await warmWithStore(teams, store)).values()];
  const count = (outcome: TeamColorOutcome) => outcomes.filter((value) => value === outcome).length;
  return { teams: outcomes.length, table: count("table"), existing: count("existing"), created: count("created"), noColor: count("no-color"), failedLeagues };
}
