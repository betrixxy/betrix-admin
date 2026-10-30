import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { buildSpotlightCard, buildTopPlayersCard, type PlayerNames } from "@/lib/dashboard/player-stats-card";
import { CARD_NAME_FORMS, nameFor } from "@/lib/names/card-name-forms";
import { assemblePlayerStatsFacts } from "@/lib/player-stats/assemble";
import { RAW_MILAN_BOLOGNA } from "../fixtures/api-football/player-match-stats";

/**
 * Hangi kart hangi ad biçimini yazar (kurucu kararı 2026-10-30): uzun yalnızca posterlerde (Oyuncu
 * İstatistikleri A, Oyuncu Karşılaştırması 01) ve Muhtemel 11 teknik direktöründe; saha, Kahraman Liste,
 * golcüler, MVP satırı, B listesi kısa ("U. ÇAKIR"). Tablo + her kartın tabloyu kendi yuvasıyla okuduğu.
 */

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("kart ad biçimleri", () => {
  it("tablo sabit", () => {
    assert.deepEqual(CARD_NAME_FORMS, {
      PLAYER_STATS_SPOTLIGHT: "long",
      PLAYER_H2H_POSTER: "long",
      LINEUP_PLAYERS: "short",
      LINEUP_COACH: "long",
      SET_SCORERS: "short",
      MATCH_RESULT_MVP: "short",
      PLAYER_STATS_TOP: "short",
    });
  });

  it("nameFor biçimi seçer", () => {
    const person = { name: "Uğurcan Çakır", short: "U. Çakır" };
    assert.equal(nameFor("PLAYER_H2H_POSTER", person), "Uğurcan Çakır");
    assert.equal(nameFor("LINEUP_PLAYERS", person), "U. Çakır");
  });

  it("her kart adını tablodan kendi yuvasıyla alır", () => {
    const uses: Record<string, (keyof typeof CARD_NAME_FORMS)[]> = {
      "src/lib/dashboard/lineup-names.ts": ["LINEUP_PLAYERS", "LINEUP_COACH"],
      "src/lib/dashboard/set-people.ts": ["SET_SCORERS", "MATCH_RESULT_MVP"],
      "src/lib/dashboard/player-stats-card.ts": ["PLAYER_STATS_SPOTLIGHT", "PLAYER_STATS_TOP"],
      "src/lib/player-h2h/names.ts": ["PLAYER_H2H_POSTER"],
    };
    for (const [file, slots] of Object.entries(uses)) {
      const source = read(file);
      for (const slot of slots) assert.ok(source.includes(`"${slot}"`), `${file}: ${slot} kullanılmıyor`);
    }
    const covered = new Set(Object.values(uses).flat());
    assert.deepEqual(Object.keys(CARD_NAME_FORMS).filter((slot) => !covered.has(slot as keyof typeof CARD_NAME_FORMS)), []);
  });

  it("görsel testlerin kişi adları kuraldan (sabit Sportmonks yanıtı → card-names.ts), elle değil", () => {
    for (const file of ["tests/fixtures/studio-cards.ts", "tests/fixtures/player-h2h.ts", "tests/visual/player-stats.test.ts", "tests/visual/checkmatch-set.test.ts"]) {
      assert.ok(read(file).includes("fixturePlayerNames("), `${file}: kart adı kuraldan geçmiyor`);
    }
  });

  it("Oyuncu İstatistikleri: A uzun (poster), B kısa — aynı oyuncu", () => {
    const facts = assemblePlayerStatsFacts(RAW_MILAN_BOLOGNA, new Date("2026-10-30T12:00:00Z"), null);
    assert.ok(facts);
    const line = facts.lines.find((l) => l.playerId === 346866);
    assert.ok(line);
    const images = { homeLogo: null, awayLogo: null, brandLogo: "" };
    const names: PlayerNames = new Map([[line.playerId, { name: "Samuel Mbangula", short: "S. Mbangula", origin: "intl", reliable: true }]]);
    const spotlight = buildSpotlightCard({ facts, line, images, names, pageLabel: null, typographic: true });
    assert.deepEqual([spotlight.firstName, spotlight.lastName], ["SAMUEL", "MBANGULA"]);
    const top = buildTopPlayersCard({ facts, lines: [line], images, names, pageLabel: null });
    assert.equal(top.rows[0]?.name, "S. MBANGULA");
    // Ad katmanı yoksa: A yalnız soyad, B API baş harfi + soyad.
    assert.deepEqual([buildSpotlightCard({ facts, line, images, pageLabel: null, typographic: true }).firstName, buildTopPlayersCard({ facts, lines: [line], images, pageLabel: null }).rows[0]?.name], ["", "S. MBANGULA"]);
  });
});
