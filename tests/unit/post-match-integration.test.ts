import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { preferredPickerDefault, winnerPhotoPreference } from "@/lib/archive/picker-default";
import { extraPageCounts, playerSlideIndex, setPageNumbers, setPages, withPlayerSlide } from "@/lib/dashboard/set-pages";
import { assembleMatchAnalysisFacts } from "@/lib/match-analysis/assemble";
import { withEventNames } from "@/lib/match-analysis/names";
import { analysisStudioSummary } from "@/lib/match-analysis/studio-summary";
import type { TeamPeople } from "@/lib/names/person-name";
import { namedResultFacts } from "@/lib/names/result-people";
import { matchScorecardFromRecords, scorecardBlocker, studioRecordRows } from "@/lib/prediction/scorecard-studio";
import { squadPeople } from "@/lib/services/sportmonks/people-mappers";
import type { ArchivePickerData, PickerPhoto } from "@/types/archive";
import type { MatchResultFacts } from "@/types/match-result";
import { KONYA_GS, KONYA_GS_RECORDS } from "../fixtures/prediction-scorecard";
import { RAW_KONYASPOR_GALATASARAY } from "../fixtures/api-football/match-analysis-real";

/**
 * Bitiş çizgisi C (2026-10-30): Maç Sonucu seti "…de ekle" sayfa sırası, sonradan eklenen oyuncu sayfasının ayrılan
 * yeri, kazanan takım fotoğraf varsayılanı, stüdyo özetlerinin kart adı kuralı, karnenin veritabanıyla tutarlılığı.
 */

describe("set sayfaları — sabit sıra", () => {
  it("numaralar: 01, 02, (ayrılan) 03, analiz 04-05, karne 06; devre verisi yoksa analiz tek sayfa", () => {
    assert.deepEqual(setPageNumbers({ MATCH_RESULT: 1, MATCH_STATS: 1, PLAYER_STATS: 1, MATCH_ANALYSIS: 2, PREDICTION_SCORECARD: 1 }), { MATCH_RESULT: [1], MATCH_STATS: [2], PLAYER_STATS: [3], MATCH_ANALYSIS: [4, 5], PREDICTION_SCORECARD: [6] });
    assert.deepEqual(setPageNumbers({ MATCH_RESULT: 1, MATCH_ANALYSIS: 1, PREDICTION_SCORECARD: 1 }), { MATCH_RESULT: [1], MATCH_ANALYSIS: [2], PREDICTION_SCORECARD: [3] });
    assert.deepEqual(extraPageCounts({ analysis: null, scorecard: true }), { MATCH_ANALYSIS: 0, PREDICTION_SCORECARD: 1 });
  });

  it("bekleyen oyuncu sayfası ayrılan yerine girer (analiz sayfalarından önce); ayrılmadıysa sona", () => {
    const base = { url: "/01", label: "01 · Maç Sonucu" };
    const reserved = {
      kind: "MATCH_RESULT",
      carousel: [{ ...base, page: "MATCH_RESULT" }, { url: "/02", label: "02 · İstatistikler", page: "MATCH_STATS" }, { url: "/04", label: "04 · Zaman çizelgesi", page: "MATCH_ANALYSIS" }, { url: "/06", label: "06 · Tahmin karnesi", page: "PREDICTION_SCORECARD" }],
      pages: ["MATCH_RESULT", "MATCH_STATS", "MATCH_ANALYSIS", "PREDICTION_SCORECARD"],
      pendingPlayerPage: { template: "SPOTLIGHT", count: null, playerId: 7 },
    };
    assert.equal(playerSlideIndex(reserved), 2);
    const next = withPlayerSlide(reserved, base, { url: "/03", label: "03 · Maçın oyuncusu" }, false);
    assert.deepEqual((next.carousel as { url: string }[]).map((slide) => slide.url), ["/01", "/02", "/03", "/04", "/06"]);
    assert.deepEqual(next.pages, ["MATCH_RESULT", "MATCH_STATS", "PLAYER_STATS", "MATCH_ANALYSIS", "PREDICTION_SCORECARD"]);
    assert.deepEqual(setPages("MATCH_RESULT", next), ["MATCH_RESULT", "MATCH_STATS", "PLAYER_STATS", "MATCH_ANALYSIS", "PREDICTION_SCORECARD"]);
    const notReserved = { ...reserved, pendingPlayerPage: undefined };
    delete notReserved.pendingPlayerPage;
    assert.equal(playerSlideIndex(notReserved), 4, "yer ayrılmadı: numaralar bozulmasın diye sona");
  });
});

describe("Maç Sonucu fotoğraf varsayılanı — kazanan takım (beraberlikte ev sahibi)", () => {
  const photo = (id: string, kitTeamId: number, bucket: PickerPhoto["bucket"] = "CURRENT_KIT"): PickerPhoto => ({ id, url: `/p/${id}`, caption: "", kind: "CELEBRATION", kitTeamName: String(kitTeamId), kitTeamId, bucket, width: 2000, height: 2500 });
  const data: ArchivePickerData = {
    warnings: [],
    teams: [
      { teamId: 607, name: "Konyaspor", groups: [{ group: "GK", label: "Kaleciler", subjects: [{ key: "person:k1", label: "Bahadır Güngördü", personApiId: 100, isPlayer: true }] }], photos: { "person:k1": [photo("k1", 607)] } },
      {
        teamId: 645,
        name: "Galatasaray",
        groups: [
          { group: "TEAM", label: "Takım", subjects: [{ key: "team:645", label: "Takım fotoğrafı", personApiId: null, isPlayer: false }] },
          { group: "GK", label: "Kaleciler", subjects: [{ key: "person:g1", label: "Uğurcan Çakır", personApiId: 200, isPlayer: true }] },
          { group: "FW", label: "Forvet", subjects: [{ key: "person:g9", label: "Victor Osimhen", personApiId: 2780, isPlayer: true }, { key: "person:g7", label: "Yunus Akgün", personApiId: 454, isPlayer: true }] },
        ],
        photos: { "team:645": [photo("t", 645)], "person:g1": [photo("g1", 645)], "person:g9": [photo("old", 999, "OLD_KIT"), photo("g9", 645)], "person:g7": [photo("g7", 645, "THIS_MATCH")] },
      },
    ],
  };
  const facts = { outcome: "AWAY" as const, home: { id: 607 }, away: { id: 645 } };

  it("Konyaspor 0-4 Galatasaray: MVP Osimhen (kazananda) → onun KAZANAN formalı fotoğrafı (eski forma atlanır)", () => {
    const preferred = winnerPhotoPreference({ ...facts, mvp: { playerId: 2780, side: "AWAY" } });
    assert.deepEqual(preferred, { teamId: 645, playerId: 2780 });
    assert.deepEqual(preferredPickerDefault(data, preferred), { subjectKey: "person:g9", photoId: "g9" });
  });

  it("MVP kaybedendeyse/yoksa: kazananın bu maç fotoğraflı oyuncusu, sonra takım fotoğrafı; beraberlikte ev sahibi", () => {
    const preferred = winnerPhotoPreference({ ...facts, mvp: { playerId: 100, side: "HOME" } });
    assert.deepEqual(preferred, { teamId: 645, playerId: null });
    assert.deepEqual(preferredPickerDefault(data, preferred), { subjectKey: "person:g7", photoId: "g7" });
    const noMatchPhotos: ArchivePickerData = { ...data, teams: data.teams.map((team) => ({ ...team, photos: Object.fromEntries(Object.entries(team.photos).map(([key, list]) => [key, list.filter((entry) => entry.bucket !== "THIS_MATCH")])) })) };
    assert.deepEqual(preferredPickerDefault(noMatchPhotos, preferred), { subjectKey: "team:645", photoId: "t" });
    assert.deepEqual(winnerPhotoPreference({ outcome: "DRAW", home: { id: 607 }, away: { id: 645 }, mvp: { playerId: 2780, side: "AWAY" } }), { teamId: 607, playerId: null });
    assert.deepEqual(preferredPickerDefault(data, { teamId: 607, playerId: null }), { subjectKey: "person:k1", photoId: "k1" });
  });
});

describe("stüdyo özetleri kart adı kuralından", () => {
  const squad = (rows: [number, string, string, string, string][]) => ({ data: rows.map(([jersey, display, first, last, country]) => ({ jersey_number: jersey, player: { display_name: display, common_name: null, firstname: first, lastname: last, nationality: { name: country } } })) });
  const people = (data: unknown): TeamPeople => ({ people: squadPeople(data) ?? [], overrides: new Map(), teamHint: null });
  const team = (id: number, name: string, scorer: { playerId: number; name: string; minutes: string[] }) => ({ id, name, logoUrl: "", goals: 1, scorers: [scorer], colorHex: "" });

  it("Maç Sonucu: golcü ve MVP adları 'Y. Akgun' / 'R. Leao' değil, Türkçe/Portekizce harfli kart adı", () => {
    const facts: MatchResultFacts = {
      fixtureId: 1,
      kickoffUtc: "2026-10-30T17:00:00Z",
      statusShort: "FT",
      competition: { kind: "UCL", name: "UEFA Şampiyonlar Ligi", leagueId: 2, logoUrl: "" },
      roundLabel: "Lig Aşaması · 3. Maç",
      home: team(645, "Galatasaray", { playerId: 454, name: "Y. Akgun", minutes: ["28'"] }),
      away: team(489, "Milan", { playerId: 22, name: "R. Leao", minutes: ["55' (P)"] }),
      outcome: "DRAW",
      penaltyScore: null,
      mvp: { playerId: 454, name: "Y. Akgun", side: "HOME", rating: 8.1, goals: 1 },
      players: [{ playerId: 454, name: "Y. Akgun", side: "HOME", rating: 8.1, goals: 1 }, { playerId: 22, name: "R. Leao", side: "AWAY", rating: 7.4, goals: 1 }],
    };
    const named = namedResultFacts(facts, people(squad([[11, "Yunus Akgün", "Yunus", "Akgün", "Turkey"]])), people(squad([[10, "Rafael Leão", "Rafael Alexandre", "da Conceição Leão", "Portugal"]]))).facts;
    const texts = [named.home.scorers[0]?.name, named.away.scorers[0]?.name, named.mvp?.name, ...named.players.map((player) => player.name)].join(" | ");
    assert.match(texts, /Akgün/u);
    assert.match(texts, /Leão/u);
    assert.doesNotMatch(texts, /Akgun|Leao/u);
    assert.deepEqual(named.home.scorers[0]?.minutes, ["28'"], "dakika ve işaret aynen");
  });

  it("Maç Analizi stüdyo özeti: kırılma anı oyuncusu kart adından, en fazla 2 an", () => {
    const assembled = assembleMatchAnalysisFacts(RAW_KONYASPOR_GALATASARAY, { available: false, reason: "test" });
    assert.ok(assembled);
    const named = withEventNames(assembled, { home: people(squad([])), away: people(squad([[45, "Victor Osimhen", "Victor James", "Osimhen", "Nigeria"]])) });
    const summary = analysisStudioSummary(named);
    assert.equal(summary.moments.length, 1);
    assert.match(summary.moments[0] ?? "", /^12' · KAZANDIRAN GOL · V\. Osimhen \(Galatasaray\) · 0-1$/u);
    assert.match(summary.halves, /^Düşer: test$/u);
  });
});

describe("Tahmin Karnesi stüdyosu — kayıt listesi ve veritabanı tutarlılığı", () => {
  const loaded = (statuses: ("HIT" | "MISS" | null)[]) => KONYA_GS_RECORDS.map((record, index) => ({ record, latest: statuses[index] ? { status: statuses[index] } : null, duplicate: false }));

  it("kayıt yok / sonuç hesaplanmadı → sebep; hepsi yazılı → açık", () => {
    assert.equal(scorecardBlocker([]), "Bu maç için onaylanmış tahmin yok — kart üretilmez.");
    assert.match(scorecardBlocker(loaded([null, null])) ?? "", /Sonuçları hesapla/u);
    assert.equal(scorecardBlocker(loaded(["HIT", "MISS"])), null);
    assert.equal(scorecardBlocker([{ latest: null, duplicate: true }, { latest: { status: "HIT" }, duplicate: false }]), null, "tekrar onayın sonucu aranmaz");
  });

  it("liste: soru, model cevabı, tekrar onay işareti, kayıtlı sonuç", () => {
    const rows = studioRecordRows([...loaded(["HIT", null]), { record: { ...KONYA_GS_RECORDS[0]!, id: "rep" }, latest: null, duplicate: true }], { home: "Konyaspor", away: "Galatasaray" });
    assert.deepEqual(rows.map((row) => [row.question, row.answer, row.counted, row.status]), [
      ["Maçı kim kazanır?", "Model: Galatasaray · %52", true, "Tuttu"],
      ["İlk yarı kimin?", "Model: Galatasaray · %41", true, "Hesaplanmadı"],
      ["Maçı kim kazanır?", "Model: Galatasaray · %52", false, "Hesaplanmadı"],
    ]);
  });

  it("A kartı yalnızca kayıtlı sonuçlar güncel skorla aynıysa (karne veritabanıyla çelişemez)", () => {
    const toLoaded = (statuses: ("HIT" | "MISS" | null)[]) => KONYA_GS_RECORDS.map((record, index) => ({ record, latest: statuses[index] ? { revision: 1, status: statuses[index], fixtureStatus: "FT", homeGoals: 1, awayGoals: 2, htHomeGoals: 1, htAwayGoals: 1, evaluatorVersion: "karne-v1" } : null, duplicate: false }));
    assert.ok(matchScorecardFromRecords(KONYA_GS, toLoaded(["HIT", "MISS"])).ok);
    const missing = matchScorecardFromRecords(KONYA_GS, toLoaded(["HIT", null]));
    assert.ok(!missing.ok && missing.error.code === "NOT_SETTLED_IN_DB");
    const stale = matchScorecardFromRecords(KONYA_GS, toLoaded(["MISS", "MISS"]));
    assert.ok(!stale.ok && /güncel skordan farklı/u.test(stale.error.message));
  });
});
