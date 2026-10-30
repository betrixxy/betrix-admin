import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { captionFormatGate, hasLinkOrDomain, siteMentionFree, unfilledPlaceholders } from "@/lib/dashboard/caption-format";
import { buildDraftCaption } from "@/lib/dashboard/draft-caption";
import { draftQueueLabel } from "@/lib/dashboard/draft-queue-label";
import { buildMatchStatsCaption } from "@/lib/dashboard/match-stats-caption";
import { buildSpotlightCaption, buildTopPlayersCaption } from "@/lib/dashboard/player-stats-caption";
import { assemblePlayerStatsFacts } from "@/lib/player-stats/assemble";
import { topPlayers } from "@/lib/player-stats/picks";
import { contentLanguageGate } from "@/lib/prediction/content-language";
import { toMatchStatsFacts } from "@/lib/services/api-football/post-match-stats-mappers";
import type { MatchStats, TeamRecentForm } from "@/types/sports";
import { RAW_GENCLERBIRLIGI_GALATASARAY } from "../fixtures/api-football/match-result";
import { RAW_MILAN_BOLOGNA, SM_MILAN_BOLOGNA_IDS, SM_MILAN_BOLOGNA_LINEUP } from "../fixtures/api-football/player-match-stats";

/**
 * Gönderi metni ortak biçim kapısı (kurucu kararı 2026-10-30): doldurulmamış `{…}` alanı üretimi durdurur,
 * en fazla 5 hashtag her yerde, X'e giden metinde link YOK (çıplak alan adı dahil). Kapı bahis dili kapısının
 * içinde — bütün motorlar, onay ve yayın devralır. Bekçi: her şablon metni kurucusu bir testte kapıdan geçer.
 */

describe("biçim kapısı — kurallar", () => {
  it("doldurulmamış şablon alanı durdurur ({xG}, {N}); düz parantez ve emoji serbest", () => {
    assert.deepEqual(unfilledPlaceholders("📊 Beklenen gol ({xG}): 1,20 – 0,40 {xG}"), ["{xG}"]);
    assert.match(captionFormatGate("Modelimiz {N} senaryo hesapladı.") ?? "", /doldurulmamış şablon alanı: \{N\}/u);
    assert.equal(captionFormatGate("Beklenen gol (xG): 1,20 – 0,40 ⚽"), null);
  });

  it("en fazla 5 hashtag — her platformda", () => {
    const five = "Metin #A1 #B2 #C3 #D4 #E5";
    for (const platform of ["IG_POST", "IG_REELS_STORY", "X", null] as const) {
      assert.equal(captionFormatGate(five, platform), null, String(platform));
      assert.match(captionFormatGate(`${five} #F6`, platform) ?? "", /en fazla 5 hashtag olabilir \(6 var\)/u);
    }
  });

  it("X'te link yok: http, www, kısa link ve ÇIPLAK alan adı; Instagram seçilmiş metinde engel değil", () => {
    for (const text of ["Detay: https://www.betrix.pro/r/abc", "www.checkmatch.net", "Tamamı checkmatch.net'te", "betrix.pro/r/x", "CHECKMATCH.NET"]) {
      assert.ok(hasLinkOrDomain(text), text);
      assert.match(captionFormatGate(text, "X") ?? "", /X metninde link/u, text);
      assert.match(captionFormatGate(text) ?? "", /metin X'e de gider/u, text);
      assert.equal(captionFormatGate(text, "IG_POST"), null, text);
    }
    for (const text of ["Skor 2.1 değil 2-1", "Detaylı analiz CheckMatch'te.", "Son 5 maçta 2,4 gol", "#CheckMatch"]) assert.equal(hasLinkOrDomain(text), false, text);
    assert.equal(siteMentionFree("— tamamı checkmatch.net'te."), "— tamamı CheckMatch'te.");
  });

  it("bahis dili kapısının içinde: üretim (platformsuz), onay ve yayın (platformlu) aynı kuralı devralır", () => {
    assert.match(contentLanguageGate({ card: { title: "MAÇ" }, caption: "Beklenen gol ({xG})" }) ?? "", /\{xG\}/u);
    assert.match(contentLanguageGate({ caption: "Analiz checkmatch.net'te" }) ?? "", /X'e de gider/u);
    assert.equal(contentLanguageGate({ caption: "Analiz checkmatch.net'te", platform: "IG_POST" }), null);
    assert.match(contentLanguageGate({ caption: "Kuponunu hazırla {N}" }) ?? "", /kupon/u, "önce bahis dili");
    // Kart metni biçim kapısına girmez: 02 satır etiketi "{xG}" kart çiziminin işaretidir.
    assert.equal(contentLanguageGate({ card: { label: "Beklenen gol ({xG})" } }), null);
  });
});

const team = (name: string): TeamRecentForm => ({
  teamId: name, teamName: name, logoUrl: "", last5: ["W", "D", "L", "W", "W"], matchesSampled: 5, goalsForAvg: 1.8, goalsAgainstAvg: 0.8, xgForAvg: 1.62, xgAgainstAvg: 0.9, xgMatchesSampled: 5,
});
const DRAFT_STATS: MatchStats = {
  fixture: {
    id: "1", providerIds: { apiFootball: 1 }, kickoffUtc: "2026-10-31T17:00:00Z", status: "SCHEDULED", derbyIntensity: "NONE",
    homeTeam: { id: "645", name: "Galatasaray", shortName: "Galatasaray", primaryColorHex: "#A90432", logoUrl: "" },
    awayTeam: { id: "611", name: "Fenerbahce", shortName: "Fenerbahçe", primaryColorHex: "#163962", logoUrl: "" },
    competition: { id: "203", name: "Süper Lig", shortName: "Süper Lig" },
  },
  home: team("Galatasaray"),
  away: team("Fenerbahçe"),
  headToHead: { matches: [{ kickoffUtc: "2026-04-01T17:00:00Z", homeTeamName: "Galatasaray", awayTeamName: "Fenerbahce", homeGoals: 2, awayGoals: 1 }], homeWins: 1, draws: 0, awayWins: 0 },
  source: "api-football",
  fetchedAtUtc: "2026-10-30T12:00:00Z",
};

describe("bekçi — şablon metinleri kapıdan geçer", () => {
  it("02 İstatistikler: xG satırı düz etiketle (\"{xG}\" sızıntısı regresyonu)", () => {
    const facts = toMatchStatsFacts(RAW_GENCLERBIRLIGI_GALATASARAY, null);
    assert.ok(facts);
    const caption = buildMatchStatsCaption(facts);
    assert.equal(captionFormatGate(caption), null, caption);
    assert.ok(!caption.includes("{"), caption);
  });

  it("genel stüdyo taslağı: alan adı yok, ≤5 hashtag", () => {
    const caption = buildDraftCaption(DRAFT_STATS);
    assert.equal(captionFormatGate(caption), null, caption);
    assert.match(caption, /CheckMatch'te\./u);
  });

  it("Oyuncu İstatistikleri A ve B", () => {
    const facts = assemblePlayerStatsFacts(RAW_MILAN_BOLOGNA, new Date("2026-10-30T12:00:00Z"), { players: SM_MILAN_BOLOGNA_LINEUP, ids: SM_MILAN_BOLOGNA_IDS });
    assert.ok(facts);
    const [best] = topPlayers(facts.lines, 3);
    assert.ok(best);
    for (const caption of [buildSpotlightCaption(facts, best), buildTopPlayersCaption(facts, topPlayers(facts.lines, 5))]) assert.equal(captionFormatGate(caption), null, caption);
  });

  it("her şablon metni kurucusu bir birim testte biçim kapısından geçer (yeni kurucu eklenip bağlanmazsa kırılır)", () => {
    const root = process.cwd();
    const walk = (dir: string): string[] =>
      readdirSync(path.join(root, dir)).flatMap((entry) => {
        const rel = path.join(dir, entry).replaceAll("\\", "/");
        return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
      });
    const builders = walk("src/lib").filter((file) => /caption\.ts$/u.test(file) && !/(publish-caption|generate-caption)\.ts$/u.test(file));
    const tests = walk("tests/unit").map((file) => readFileSync(path.join(root, file), "utf8")).filter((text) => /captionFormatGate\(|contentLanguageGate\(\{ caption/u.test(text));
    const unguarded = builders.filter((file) => {
      const specifier = `@/${file.replace(/^src\//u, "").replace(/\.ts$/u, "")}`;
      return !tests.some((text) => text.includes(`"${specifier}"`));
    });
    assert.ok(builders.length >= 9, builders.join(", "));
    assert.deepEqual(unguarded, []);
  });
});

describe("onay kuyruğu — okunur satır", () => {
  const labels = { "1035078": "Galatasaray – Fenerbahçe · 31.10" };

  it("Kura: ham anahtar yerine turnuva · tur · sezon; Türk temsilcileri tek satır", () => {
    const state = { competition: { id: 2, name: "UEFA Şampiyonlar Ligi" }, season: 2026, roundLabel: "Lig Aşaması" };
    const row = { contentType: "DRAWS_AND_PAIRINGS", fixtureId: "draw:2:2026:LEAGUE", renderOptions: { kind: "DRAW", states: [state] } };
    assert.deepEqual(draftQueueLabel(row, labels), { type: "Kura Sonucu", title: "UEFA Şampiyonlar Ligi · Lig Aşaması · 2026/27" });
    const turkish = { ...row, renderOptions: { states: [state, { ...state, competition: { id: 3, name: "UEFA Avrupa Ligi" } }] } };
    assert.equal(draftQueueLabel(turkish, labels).title, "Avrupa kupaları · 2026/27");
  });

  it("maç etiketi, kayıt başlığı (serbest H2H), lig adı; hiçbir zaman ham anahtar", () => {
    assert.deepEqual(draftQueueLabel({ contentType: "MATCH_RESULT", fixtureId: "1035078", renderOptions: {} }, labels), { type: "Maç Sonucu", title: "Galatasaray – Fenerbahçe · 31.10" });
    const h2h = draftQueueLabel({ contentType: "PLAYER_H2H", fixtureId: "manual:player-h2h", renderOptions: { title: "Kerem Aktürkoğlu – Alassane Pléa", subtitle: "Sezon" } }, labels);
    assert.equal(h2h.title, "Kerem Aktürkoğlu – Alassane Pléa · Sezon");
    assert.equal(draftQueueLabel({ contentType: "STANDINGS", fixtureId: "manual:standings", renderOptions: { leagueName: "Trendyol Süper Lig" } }, labels).title, "Trendyol Süper Lig");
    assert.equal(draftQueueLabel({ contentType: null, fixtureId: "manual:match-day", renderOptions: null }, labels).title, "Maçtan bağımsız");
    assert.equal(draftQueueLabel({ contentType: null, fixtureId: "x", renderOptions: null }, labels).type, "AI İçerik Stüdyosu");
  });
});
