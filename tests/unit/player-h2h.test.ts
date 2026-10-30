import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { buildH2HCard, h2hColors } from "@/lib/dashboard/player-h2h-card";
import { portraitCrop } from "@/lib/dashboard/player-h2h-photo";
import { comparisonPosition, comparisonWarnings, DIFFERENT_LEAGUES_WARNING, scopeLabel } from "@/lib/player-h2h/checks";
import { factLine } from "@/lib/player-h2h/facts";
import { firstNameOf, shortNameOf } from "@/lib/names/person-name";
import { fullNameFromApi, leagueDisplay, seasonLabel } from "@/lib/player-h2h/names";
import { buildHero, buildRows } from "@/lib/player-h2h/rows";
import { defaultMode, formatStat, modeValue, POSITION_PRIORITY } from "@/lib/player-h2h/stats";
import { genitive, numberPossessive } from "@/lib/player-h2h/turkish";
import { upperName } from "@/lib/dashboard/name-case";
import { aggregateSeason } from "@/lib/services/api-football/player-season-mappers";
import type { ApiFootballPlayerSeasonEntry } from "@/lib/services/api-football/player-season-types";
import { nameMatches } from "@/lib/services/sportmonks/player-season-mappers";
import type { PlayerSeasonStats } from "@/types/player-h2h";
import { H2H_LEFT, H2H_RIGHT } from "../fixtures/player-h2h";

const player = (overrides: Partial<PlayerSeasonStats>): PlayerSeasonStats => ({ ...H2H_LEFT, ...overrides });

describe("satırlar — eksik veri asla 0 değil", () => {
  it("bir oyuncuda eksik istatistik iki tarafta da düşer; sıradaki gelir", () => {
    const left = player({ values: { goals: 8, shots: 22, xg: 4 } });
    const right = player({ values: { goals: 6, shots: 15 } });
    const { rows, dropped } = buildRows(left, right, "FWD", "TOTAL");
    assert.deepEqual(rows.map((r) => r.key), ["goals", "shots"]);
    assert.ok(dropped.some((d) => d.key === "xg" && d.reason === "MISSING_RIGHT"));
    assert.ok(dropped.some((d) => d.key === "assists" && d.reason === "MISSING_BOTH"));
    assert.ok(rows.every((r) => r.leftText !== "" && r.rightText !== ""));
  });

  it("gerçek 0 (veri var) yazılır, eksik değer yazılmaz", () => {
    const { rows } = buildRows(player({ values: { assists: 3 } }), player({ values: { assists: 0 } }), "FWD", "TOTAL");
    assert.equal(rows[0]?.rightText, "0");
    assert.equal(rows[0]?.winner, "LEFT");
  });

  it("sınır aşılınca EN DÜŞÜK öncelikli satırlar düşer; kalanlar grup sırasında", () => {
    const { rows, dropped } = buildRows(H2H_LEFT, H2H_RIGHT, "FWD", "TOTAL", 5);
    const kept = POSITION_PRIORITY.FWD.slice(0, 5);
    assert.deepEqual(new Set(rows.map((r) => r.key)), new Set(kept));
    assert.ok(dropped.filter((d) => d.reason === "OVERFLOW").every((d) => POSITION_PRIORITY.FWD.indexOf(d.key) >= 5));
    assert.deepEqual(rows.map((r) => r.group), ["HÜCUM", "HÜCUM", "HÜCUM", "HÜCUM", "YARATICILIK"]);
  });
});

describe("mevki önceliği ve kahramanlar", () => {
  it("forvet: Gol / Asist / xG; orta saha: Asist / Kilit pas / Büyük fırsat; defans: ikili / top kesme / top çalma", () => {
    assert.deepEqual(buildHero(H2H_LEFT, H2H_RIGHT, "FWD", "TOTAL").map((r) => r.key), ["goals", "assists", "xg"]);
    assert.deepEqual(buildHero(H2H_LEFT, H2H_RIGHT, "MID", "TOTAL").map((r) => r.key), ["assists", "keyPasses", "bigChancesCreated"]);
    assert.deepEqual(buildHero(H2H_LEFT, H2H_RIGHT, "DEF", "TOTAL").map((r) => r.key), ["duelsWonPct", "interceptions", "tackles"]);
  });

  it("kahraman istatistiği eksikse listede sıradaki gelir (xG yoksa şut)", () => {
    const left = player({ values: { goals: 8, assists: 3, shots: 22 } });
    const right = player({ values: { goals: 6, assists: 0, shots: 15 } });
    assert.deepEqual(buildHero(left, right, "FWD", "TOTAL").map((r) => r.key), ["goals", "assists", "shots"]);
  });

  it("kaleci ile saha oyuncusu reddedilir; farklı saha mevkileri uyarı", () => {
    const keeper = player({ position: "GK" });
    assert.equal(comparisonPosition(keeper, H2H_RIGHT).ok, false);
    assert.equal(comparisonPosition(keeper, player({ position: "GK" })).ok, true);
    const warnings = comparisonWarnings(H2H_LEFT, player({ position: "MID", league: H2H_LEFT.league }));
    assert.ok(warnings.some((w) => w.startsWith("Farklı mevkiler (Forvet – Orta saha)")), warnings.join());
  });
});

describe("adalet: toplam / 90 dakika", () => {
  it("90 dk dönüşümü: sayılar ve xG çevrilir, yüzde ve puan aynen", () => {
    assert.equal(modeValue("goals", 8, 648, "PER90"), (8 * 90) / 648);
    assert.equal(modeValue("xg", 4.5, 450, "PER90"), 0.9);
    assert.equal(modeValue("passAccuracy", 78, 648, "PER90"), 78);
    assert.equal(modeValue("rating", 7.1, 459, "PER90"), 7.1);
  });

  it("dakika farkı %25'i aşarsa varsayılan 90 dk; aşmazsa toplam", () => {
    assert.equal(defaultMode(648, 459), "PER90");
    assert.equal(defaultMode(742, 655), "TOTAL");
  });

  it("270 dakikanın altı küçük örneklem uyarısı; farklı lig uyarısı", () => {
    const warnings = comparisonWarnings(player({ minutes: 210 }), H2H_RIGHT);
    assert.ok(warnings.some((w) => w.startsWith("Küçük örneklem: Aktürkoğlu 210 dk")));
    assert.ok(warnings.includes(DIFFERENT_LEAGUES_WARNING));
  });
});

describe("Türkçe yazım", () => {
  it("ondalık virgül, yüzde işareti önde, puan iki hane", () => {
    assert.equal(formatStat("goals", 1.111, "PER90"), "1,11");
    assert.equal(formatStat("goals", 8, "TOTAL"), "8");
    assert.equal(formatStat("xg", 3.9246, "TOTAL"), "3,92");
    assert.equal(formatStat("passAccuracy", 77.6, "TOTAL"), "%78");
    assert.equal(formatStat("rating", 7.1, "TOTAL"), "7,10");
  });

  it("büyük harf: yabancı ad uluslararası (VLAHOVIĆ), Türk adı Türkçe (AKTÜRKOĞLU)", () => {
    assert.equal(upperName("Vlahović", "intl"), "VLAHOVIĆ");
    assert.equal(upperName("Dušan", "intl"), "DUŠAN");
    assert.equal(upperName("Aktürkoğlu", "tr"), "AKTÜRKOĞLU");
    assert.equal(upperName("Borussia Mönchengladbach", "intl"), "BORUSSIA MÖNCHENGLADBACH");
  });

  it("ilgi eki ünlü uyumuyla; sayı iyelik eki", () => {
    assert.equal(genitive("Vlahović"), "Vlahović'in");
    assert.equal(genitive("Salah"), "Salah'ın");
    assert.equal(genitive("Icardi"), "Icardi'nin");
    assert.equal(genitive("Pléa"), "Pléa'nın");
    assert.equal(genitive("Džeko"), "Džeko'nun");
    assert.deepEqual([1, 2, 3, 6, 9, 10, 40, 100].map(numberPossessive), ["1'i", "2'si", "3'ü", "6'sı", "9'u", "10'u", "40'ı", "100'ü"]);
  });

  it("adlar: eşleme adı API ilk adıyla açılır (kartta değil), soyad ekleriyle", () => {
    assert.equal(fullNameFromApi("D. Vlahović", "Dušan"), "Dušan Vlahović");
    assert.equal(fullNameFromApi("Mohamed Salah", "Mohamed"), "Mohamed Salah");
    assert.equal(shortNameOf("Virgil van Dijk"), "van Dijk");
    assert.equal(firstNameOf("Mohamed Salah"), "Mohamed");
    assert.equal(seasonLabel(2026), "2026/27");
    assert.deepEqual(leagueDisplay(203, "Süper Lig"), { id: 203, name: "Süper Lig", label: "SÜPER LİG" });
    assert.equal(leagueDisplay(135, "Serie A").label, "SERIE A");
  });

  it("kapsam etiketi: lig, tüm turnuvalar, farklı ligler", () => {
    assert.equal(scopeLabel(H2H_LEFT, player({})), "2026/27 · SÜPER LİG");
    assert.equal(scopeLabel(H2H_LEFT, H2H_RIGHT), "2026/27 · SÜPER LİG / BUNDESLIGA");
    assert.equal(scopeLabel(player({ scope: "ALL" }), player({ scope: "ALL" })), "2026/27 · TÜM TURNUVALAR");
  });
});

describe("olgu kuralları (yorum yok)", () => {
  it("daha az şutla daha çok gol (toplam ve 90 dk ifadesi)", () => {
    const a = player({ shortName: "Salah", minutes: 600, values: { goals: 8, shots: 20 } });
    const b = player({ shortName: "Vlahović", minutes: 600, values: { goals: 6, shots: 25 } });
    assert.equal(factLine(a, b, "FWD", "TOTAL"), "Salah daha az şutla daha çok gol attı");
    assert.equal(factLine(b, a, "FWD", "PER90"), "Salah 90 dakikada daha az şutla daha çok gol buluyor");
  });

  it("xG golünden en az 1 yüksekse; kural tutmazsa satır yok", () => {
    const a = player({ shortName: "Vlahović", values: { goals: 4, xg: 5.2, shots: 20 } });
    const b = player({ shortName: "Salah", values: { goals: 4, xg: 4.1, shots: 20 } });
    assert.equal(factLine(a, b, "FWD", "TOTAL"), "Vlahović'in xG'si golünden yüksek");
    assert.equal(factLine(player({ values: { goals: 4 } }), player({ values: { goals: 4 } }), "FWD", "TOTAL"), "");
  });
});

describe("veri: katı toplama ve kaynak tutarlılığı", () => {
  const entry = (overrides: Partial<ApiFootballPlayerSeasonEntry>): ApiFootballPlayerSeasonEntry => ({
    team: { id: 549, name: "Beşiktaş" },
    league: { id: 203, name: "Süper Lig", season: 2026 },
    games: { appearences: 6, minutes: 459, position: "Attacker", rating: "7.1" },
    shots: { total: 15, on: 11 },
    goals: { total: 6, assists: 0 },
    passes: { total: 69, key: 4, accuracy: 73 },
    tackles: { total: null, interceptions: null },
    duels: { total: 47, won: 10 },
    dribbles: { attempts: 12, success: 3 },
    penalty: { scored: 2 },
    ...overrides,
  });

  it("null alan bilinmiyor: toplanmaz, satır düşer (Vlahović top çalma/kesme)", () => {
    const aggregate = aggregateSeason([entry({})], () => true);
    assert.equal(aggregate.values.tackles, undefined);
    assert.equal(aggregate.values.interceptions, undefined);
    assert.equal(aggregate.values.goals, 6);
    assert.equal(aggregate.penaltyGoals, 2);
  });

  it("tüm turnuvalar: bir turnuvada eksikse toplam yok; yüzdeler ağırlıklı; dakikasız kayıt yok sayılır", () => {
    const cup = entry({ league: { id: 3, name: "UEFA Europa League", season: 2026 }, games: { appearences: 4, minutes: 105, rating: "6.71" }, goals: { total: 0, assists: 0 }, passes: { total: 26, key: 2, accuracy: 76 }, tackles: { total: 0, interceptions: 0 }, duels: { total: 11, won: 7 } });
    const bench = entry({ league: { id: 206, name: "Kupa", season: 2026 }, games: { appearences: 0, minutes: 0 }, goals: { total: null } });
    const aggregate = aggregateSeason([entry({}), cup, bench], () => true);
    assert.equal(aggregate.minutes, 564);
    assert.equal(aggregate.values.tackles, undefined, "ligde null → toplam bilinmiyor");
    assert.equal(aggregate.values.goals, 6);
    assert.equal(Math.round((aggregate.values.passAccuracy ?? 0) * 100) / 100, Math.round(((73 * 69 + 76 * 26) / 95) * 100) / 100);
    assert.equal(Math.round(aggregate.values.duelsWonPct ?? 0), Math.round((17 / 58) * 100));
  });


  it("Sportmonks aday adı: soyad + ilk ad baş harfi", () => {
    assert.equal(nameMatches("Dušan Vlahović", "Dušan Vlahović", "Vlahović"), true);
    assert.equal(nameMatches("Nedeljko Vlahovic", "Dušan Vlahović", "Vlahović"), false);
  });
});

describe("renk kuralı", () => {
  it("ana renk okunmuyorsa ikincil (Trabzonspor bordo → mavi); aynı takım → sağ nötr", () => {
    const [ts, bjk] = h2hColors(998, 549);
    assert.equal(ts.toUpperCase(), "#5AB4E5");
    assert.equal(bjk.toUpperCase(), "#FFFFFF");
    const [left, right] = h2hColors(998, 998);
    assert.equal(left.toUpperCase(), "#5AB4E5");
    assert.ok(["#E8E8EA", "#9AA3B5"].includes(right.toUpperCase()));
  });
});

describe("2026-10-27 tasarım düzeltmeleri", () => {
  it("gerçek 0 her modda '0' (90 dk'da '0,00' değil); yüzde '%0'", () => {
    assert.equal(formatStat("assists", 0, "PER90"), "0");
    assert.equal(formatStat("xg", 0, "TOTAL"), "0");
    assert.equal(formatStat("passAccuracy", 0, "TOTAL"), "%0");
    const { rows } = buildRows(player({ values: { assists: 3 } }), player({ values: { assists: 0 } }), "FWD", "PER90");
    assert.equal(rows[0]?.rightText, "0");
  });

  it("ortalama puan tabloda yok (boşalan yere sıradaki satır); 2. sayfa künyesinde", () => {
    for (const position of ["FWD", "MID", "DEF", "GK"] as const) assert.ok(!POSITION_PRIORITY[position].includes("rating"), position);
    const { rows } = buildRows(H2H_LEFT, H2H_RIGHT, "FWD", "TOTAL");
    assert.ok(!rows.some((r) => r.key === "rating"));
    const built = buildH2HCard({ left: H2H_LEFT, right: H2H_RIGHT, mode: "TOTAL", match: null, images: { leftLogo: null, rightLogo: null, leftFace: null, rightFace: null, brandLogo: "" }, frame: MATCH_DAY_FRAMES.IG_PORTRAIT });
    assert.ok(built.ok);
    assert.equal(built.data.card.left.sampleLine, "9 MAÇ · 742 DK · PUAN 7,52");
  });

  it("kahraman altında gerçek toplam yalnızca 90 dk modunda, sayı/xG satırında", () => {
    const per90 = buildHero(H2H_LEFT, H2H_RIGHT, "FWD", "PER90");
    assert.deepEqual(per90[0]?.totals, { left: "7", right: "6" });
    assert.deepEqual(per90.find((r) => r.key === "xg")?.totals, { left: "5,62", right: "7,30" });
    assert.equal(buildHero(H2H_LEFT, H2H_RIGHT, "FWD", "TOTAL")[0]?.totals, null);
    assert.equal(buildHero(H2H_LEFT, H2H_RIGHT, "DEF", "PER90")[0]?.totals, null, "yüzde satırında toplam yok");
  });

  it("vesikalık kırpma: yüz yatayda ortada, göz hizası üst üçte birde, baş + omuz (yüz × 2,6)", () => {
    const face = { x: 900, y: 400, width: 200, height: 260, score: 0.9 };
    const crop = portraitCrop(face, { width: 2000, height: 2600 });
    assert.equal(crop.side, Math.round(260 * 2.6));
    assert.equal(crop.left + crop.side / 2, 1000);
    assert.ok(Math.abs(crop.top + crop.side / 3 - (400 + 260 * 0.4)) <= 1);
    const edge = portraitCrop({ ...face, x: 10, y: 5 }, { width: 2000, height: 2600 });
    assert.equal(edge.left, 0, "görüntü sınırına kıstırılır");
    assert.equal(edge.top, 0);
  });
});
