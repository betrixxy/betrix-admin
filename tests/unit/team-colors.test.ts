import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clubColors, clubColorSource, registerClubColors } from "@/lib/dashboard/club-colors";
import { resultAccentHex, teamPairColors } from "@/lib/dashboard/match-result-theme";
import { logoTeamColors } from "@/lib/dashboard/team-color-pick";
import type { MatchResultFacts } from "@/types/match-result";
import type { LogoSwatches } from "@/types/lineup";

/**
 * Takım rengi kaynağı (kurucu kararı 2026-10-30): kod tablosu > onaylı > logodan otomatik > NÖTR beyaz (asla
 * altın/marka rengi). Bologna tabloda (kırmızı/lacivert). Logodan renk: baskın swatch'lar, okunurluk kuralıyla.
 */

const swatches = (values: Partial<LogoSwatches>): LogoSwatches => ({ vibrant: null, darkVibrant: null, lightVibrant: null, muted: null, darkMuted: null, lightMuted: null, chromaticShare: 0.8, ...values });

type AccentInput = Parameters<typeof resultAccentHex>[0];
const team = (id: number, colorHex = ""): MatchResultFacts["home"] => ({ id, name: `T${id}`, logoUrl: "", goals: 0, scorers: [], colorHex });
const facts = (homeId: number, awayId: number, outcome: AccentInput["outcome"] = "HOME"): AccentInput => ({
  competition: { kind: "OTHER", name: "Lig", leagueId: 1, logoUrl: "" },
  outcome,
  home: team(homeId),
  away: team(awayId),
});

describe("takım rengi kaynağı", () => {
  it("Bologna kod tablosunda: kırmızı / lacivert", () => {
    assert.deepEqual(clubColors(500), { name: "Bologna", primary: "#A6192E", secondary: "#1B2A4A" });
    assert.equal(clubColorSource(500), "TABLE");
  });

  it("tabloda ve kayıtta olmayan takım: vurgu NÖTR beyaz, altın değil; rakip de beyazsa gümüş", () => {
    assert.equal(resultAccentHex(facts(900001, 900002)), "#ffffff");
    assert.notEqual(resultAccentHex(facts(900001, 900002)).toLowerCase(), "#f5c518");
    assert.deepEqual(teamPairColors(900001, 900002), ["#ffffff", "#c9ced6"]);
  });

  it("öncelik: kod tablosu > onaylı/otomatik kayıt; kayıt tablo dışı takımı kartlara taşır", () => {
    registerClubColors(900003, { name: "Oto FK", primary: "#1E5AA8", secondary: "#FFFFFF" }, "AUTO");
    assert.equal(clubColorSource(900003), "AUTO");
    assert.equal(clubColors(900003)?.primary, "#1E5AA8");
    registerClubColors(500, { name: "Bologna", primary: "#00FF00", secondary: "#000000" }, "AUTO");
    assert.equal(clubColors(500)?.primary, "#A6192E");
    registerClubColors(900003, { name: "Oto FK", primary: "#0F7A3A", secondary: "#FFFFFF" }, "APPROVED");
    assert.equal(clubColorSource(900003), "APPROVED");
    assert.notEqual(resultAccentHex(facts(900003, 900002)), "#ffffff");
  });
});

describe("logodan otomatik renk", () => {
  it("baskın canlı renk birincil, ona benzemeyen ilk aday ikincil", () => {
    assert.deepEqual(logoTeamColors(swatches({ vibrant: "#c8102e", darkVibrant: "#8a0c20", muted: "#1a2f5a" })), { primary: "#C8102E", secondary: "#1A2F5A" });
  });

  it("siyah-beyaz arma (renkli piksel az) → beyaz / siyah", () => {
    assert.deepEqual(logoTeamColors(swatches({ vibrant: "#c8102e", chromaticShare: 0.05 })), { primary: "#FFFFFF", secondary: "#000000" });
  });

  it("okunur aday yoksa ya da logo okunamadıysa null (kart nötr çizer)", () => {
    assert.equal(logoTeamColors(null), null);
    assert.equal(logoTeamColors(swatches({})), null);
  });
});

describe("Maç Günü varsayılan renkleri (ortak kaynak)", () => {
  it("tablodaki iki takım: birincil renkler; benzer renkte deplasman ikinciline geçer", () => {
    const [milan, bologna] = teamPairColors(489, 500);
    assert.notEqual(milan, "#ffffff");
    assert.notEqual(bologna, "#ffffff");
    assert.equal(teamPairColors(645, 489)[0].length, 7);
  });
});
