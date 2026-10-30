import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFixtureProduction } from "@/lib/calendar/production-map";
import { buildStudioHref, CONTENT_TYPES, contentTypeOptionLabel, contentTypesForPhase, getContentType, resolveContentTypeId } from "@/lib/dashboard/content-types";
import { DEFAULT_DRAW_COMPETITION_ID, drawSetupForLeague } from "@/lib/draw/rounds";
import { CONTENT_TYPE_IDS, type ActiveContentType } from "@/types/content-type";

/**
 * Maç Merkezi içerik türü menüsü (2026-10-28): Head to Head = Oyuncu Karşılaştırması (ayrı "Yakında" satırı yok),
 * Kura Sonucu aktif ve maçtan açılınca maçın turnuvasıyla. 2026-10-30: Tahmin Karnesi + Maç Analizi aktif — menüde
 * "Yakında" tür KALMADI (eski MARKET_RESULTS / POST_MATCH_REPORT kimlikleri yalnızca okumada eşlenir).
 */

const FIXTURE_ID = "api-football-1234567";

function active(id: string): ActiveContentType {
  const type = getContentType(id);
  assert.ok(type && type.status === "active", `${id} aktif olmalı`);
  return type;
}

describe("içerik türü menüsü", () => {
  it("maç öncesi menüde 'Yakında' seçenek yok", () => {
    const labels = contentTypesForPhase("pre_match").map(contentTypeOptionLabel);
    assert.deepEqual(labels, ["Maç Günü Kartı", "Haftanın Maçları", "Muhtemel 11", "AI Market Tahmin & Analiz", "Oyuncu Karşılaştırması", "Kura Sonucu"]);
  });

  it("katalogda 'Yakında' tür yok; maç sonrası menü sırası", () => {
    assert.deepEqual(CONTENT_TYPES.filter((type) => type.status === "coming_soon"), []);
    assert.ok(CONTENT_TYPES.every((type) => !contentTypeOptionLabel(type).includes("Yakında")));
    assert.deepEqual(contentTypesForPhase("post_match").map(contentTypeOptionLabel), ["Maç Sonucu", "Maç İstatistikleri", "Oyuncu İstatistikleri", "Maç Analizi", "Tahmin Karnesi", "Puan Durumu"]);
  });

  it("Tahmin Karnesi ve Maç Analizi → kendi stüdyoları; adres ve etikette 'market' yok", () => {
    assert.equal(buildStudioHref(active("PREDICTION_SCORECARD"), FIXTURE_ID), `/dashboard/studio/prediction-scorecard?fixtureId=${FIXTURE_ID}`);
    assert.equal(buildStudioHref(active("MATCH_ANALYSIS"), FIXTURE_ID), `/dashboard/studio/match-analysis?fixtureId=${FIXTURE_ID}`);
    for (const id of ["PREDICTION_SCORECARD", "MATCH_ANALYSIS"] as const) {
      const type = active(id);
      assert.equal(type.phase, "post_match");
      assert.doesNotMatch(`${type.label} ${type.description} ${type.route} ${id.toLowerCase()}`, /market/iu, "kullanıcıya görünen metin / adres / UTM kampanyası");
    }
  });

  it("eski kimlikler okumada yeni türe eşlenir (eski planlama placeholder'ı)", () => {
    assert.equal(resolveContentTypeId("MARKET_RESULTS"), "PREDICTION_SCORECARD");
    assert.equal(resolveContentTypeId("POST_MATCH_REPORT"), "MATCH_ANALYSIS");
    assert.equal(resolveContentTypeId("NOPE"), null);
    assert.equal(getContentType("MARKET_RESULTS")?.label, "Tahmin Karnesi");
    assert.ok(!(CONTENT_TYPE_IDS as readonly string[]).includes("MARKET_RESULTS"));
    const production = buildFixtureProduction([{ id: "p", fixtureId: "f", status: "DRAFT", contentType: "MARKET_RESULTS", resultImageUrl: null, publishAt: new Date("2026-10-30T20:00:00Z") }]).get("f") ?? {};
    assert.equal(production.PREDICTION_SCORECARD?.status, "planned");
  });

  it("Head to Head ayrı tür değil, eski 'Kuralar ve Maç Eşleşmeleri' adı yok", () => {
    assert.ok(!(CONTENT_TYPE_IDS as readonly string[]).includes("HEAD_TO_HEAD"));
    assert.equal(getContentType("HEAD_TO_HEAD"), undefined);
    assert.equal(active("DRAWS_AND_PAIRINGS").label, "Kura Sonucu");
    assert.match(active("PLAYER_H2H").description, /^Head to Head:/);
  });

  it("Head to Head → oyuncu karşılaştırma stüdyosu, maç seçili", () => {
    assert.equal(buildStudioHref(active("PLAYER_H2H"), FIXTURE_ID), `/dashboard/studio/player-h2h?fixtureId=${FIXTURE_ID}`);
  });

  it("Kura Sonucu → kura stüdyosu, maç kimliğiyle (turnuva sunucuda türetilir)", () => {
    assert.equal(buildStudioHref(active("DRAWS_AND_PAIRINGS"), FIXTURE_ID), `/dashboard/studio/draw?fixtureId=${FIXTURE_ID}`);
  });
});

describe("kura stüdyosu — maçın turnuvası", () => {
  it("Avrupa kupası maçı → o turnuva ve maçın sezonu", () => {
    assert.deepEqual(drawSetupForLeague({ id: 2, season: 2026 }), { competitionId: 2, season: 2026 });
    assert.deepEqual(drawSetupForLeague({ id: 3, season: 2026 }), { competitionId: 3, season: 2026 });
    assert.deepEqual(drawSetupForLeague({ id: 848, season: 2025 }), { competitionId: 848, season: 2025 });
  });

  it("yurt içi lig maçı → null (varsayılan turnuva açılır)", () => {
    assert.equal(drawSetupForLeague({ id: 203, season: 2026 }), null);
    assert.equal(drawSetupForLeague({ id: 39, season: 2026 }), null);
    assert.equal(DEFAULT_DRAW_COMPETITION_ID, 2);
  });
});
