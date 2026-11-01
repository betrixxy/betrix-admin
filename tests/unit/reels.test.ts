import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { formatIstanbulDateTime, publishWindow, publishWindowState } from "@/lib/reels/publish-window";
import { reelCheckLabel, reelQualityOk, reelSceneAvailability } from "@/lib/reels/scenes";
import { canFreezeReel, isReelSelectable, overbookedDays, parseReelsLeagues, REEL_STATUSES, REELS_DEFAULT_LEAGUE_IDS, reelsWeekRange } from "@/lib/reels/selection";
import { parseReelsMatchDetail, parseReelsMatchList, parseReelsResults, reelsFailure, reelsTextValues } from "@/lib/services/reels-schema";
import { reelsMatchFixture, withCheck } from "../fixtures/reels/match-detail";

const LIST_ITEM = {
  match_id: 1001,
  kickoff_utc: "2026-11-08T16:00:00Z",
  league: { id: 203, name: "Kurgu Ligi", round: null },
  home: { id: 1, name: "Kurgu Spor", logo_url: null },
  away: { id: 2, name: "Örnek FK", logo_url: null },
  analysis: { available: true, computed_at: "2026-11-07T11:00:00Z" },
};

describe("reels sözleşmesi", () => {
  it("geçerli yanıtı kabul eder", () => {
    const parsed = parseReelsMatchDetail(reelsMatchFixture());
    assert.equal(parsed.ok, true);
  });

  it("bilinmeyen alanı reddeder (kökte ve iç içe)", () => {
    const root = parseReelsMatchDetail({ ...reelsMatchFixture(), extra: 1 });
    assert.equal(root.ok, false);
    if (!root.ok) assert.equal(root.error.code, "CONTRACT");
    const nested = parseReelsMatchDetail({ ...reelsMatchFixture(), first_goal: { home: 0.5, away: 0.4, none: 0.1, extra: 0 } });
    assert.equal(nested.ok, false);
  });

  it("eksik alanı, yanlış tipi, yanlış sürümü reddeder", () => {
    const missing: Record<string, unknown> = { ...reelsMatchFixture() };
    delete missing.both_score;
    assert.equal(parseReelsMatchDetail(missing).ok, false);
    assert.equal(parseReelsMatchDetail({ ...reelsMatchFixture(), both_score: "0.5" }).ok, false);
    assert.equal(parseReelsMatchDetail({ ...reelsMatchFixture(), contract_version: "2.0" }).ok, false);
    assert.equal(parseReelsMatchDetail({ ...reelsMatchFixture(), score_distribution_basis: "raw" }).ok, false);
    assert.equal(parseReelsMatchDetail(null).ok, false);
  });

  it("hata mesajı sorunlu alanı söyler", () => {
    const parsed = parseReelsMatchDetail({ ...reelsMatchFixture(), both_score: "0.5" });
    assert.ok(!parsed.ok && parsed.error.message.includes("both_score"));
  });

  it("bahis dili taşıyan metni reddeder", () => {
    const base = reelsMatchFixture();
    const parsed = parseReelsMatchDetail({ ...base, recent_xg: { ...base.recent_xg, window: "Oran tablosu" } });
    assert.ok(!parsed.ok && parsed.error.code === "LANGUAGE");
    const check = parseReelsMatchDetail({ ...base, quality: { stale: false, checks: [{ name: "x", ok: true, detail: "kupon önerisi" }] } });
    assert.ok(!check.ok && check.error.code === "LANGUAGE");
  });

  it("yasaklı sözcük içeren ama yasaklı olmayan adları geçirir", () => {
    const base = reelsMatchFixture();
    const parsed = parseReelsMatchDetail({ ...base, teams: { ...base.teams, home: { id: 1, name: "Sunderland", logo_url: null }, away: { id: 2, name: "Hannover 96", logo_url: null } } });
    assert.equal(parsed.ok, true);
  });

  it("metin değerlerini alan adına bakmadan toplar", () => {
    assert.deepEqual(reelsTextValues({ a: "x", b: [{ id: "y" }], c: 1, d: null }), ["x", "y"]);
  });

  it("maç listesi: dile takılan satır çıkar, sayısı bildirilir", () => {
    const parsed = parseReelsMatchList([LIST_ITEM, { ...LIST_ITEM, match_id: 2, home: { id: 3, name: "Banko FK", logo_url: null } }]);
    assert.ok(parsed.ok);
    assert.equal(parsed.data.matches.length, 1);
    assert.equal(parsed.data.blocked, 1);
    assert.equal(parseReelsMatchList([{ ...LIST_ITEM, extra: 1 }]).ok, false);
  });

  it("sonuç listesi", () => {
    const item = { match_id: 1, kickoff_utc: "2026-10-20T16:00:00Z", home: "A", away: "B", final_score: { home: 1, away: 0 }, model_outcome: { home_win: 0.5, draw: 0.3, away_win: 0.2 } };
    assert.equal(parseReelsResults([item]).ok, true);
    assert.equal(parseReelsResults([{ ...item, extra: 1 }]).ok, false);
  });

  it("hata mesajları neden söyler", () => {
    assert.equal(reelsFailure({ kind: "TIMEOUT", message: "" }).code, "TIMEOUT");
    assert.equal(reelsFailure({ kind: "NETWORK", message: "" }).code, "NETWORK");
    assert.equal(reelsFailure({ kind: "HTTP_STATUS", message: "", status: 401 }).code, "UNAUTHORIZED");
    assert.equal(reelsFailure({ kind: "HTTP_STATUS", message: "", status: 404 }).code, "NOT_FOUND");
    assert.equal(reelsFailure({ kind: "HTTP_STATUS", message: "", status: 422 }).code, "QUALITY_REJECTED");
    assert.equal(reelsFailure({ kind: "HTTP_STATUS", message: "", status: 500 }).code, "HTTP");
  });
});

describe("sahne uygunluğu", () => {
  const scenes = (detail = reelsMatchFixture()) => reelSceneAvailability(detail).scenes;

  it("tam veride bütün sahneler açık", () => {
    assert.ok(Object.values(scenes()).every((scene) => scene.available));
    assert.deepEqual(reelSceneAvailability(reelsMatchFixture()).warnings, []);
  });

  it("M1: simülasyon sayısı yoksa kapalı", () => {
    const base = reelsMatchFixture();
    assert.equal(scenes({ ...base, model: { ...base.model, simulations: null } }).M1.available, false);
  });

  it("M2: yalnız score_scene_allowed=true", () => {
    const closed = scenes(reelsMatchFixture({ score_scene_allowed: false })).M2;
    assert.equal(closed.available, false);
    assert.ok(closed.reason.length > 0);
  });

  it("M4, M5: veri yoksa kapalı", () => {
    assert.equal(scenes(reelsMatchFixture({ goals: { three_plus: null } })).M4.available, false);
    assert.equal(scenes(reelsMatchFixture({ both_score: null })).M5.available, false);
  });

  it("M6: üç değerden biri eksikse kapalı", () => {
    assert.equal(scenes(reelsMatchFixture({ first_goal: { home: 0.5, away: 0.4, none: null } })).M6.available, false);
    assert.equal(scenes(reelsMatchFixture({ first_goal: { home: null, away: 0.4, none: 0.1 } })).M6.available, false);
  });

  it("M7: liste dolu VE season_xg_fresh=true", () => {
    assert.equal(scenes(withCheck("season_xg_fresh", false)).M7.available, false);
    const empty = reelsMatchFixture({ season_xg_leaders: { home: [], away: [], data_updated_at: { home: null, away: null } } });
    assert.equal(scenes(empty).M7.available, false);
    const noCheck = reelsMatchFixture({ quality: { stale: false, checks: [] } });
    assert.equal(scenes(noCheck).M7.available, false, "kontrol yoksa açılmaz");
  });

  it("M8: iki takımda da en az 3 maç", () => {
    assert.equal(scenes(reelsMatchFixture({ form: { home: "WWD", away: "LDW" } })).M8.available, true);
    assert.equal(scenes(reelsMatchFixture({ form: { home: "WW", away: "LDW" } })).M8.available, false);
    assert.equal(scenes(reelsMatchFixture({ form: { home: "WWDLW", away: null } })).M8.available, false);
  });

  it("M9: en az 3 karşılaşma", () => {
    const h2h = (played: number | null) => ({ played, home_wins: 0, draws: 0, away_wins: 0 });
    assert.equal(scenes(reelsMatchFixture({ h2h: h2h(3) })).M9.available, true);
    assert.equal(scenes(reelsMatchFixture({ h2h: h2h(2) })).M9.available, false);
    assert.equal(scenes(reelsMatchFixture({ h2h: h2h(null) })).M9.available, false);
  });

  it("computed_at_fresh=false proje genelinde uyarı, sahne kapatmaz", () => {
    const availability = reelSceneAvailability(withCheck("computed_at_fresh", false));
    assert.equal(availability.warnings.length, 1);
    assert.ok(Object.values(availability.scenes).every((scene) => scene.available));
  });

  it("çekirdek kalite: yalnız üç kontrol belirler, eksik kontrol geçmez", () => {
    assert.equal(reelQualityOk(reelsMatchFixture()), true);
    assert.equal(reelQualityOk(withCheck("outcome_sum", false)), false);
    assert.equal(reelQualityOk(withCheck("score_distribution_aligned", false)), false);
    assert.equal(reelQualityOk(withCheck("models_disagree", false)), true);
    assert.equal(reelQualityOk(reelsMatchFixture({ quality: { stale: false, checks: [] } })), false);
  });

  it("kontrol etiketleri ham adı göstermez", () => {
    assert.equal(reelCheckLabel("models_disagree"), "Modeller uyumlu");
    assert.equal(reelCheckLabel("bilinmeyen_ad"), "Diğer kontrol");
  });
});

describe("yayın penceresi", () => {
  const HOUR = 3_600_000;

  it("başlama − 30 sa ile − 6 sa", () => {
    const kickoff = new Date("2026-11-08T16:00:00Z");
    const window = publishWindow(kickoff);
    assert.equal(window.publishFrom.toISOString(), "2026-11-07T10:00:00.000Z");
    assert.equal(window.publishTo.toISOString(), "2026-11-08T10:00:00.000Z");
  });

  it("gösterim İstanbul saatiyle: bugünkü UTC+3", () => {
    const window = publishWindow(new Date("2026-11-08T16:00:00Z"));
    assert.equal(formatIstanbulDateTime(window.publishFrom), "07.11 13:00");
    assert.equal(formatIstanbulDateTime(window.publishTo), "08.11 13:00");
  });

  it("yaz saatine geçiş (2015-03-29, UTC+2 → +3): süre 24 saat, duvar saati kayar", () => {
    const window = publishWindow(new Date("2015-03-29T16:00:00Z")); // İstanbul 19:00 (+3)
    assert.equal(window.publishTo.getTime() - window.publishFrom.getTime(), 24 * HOUR);
    assert.equal(formatIstanbulDateTime(window.publishFrom), "28.03 12:00"); // +2
    assert.equal(formatIstanbulDateTime(window.publishTo), "29.03 13:00"); // +3
  });

  it("kış saatine geçiş (2015-11-08, UTC+3 → +2): süre 24 saat, duvar saati kayar", () => {
    const window = publishWindow(new Date("2015-11-08T17:00:00Z")); // İstanbul 19:00 (+2)
    assert.equal(window.publishTo.getTime() - window.publishFrom.getTime(), 24 * HOUR);
    assert.equal(formatIstanbulDateTime(window.publishFrom), "07.11 14:00"); // +3
    assert.equal(formatIstanbulDateTime(window.publishTo), "08.11 13:00"); // +2
  });

  it("durum: önce, açık, kapandı (sınırlar dahil)", () => {
    const window = publishWindow(new Date("2026-11-08T16:00:00Z"));
    assert.equal(publishWindowState(window, new Date("2026-11-07T09:59:00Z")).phase, "BEFORE");
    assert.equal(publishWindowState(window, window.publishFrom).phase, "OPEN");
    assert.equal(publishWindowState(window, window.publishTo).phase, "OPEN");
    assert.equal(publishWindowState(window, new Date(window.publishTo.getTime() + 1)).phase, "CLOSED");
    assert.match(publishWindowState(window, new Date("2026-11-07T08:00:00Z")).label, /2 sa 0 dk sonra/);
  });
});

describe("seçim kuralları", () => {
  it("bu hafta bugünden pazara, İstanbul gününe göre", () => {
    // Pazar 21:30 UTC = İstanbul Pazartesi 00:30.
    assert.deepEqual(reelsWeekRange("this", new Date("2026-11-01T21:30:00Z")), { from: "2026-11-02", to: "2026-11-08" });
    assert.deepEqual(reelsWeekRange("this", new Date("2026-11-04T10:00:00Z")), { from: "2026-11-04", to: "2026-11-08" });
  });

  it("gelecek hafta bugünden en fazla 10 gün ileri", () => {
    // Pazartesi: pazar 13 gün sonra, 10 güne kırpılır.
    assert.deepEqual(reelsWeekRange("next", new Date("2026-11-02T10:00:00Z")), { from: "2026-11-09", to: "2026-11-12" });
    // Cumartesi: gelecek pazar 8 gün sonra, kırpılmaz.
    assert.deepEqual(reelsWeekRange("next", new Date("2026-11-07T10:00:00Z")), { from: "2026-11-09", to: "2026-11-15" });
  });

  it("lig süzgeci yalnız varsayılan listeden", () => {
    assert.deepEqual(parseReelsLeagues("203,39"), [203, 39]);
    assert.deepEqual(parseReelsLeagues("203,999"), [203]);
    assert.deepEqual(parseReelsLeagues("abc"), REELS_DEFAULT_LEAGUE_IDS);
    assert.deepEqual(parseReelsLeagues(undefined), REELS_DEFAULT_LEAGUE_IDS);
  });

  it("varsayılan ligler istenen liste", () => {
    assert.deepEqual([...REELS_DEFAULT_LEAGUE_IDS], [203, 39, 140, 135, 78, 61, 2, 3, 848, 88, 94]);
  });

  it("günde 2'den fazla seçim uyarı verir, İstanbul gününe göre", () => {
    const at = (iso: string) => new Date(iso);
    assert.deepEqual(overbookedDays([at("2026-11-08T10:00:00Z"), at("2026-11-08T12:00:00Z")]), []);
    assert.deepEqual(overbookedDays([at("2026-11-08T10:00:00Z"), at("2026-11-08T12:00:00Z"), at("2026-11-08T20:59:00Z")]), [{ day: "2026-11-08", count: 3 }]);
    // 21:30 UTC ertesi güne düşer.
    assert.deepEqual(overbookedDays([at("2026-11-08T10:00:00Z"), at("2026-11-08T12:00:00Z"), at("2026-11-08T21:30:00Z")]), []);
  });

  it("başlamış maç seçilemez", () => {
    const kickoff = new Date("2026-11-08T16:00:00Z");
    assert.equal(isReelSelectable(kickoff, new Date("2026-11-08T15:59:00Z")), true);
    assert.equal(isReelSelectable(kickoff, kickoff), false);
    assert.equal(isReelSelectable(kickoff, new Date("2026-11-08T16:01:00Z")), false);
  });

  it("dondurma yalnız onaydan önce", () => {
    const open = REEL_STATUSES.filter(canFreezeReel);
    assert.deepEqual(open, ["SELECTED", "SNAPSHOT_READY", "SCRIPT_DRAFT"]);
  });
});

describe("otomasyon yasağı (CLAUDE.md 1.10)", () => {
  it("zamanlayıcı yolları reels koduna bağlanmaz", () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? files(full) : [full];
    });
    const scheduled = [...files("src/lib/metrics"), ...files("src/app/api/internal")];
    assert.ok(scheduled.length > 0);
    for (const file of scheduled) {
      assert.doesNotMatch(readFileSync(file, "utf8"), /lib\/reels|reels-client/, file);
    }
  });
});
