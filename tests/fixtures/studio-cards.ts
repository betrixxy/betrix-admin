import { nameFor } from "@/lib/names/card-name-forms";
import type { LineupCardInput, LineupSlot } from "@/types/lineup";
import type { StandingRow, StandingsCardInput, StandingsGroup } from "@/types/standings";
import type { SocialFormatId } from "@/types/studio-formats";
import type { WeeklyFixturesCardInput, WeeklyMatch } from "@/types/weekly-fixtures";
import { fixtureCoachName, fixturePlayerNames, type FixtureTeam } from "./card-names";
import { SM_COACH_GLADBACH, SM_COACH_KURGU, SM_COACH_MILANO, SM_SQUAD_GLADBACH, SM_SQUAD_KURGU, SM_SQUAD_MILANO } from "./sportmonks/people";

/**
 * Muhtemel 11, Haftanın Maçları ve Puan Durumu görsel regresyon testinin kart
 * senaryoları — KURGUSAL veri (bkz. CLAUDE.md 5.2). Oyuncu/teknik direktör adları uydurmadır ve kart adı
 * kuralından geçer (API adı + sabit Sportmonks yanıtı → `card-names.ts`);
 * logo ve fotoğraf adresi yok (test çevrimdışı ve deterministik). Her kart dört durumu kapsar:
 * Türkçe karakterli ad, yabancı ad, uzun ad ve iki satıra bölünen metin.
 */

/** [API adı (API-Football kadrosu gibi), forma] — kart adı üretim kuralından (`card-names.ts`), elle yazılmaz. */
type Slot = [apiName: string, number: string];
const slots = (team: FixtureTeam, rows: Slot[]): LineupSlot[] => {
  // `lineup-names.ts` ile aynı: kısa biçim (LINEUP_PLAYERS) + kişinin büyük harf kökeni.
  const names = fixturePlayerNames(team, rows.map(([apiName, number]) => ({ apiId: null, apiName, jersey: Number(number) })));
  return rows.map(([, number], i) => ({ playerId: null, name: nameFor("LINEUP_PLAYERS", names[i]!), number, origin: names[i]!.origin }));
};
const coach = (team: FixtureTeam, apiName: string) => nameFor("LINEUP_COACH", fixtureCoachName(team, apiName));

/** Türk takımı: API ASCII adları Türkçe harfe döner (ı/İ/ğ/ş/ç/ö/ü); "Demir" → DEMİR; Eğilmez yaygın adsız (harf geri yükleme). */
const TR_SLOTS = slots({ sportmonks: SM_SQUAD_KURGU, hint: "tr" }, [
  ["C. Gucluoglu", "1"],
  ["I. Senyurek", "2"],
  ["E. Demir", "4"],
  ["O. Agaoglu", "5"],
  ["K. Isikli", "3"],
  ["S. Kilicarslan", "8"],
  ["B. Gumustekin", "6"],
  ["T. Yigitbasi", "7"],
  ["H. Ciftci", "10"],
  ["U. Inceoglu", "11"],
  ["D. Egilmez", "9"],
]);

/** Yabancı takım: i'li adlar uluslararası kuralla (SILVA, NIKOLIĆ — noktalı İ yok); Ricci kadroda yok. */
const INTL_SLOTS = slots({ sportmonks: SM_SQUAD_MILANO, hint: "intl" }, [
  ["J. Wojcik", "1"],
  ["L. Jorgensen", "2"],
  ["N. Ijeoma", "4"],
  ["R. Silva", "5"],
  ["M. Nikolic", "3"],
  ["F. Muller", "6"],
  ["P. Ibanez", "8"],
  ["T. Kristiansen", "10"],
  ["V. Dimitriou", "7"],
  ["A. Mbeki", "11"],
  ["G. Ricci", "9"],
]);

/** Uzun adlar: kısaltma/kesme kuralı ve dar etiket; tireli soyad, "de la"/"van der". */
const LONG_SLOTS = slots({ sportmonks: SM_SQUAD_GLADBACH, hint: "intl" }, [
  ["K. Papadopoulos-Alexandridis", "99"],
  ["M. Karaosmanoglu", "22"],
  ["J. Wan-Bissaka-Longfellow", "23"],
  ["A. Hernandez de la Fuente", "15"],
  ["W. Schweinsteiger-Hummels", "13"],
  ["B. Abdurrahmanoglu", "18"],
  ["C. Oxlade-Chamberlainson", "17"],
  ["D. Van der Westhuizen", "14"],
  ["E. Kilicdaroglugil", "88"],
  ["F. Diakhaby-Koulibaly", "77"],
  ["G. Aubameyang-Ondoua", "19"],
]);

export const LINEUP_CASES: Record<string, Omit<LineupCardInput, "format">> = {
  "tr-takim": {
    templateStyle: "pitch",
    team: { teamName: "Kurgu Gençlikspor", logoUrl: "", colorHex: "#0B6E3A", heroPhotoId: "", heroAdjust: null, formation: "4-2-3-1", slots: TR_SLOTS, coach: coach({ sportmonks: SM_COACH_KURGU, hint: "tr" }, "Ilhan Sikisik") },
    opponentName: "Örnek İdmanyurdu",
    opponentLogoUrl: "",
    headline: "MUHTEMEL 11",
    matchLabel: "Trendyol Süper Lig · 30.10 · 20:00",
    origins: { team: { name: "tr", people: "tr" }, opponent: { name: "tr", people: "tr" } },
  },
  "yabanci-takim": {
    templateStyle: "pitch",
    team: { teamName: "Sporting Milano", logoUrl: "", colorHex: "#1D3E8A", heroPhotoId: "", heroAdjust: null, formation: "4-3-3", slots: INTL_SLOTS, coach: coach({ sportmonks: SM_COACH_MILANO, hint: "intl" }, "Dimitri Ivanovic") },
    opponentName: "Kurgu Gençlikspor",
    opponentLogoUrl: "",
    headline: "İLK 11",
    matchLabel: "UEFA Şampiyonlar Ligi · 04.11 · 22:00",
    origins: { team: { name: "intl", people: "intl" }, opponent: { name: "tr", people: "tr" } },
  },
  "uzun-adlar": {
    templateStyle: "pitch",
    team: { teamName: "Borussia Mönchengladbach", logoUrl: "", colorHex: "#111111", heroPhotoId: "", heroAdjust: null, formation: "3-4-2-1", slots: LONG_SLOTS, coach: coach({ sportmonks: SM_COACH_GLADBACH, hint: "intl" }, "Konstantin Alexandropoulos-Weissmann") },
    opponentName: "Wolverhampton Wanderers",
    opponentLogoUrl: "",
    headline: "MUHTEMEL 11",
    matchLabel: "UEFA Konferans Ligi · 27.11 · 20:45",
    origins: { team: { name: "intl", people: "intl" }, opponent: { name: "intl", people: "intl" } },
  },
};

function match(id: number, dateKey: string, time: string, home: string, away: string, extra: Partial<WeeklyMatch> = {}): WeeklyMatch {
  return {
    id: `api-football-${id}`,
    kickoffUtc: `${dateKey}T${time.replace(".", ":")}:00+03:00`,
    dateKey,
    time,
    status: "scheduled",
    elapsed: null,
    home: { name: home, logoUrl: "", goals: null },
    away: { name: away, logoUrl: "", goals: null },
    group: null,
    ...extra,
  };
}

const played = (m: WeeklyMatch, home: number, away: number, status: WeeklyMatch["status"] = "finished", elapsed: number | null = null): WeeklyMatch => ({
  ...m,
  status,
  elapsed,
  home: { ...m.home, goals: home },
  away: { ...m.away, goals: away },
});

/** 9 maç, 4 gün: Türkçe karakterli kulüp adları, uzun ad (Gençlerbirliği, Çaykur Rizespor), canlı/bitmiş/ertelenmiş. */
const SUPER_LIG_WEEK: WeeklyMatch[] = [
  match(1, "2026-10-30", "20:00", "Konyaspor", "Galatasaray"),
  played(match(2, "2026-10-31", "13:30", "Erzurumspor", "Çorum FK"), 2, 1),
  played(match(3, "2026-10-31", "16:00", "Kocaelispor", "Çaykur Rizespor"), 1, 1, "live", 67),
  match(4, "2026-10-31", "19:00", "Fenerbahçe", "Göztepe SK"),
  match(5, "2026-11-01", "13:30", "Amed SFK", "Eyüpspor"),
  match(6, "2026-11-01", "16:00", "Başakşehir", "Samsunspor", { status: "postponed" }),
  match(7, "2026-11-01", "16:00", "Trabzonspor", "Gaziantep FK"),
  match(8, "2026-11-01", "19:00", "Kasımpaşa", "Beşiktaş"),
  match(9, "2026-11-02", "20:00", "Gençlerbirliği", "Alanyaspor"),
];

/** Kupa grup aşaması: yabancı adlar (i → I), çok uzun kulüp adı, iki satırlık başlık. */
const CUP_GROUPS: WeeklyMatch[] = [
  match(11, "2026-11-04", "20:45", "Borussia Mönchengladbach", "Wolverhampton Wanderers", { group: "A" }),
  match(12, "2026-11-04", "23:00", "Sporting Milano", "Kurgu Gençlikspor", { group: "A" }),
  played(match(13, "2026-11-05", "20:45", "Inter Lisboa", "Fiorentina Nicolić", { group: "B" }), 3, 2),
  match(14, "2026-11-05", "23:00", "Dinamo Kiev", "Kızılyıldız", { group: "B" }),
];

export const WEEKLY_CASES: Record<string, Omit<WeeklyFixturesCardInput, "format">> = {
  "super-lig-hafta": { leagueId: "super-lig", leagueName: "Trendyol Süper Lig", leagueLogoUrl: "", title: "10. HAFTA", grouping: "date", matches: SUPER_LIG_WEEK },
  "kupa-grup-uzun-baslik": {
    leagueId: "uecl",
    leagueName: "UEFA Konferans Ligi",
    leagueLogoUrl: "",
    title: "GRUP AŞAMASI · 4. MAÇ GÜNÜ · İKİNCİ YARI",
    grouping: "group",
    matches: CUP_GROUPS,
  },
};

/**
 * Formatın taşıdığı kadar maç (stüdyo sığmayan kartı reddeder, admin maç çıkarır): sondan çıkarılır.
 * `fits` = `weeklyPlan(...) !== null` (testte layout modülünden verilir).
 */
export function weeklyForFormat(input: Omit<WeeklyFixturesCardInput, "format">, format: SocialFormatId, fits: (matches: WeeklyMatch[]) => boolean): WeeklyFixturesCardInput {
  let matches = input.matches;
  while (matches.length > 1 && !fits(matches)) matches = matches.slice(0, -1);
  return { ...input, format, matches };
}

const TEAMS_TR = [
  "Galatasaray",
  "Fenerbahçe",
  "Trabzonspor",
  "Beşiktaş",
  "Göztepe SK",
  "Çaykur Rizespor",
  "Başakşehir",
  "Samsunspor",
  "Gençlerbirliği",
  "Kasımpaşa",
  "Eyüpspor",
  "Konyaspor",
  "Amed SFK",
  "Gaziantep FK",
  "Kocaelispor",
  "Alanyaspor",
  "Erzurumspor",
  "Çorum FK",
];

function row(rank: number, teamName: string, total: number): StandingRow {
  const played = 10;
  const win = Math.max(0, Math.round((total - rank) / 2.2));
  const draw = (rank * 3) % 4;
  const lose = Math.max(0, played - win - draw);
  const goalsFor = 8 + win * 2 + draw;
  const goalsAgainst = 6 + lose * 2;
  const zone = rank <= 2 ? "top" : rank <= 4 ? "playoff" : rank > total - 3 ? "relegation" : null;
  return { rank, teamId: 9000 + rank, teamName, logoUrl: "", played, win, draw, lose, goalsFor, goalsAgainst, goalDiff: goalsFor - goalsAgainst, points: win * 3 + draw, zone };
}

const SUPER_LIG_TABLE: StandingsGroup = { key: "Süper Lig", label: "", rows: TEAMS_TR.map((name, index) => row(index + 1, name, TEAMS_TR.length)) };

const UECL_GROUPS: StandingsGroup[] = [
  { key: "Group A", label: "A GRUBU", rows: ["Borussia Mönchengladbach", "Wolverhampton Wanderers", "Sporting Milano", "Kurgu Gençlikspor"].map((name, i) => row(i + 1, name, 4)) },
  { key: "Group B", label: "B GRUBU", rows: ["Inter Lisboa", "Kızılyıldız", "Dinamo Kiev", "Fiorentina Nicolić"].map((name, i) => ({ ...row(i + 1, name, 4), teamId: 9100 + i })) },
];

export const STANDINGS_CASES: Record<string, Omit<StandingsCardInput, "format">> = {
  "super-lig-tablo": { leagueId: "super-lig", leagueName: "Trendyol Süper Lig", leagueLogoUrl: "", season: 2026, title: "PUAN DURUMU", kindLabel: "10. HAFTA SONU", sections: [SUPER_LIG_TABLE] },
  "kupa-gruplar": { leagueId: "uecl", leagueName: "UEFA Konferans Ligi", leagueLogoUrl: "", season: 2026, title: "GRUPLARDA SON DURUM", kindLabel: "GRUP AŞAMASI", sections: UECL_GROUPS },
};

/** Tek tablolu senaryoda formatın taşıdığı kadar satır (stüdyo uzun tabloyu iki karta böler). */
export function standingsForFormat(input: Omit<StandingsCardInput, "format">, format: SocialFormatId, capacity: number): StandingsCardInput {
  if (input.sections.length !== 1) return { ...input, format };
  const [section] = input.sections;
  return { ...input, format, sections: [{ ...section!, rows: section!.rows.slice(0, capacity) }] };
}
