/**
 * Maç Analizi offline render — DB'ye YAZMAZ ve OKUMAZ, deploy'suz tasarım/denetim aracı. Bitmiş maçı API-Football'dan
 * okur (`/fixtures?id=` + devre istatistiği; yetmezse Sportmonks dönemleri — tek kaynak kuralı), kişi adlarını
 * veritabanısız Sportmonks kadrosundan (arşiv düzeltmesi yok) kurar, 01 + 02'yi istenen formatlarda çizer
 * (yerleşim + bahis dili kapısı dahil). Yapay zekâ ve Fal yok. Maç henüz bitmediyse en sık 2 dakikada bir sorar.
 * 02 düşerse sebebi PNG'nin yanına .txt olarak yazar. Çıktılar `--out` klasörüne (repoya YAZMAYIN).
 *
 *   npx tsx --env-file=<.env.local> scripts/render-match-analysis.ts --fixture 1584455 \
 *     --out C:\...\son-kartlar --slug konyaspor-galatasaray [--formats IG_PORTRAIT|all] [--wait-minutes 150]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { buildMatchAnalysisCaption } from "@/lib/dashboard/match-analysis-caption";
import { buildHalvesCard, buildTimelineCard } from "@/lib/dashboard/match-analysis-card";
import { loadMatchAnalysisFacts, type AnalysisDeps } from "@/lib/dashboard/match-analysis-data";
import { renderHalvesImage, renderTimelineImage } from "@/lib/dashboard/match-analysis-render";
import { loadBrandLogo, resolveImage } from "@/lib/dashboard/match-day-assets";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { originFromCountry, UNKNOWN_ORIGIN, type TeamOrigin } from "@/lib/dashboard/name-case";
import { halfSourceLabel } from "@/lib/match-analysis/halves";
import { getMatchResultRaw } from "@/lib/services/api-football/match-result";
import { FINISHED_STATUSES } from "@/lib/services/api-football/match-result-mappers";
import { getTeamInfo } from "@/lib/services/api-football/team-directory";
import type { ApiFootballFixtureResultRaw } from "@/lib/services/api-football/types";
import { findSportmonksTeamId, getSportmonksSquad } from "@/lib/services/sportmonks/people";
import { MATCH_DAY_FORMAT_IDS, type MatchDayFormatId } from "@/types/match-day";

const { values } = parseArgs({
  options: {
    fixture: { type: "string", default: "1584455" },
    out: { type: "string" },
    slug: { type: "string", default: "mac" },
    formats: { type: "string", default: "IG_PORTRAIT" },
    "wait-minutes": { type: "string", default: "150" },
  },
});

const POLL_MS = 2 * 60 * 1000;
const RATIO_SLUG: Record<MatchDayFormatId, string> = { IG_PORTRAIT: "4x5", IG_SQUARE: "1x1", STORY: "9x16", X_LANDSCAPE: "16x9" };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Bitmiş maç yanıtı; bitmediyse en sık 2 dakikada bir yeniden sorar (üst sınır `--wait-minutes`). */
async function finishedMatch(fixtureId: number, waitMinutes: number): Promise<ApiFootballFixtureResultRaw> {
  const deadline = Date.now() + waitMinutes * 60 * 1000;
  for (;;) {
    const raw = await getMatchResultRaw(fixtureId);
    if (!raw.ok) throw new Error(`API-Football: ${raw.error.code} ${raw.error.message}`);
    if (!raw.data) throw new Error(`Maç bulunamadı: ${fixtureId}`);
    const status = raw.data.fixture.status.short;
    if (FINISHED_STATUSES.some((done) => done === status)) return raw.data;
    if (Date.now() + POLL_MS > deadline) throw new Error(`Maç bitmedi (durum ${status}); bekleme süresi doldu.`);
    console.log(`Maç henüz bitmedi (${status} ${raw.data.fixture.status.elapsed ?? ""}') — 2 dk sonra tekrar.`);
    await sleep(POLL_MS);
  }
}

/** Veritabanısız bağımlılıklar: köken API-Football `/teams?id=` ülkesinden, adlar Sportmonks kadrosundan. */
function offlineDeps(raw: ApiFootballFixtureResultRaw): AnalysisDeps {
  const countries = new Map<number, string | null>();
  const country = async (teamId: number) => {
    if (!countries.has(teamId)) {
      const info = await getTeamInfo(teamId);
      countries.set(teamId, info.ok && info.data ? info.data.country : null);
    }
    return countries.get(teamId) ?? null;
  };
  const origin = async (teamId: number): Promise<TeamOrigin> => {
    const people = originFromCountry(await country(teamId));
    return people ? { name: people, people } : UNKNOWN_ORIGIN;
  };
  const providerName = (teamId: number) => (teamId === raw.teams.home.id ? raw.teams.home.name : raw.teams.away.name);
  return {
    async withOrigins(match) {
      const [home, away] = await Promise.all([origin(match.home.id), origin(match.away.id)]);
      return { ...match, home: { ...match.home, origin: home }, away: { ...match.away, origin: away } };
    },
    async teamPeople(team) {
      const sportmonksId = await findSportmonksTeamId(providerName(team.id), await country(team.id));
      const people = sportmonksId === null ? [] : ((await getSportmonksSquad(sportmonksId)) ?? []);
      console.log(`Kadro (${team.name}): Sportmonks ${sportmonksId ?? "eşleşmedi"}, ${people.length} kişi`);
      return { people, overrides: new Map(), teamHint: team.origin?.people ?? null };
    },
  };
}

async function main() {
  if (!values.out) throw new Error("--out <klasör> gerekli (repo dışında).");
  const fixtureId = Number(values.fixture);
  const formats = values.formats === "all" ? [...MATCH_DAY_FORMAT_IDS] : (values.formats ?? "IG_PORTRAIT").split(",").filter((id): id is MatchDayFormatId => MATCH_DAY_FORMAT_IDS.some((known) => known === id));
  const raw = await finishedMatch(fixtureId, Number(values["wait-minutes"]));
  const facts = await loadMatchAnalysisFacts(raw, offlineDeps(raw));
  if (!facts) throw new Error("Maç bitmemiş görünüyor.");
  await mkdir(values.out, { recursive: true });
  const [homeLogo, awayLogo, brandLogo] = await Promise.all([resolveImage(facts.match.home.logoUrl, 300), resolveImage(facts.match.away.logoUrl, 300), loadBrandLogo()]);
  const images = { homeLogo, awayLogo, brandLogo };
  console.log(`Maç: ${facts.match.home.name} ${facts.match.home.goals}-${facts.match.away.goals} ${facts.match.away.name} (${facts.match.statusShort})`);
  console.log(`Olay: ${facts.events.length} · kırılma anları: ${facts.events.filter((e) => e.breakMoment).map((e) => `${e.minuteLabel} ${e.breakMoment?.label}`).join(", ") || "yok"}`);
  console.log(facts.halves.available ? `Devre verisi: ${halfSourceLabel(facts.halves.stats.source)} (${facts.halves.stats.rows.map((row) => row.key).join(", ")})` : `02 düştü: ${facts.halves.reason}`);
  for (const fact of facts.facts) console.log(`Olgu: ${fact.text}`);
  for (const warning of facts.warnings) console.log(`UYARI: ${warning}`);

  for (const id of formats) {
    const frame = MATCH_DAY_FRAMES[id];
    const base = path.join(values.out, `mac-analizi-%s-${values.slug}-${RATIO_SLUG[id]}`);
    const timeline = await renderTimelineImage({ card: buildTimelineCard(facts, frame, images), frame, resultImage: null, seedKey: facts.match.fixtureId });
    if (!timeline.ok) throw new Error(timeline.error.message);
    await writeFile(`${base.replace("%s", "01")}.png`, timeline.data);
    console.log(`Yazıldı: ${base.replace("%s", "01")}.png`);
    if (!facts.halves.available) {
      await writeFile(`${base.replace("%s", "02")}.txt`, `${facts.halves.reason}\n`, "utf8");
      console.log(`02 düştü — sebep: ${base.replace("%s", "02")}.txt`);
      continue;
    }
    const halves = await renderHalvesImage({ card: buildHalvesCard(facts, facts.halves.stats, images), frame, resultImage: null, seedKey: facts.match.fixtureId });
    if (!halves.ok) throw new Error(halves.error.message);
    await writeFile(`${base.replace("%s", "02")}.png`, halves.data);
    console.log(`Yazıldı: ${base.replace("%s", "02")}.png`);
  }
  console.log(`\nGönderi metni taslağı:\n${buildMatchAnalysisCaption(facts)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
