import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildStudioHref, contentTypeOptionLabel, contentTypesForPhase, getContentType } from "@/lib/dashboard/content-types";
import { DEFAULT_DRAW_COMPETITION_ID, drawSetupForLeague } from "@/lib/draw/rounds";
import { CONTENT_TYPE_IDS, type ActiveContentType } from "@/types/content-type";

/**
 * Maç Merkezi içerik türü menüsü (2026-10-28): Head to Head = Oyuncu Karşılaştırması (ayrı "Yakında" satırı yok),
 * Kura Sonucu aktif ve maçtan açılınca maçın turnuvasıyla; kalan "Yakında" türler bilerek sabit.
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

  it("'Yakında' yalnızca bilinen iki maç sonrası tür", () => {
    const soon = [...contentTypesForPhase("pre_match"), ...contentTypesForPhase("post_match")].filter((type) => type.status === "coming_soon");
    assert.deepEqual(
      soon.map(contentTypeOptionLabel),
      ["Market Sonuçları (Yakında)", "Maç Sonrası Analiz Raporu (Yakında)"],
    );
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
