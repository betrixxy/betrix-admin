import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getContentType } from "@/lib/dashboard/content-types";
import { buildH2HCaption, H2H_QUESTION } from "@/lib/dashboard/player-h2h-caption";
import { buildH2HCard } from "@/lib/dashboard/player-h2h-card";
import { MATCH_DAY_FRAMES } from "@/lib/dashboard/match-day-formats";
import { portraitCrop } from "@/lib/dashboard/player-h2h-photo";
import { hashtagCount, hasLink, MAX_HASHTAGS } from "@/lib/dashboard/vitrin-caption";
import { parsePlayerKey, playerKey } from "@/lib/player-h2h/keys";
import { defaultLeader, goalContributionLeader, positionLeaders } from "@/lib/player-h2h/leaders";
import { counterpartSuggestion, slotPosition } from "@/lib/player-h2h/suggest";
import { h2hStudioIssues, type H2HStudioState } from "@/lib/player-h2h/studio-issues";
import { findBannedWords } from "@/lib/prediction/banned-words";
import type { ApiFootballPlayerSeason } from "@/lib/services/api-football/player-season-types";
import { H2H_LEFT, H2H_RIGHT } from "../fixtures/player-h2h";

const season = (id: number, name: string, position: string, goals: number | null, assists: number | null, minutes: number, leagueId = 203, teamId = 998): ApiFootballPlayerSeason => ({
  player: { id, name },
  statistics: [{ team: { id: teamId, name: "Trabzonspor" }, league: { id: leagueId, name: "Süper Lig", season: 2026 }, games: { appearences: 9, minutes, position, rating: "7" }, goals: { total: goals, assists } }],
});

describe("maçtan başla: gol + asist lideri önerisi", () => {
  it("gol + asist; eşitlikte gol, sonra dakika; kaleci ve başka lig sayılmaz", () => {
    const players = [
      season(1, "A", "Attacker", 5, 3, 700),
      season(2, "B", "Midfielder", 3, 5, 800), // 8 — eşit, daha az gol
      season(3, "C", "Goalkeeper", 9, 9, 900),
      season(4, "D", "Attacker", 12, 0, 500, 3), // Avrupa ligi — sayılmaz
      season(306, "Mohamed Salah", "Attacker", 5, 3, 734), // 8, 5 gol — A ile eşit, daha çok dakika
    ];
    assert.equal(goalContributionLeader(players, 998, 203)?.playerId, 306);
  });

  it("gol ve asisti olmayan takımda öneri yok", () => {
    assert.equal(goalContributionLeader([season(1, "A", "Attacker", 0, 0, 90)], 998, 203), null);
    assert.equal(goalContributionLeader([], 998, 203), null);
  });
});

describe("maçtan başla: aynı mevkiden öneri", () => {
  const players = [
    season(1, "Orta", "Midfielder", 6, 6, 800), // takımın genel gol + asist lideri ama forvet değil
    season(2, "Forvet", "Attacker", 5, 2, 700),
    season(3, "Defans", "Defender", 1, 2, 900),
    season(4, "Defans 2", "Defender", 1, 2, 950), // eşit katkı, daha çok dakika
    season(5, "Kaleci", "Goalkeeper", 0, 0, 900),
    season(6, "Yedek kaleci", "Goalkeeper", 0, 0, 90),
  ];

  it("varsayılan: forvetlerin gol + asist lideri (genel lider orta saha olsa da)", () => {
    assert.equal(defaultLeader(players, 998, 203)?.playerId, 2);
  });

  it("forvetlerin katkısı yoksa da varsayılan forvet (iki taraf aynı mevkiden — Konyaspor 2026-10)", () => {
    assert.equal(defaultLeader([season(1, "Orta", "Midfielder", 2, 1, 800), season(2, "Forvet", "Attacker", 0, 0, 300)], 998, 203)?.playerId, 2);
  });

  it("ligde hiç forvet oynamadıysa kaleci dışı gol + asist liderine düşer", () => {
    assert.equal(defaultLeader([season(1, "Orta", "Midfielder", 2, 1, 800), season(3, "Defans", "Defender", 0, 1, 900)], 998, 203)?.playerId, 1);
  });

  it("mevki liderleri: saha oyuncusu gol + asist (eşitlikte dakika), kaleci dakika", () => {
    const leaders = positionLeaders(players, 998, 203);
    assert.deepEqual(Object.fromEntries(Object.entries(leaders).map(([k, v]) => [k, v?.playerId])), { FWD: 2, MID: 1, DEF: 4, GK: 5 });
  });

  it("bir taraf değişince: diğer taraf öneride ise aynı mevkiden kendiliğinden", () => {
    const other = { FWD: "20:645", MID: "21:645", DEF: "22:645" };
    assert.deepEqual(counterpartSuggestion({ position: "MID", other, otherKey: "20:645", otherIsSuggested: true }), { apply: "21:645", hint: null });
  });

  it("diğer taraf elle seçildiyse dokunulmaz, öneri yalnızca gösterilir; zaten aynı mevki ise bir şey yok", () => {
    const other = { FWD: "20:645", MID: "21:645" };
    assert.deepEqual(counterpartSuggestion({ position: "MID", other, otherKey: "99:645", otherIsSuggested: false }), { apply: null, hint: "21:645" });
    assert.deepEqual(counterpartSuggestion({ position: "MID", other, otherKey: "21:645", otherIsSuggested: false }), { apply: null, hint: null });
  });

  it("diğer takımda o mevkide öneri yoksa ya da mevki bilinmiyorsa değişmez (farklı mevki uyarısı kalır)", () => {
    assert.deepEqual(counterpartSuggestion({ position: "GK", other: { FWD: "20:645" }, otherKey: "20:645", otherIsSuggested: true }), { apply: null, hint: null });
    assert.deepEqual(counterpartSuggestion({ position: null, other: { FWD: "20:645" }, otherKey: null, otherIsSuggested: false }), { apply: null, hint: null });
  });

  it("arşiv mevkisi → karşılaştırma mevkisi", () => {
    assert.equal(slotPosition("FWD"), "FWD");
    assert.equal(slotPosition(null), null);
    assert.equal(slotPosition("Attacker"), null);
  });
});

describe("pasif butonun nedenleri (tek satır, hepsi)", () => {
  const ready: H2HStudioState = { start: "free", fixtureId: null, matchLoading: false, left: "306:998", right: "30415:549", analyzing: false, analysisError: null, busy: false };

  it("hazır → neden yok", () => assert.deepEqual(h2hStudioIssues(ready), []));

  it("birden fazla neden listelenir", () => {
    const issues = h2hStudioIssues({ ...ready, start: "match", left: null, right: null, busy: true });
    assert.deepEqual(issues, ["Maçtan başlamak için maçı seçin (ya da serbest moda geçin).", "Soldaki oyuncuyu seçin.", "Sağdaki oyuncuyu seçin.", "Bir işlem sürüyor — bitmesini bekleyin."]);
  });

  it("aynı oyuncu iki tarafta; sunucu reddi (kaleci × saha oyuncusu) olduğu gibi", () => {
    assert.ok(h2hStudioIssues({ ...ready, right: "306:998" }).includes("Aynı oyuncu iki tarafta seçili."));
    const error = "Kaleci ile saha oyuncusu karşılaştırılamaz — iki kaleci ya da iki saha oyuncusu seçin.";
    assert.deepEqual(h2hStudioIssues({ ...ready, analysisError: error }), [error]);
  });
});

describe("oyuncu anahtarı, gönderi metni, vesikalık ayarı, içerik türü", () => {
  it("anahtar gidiş-dönüş; bozuk anahtar null", () => {
    assert.deepEqual(parsePlayerKey(playerKey(306, 998)), { playerId: 306, teamId: 998 });
    assert.equal(parsePlayerKey("306"), null);
    assert.equal(parsePlayerKey("abc:1"), null);
  });

  it("gönderi metni: bahis dili yok, link yok, ≤5 hashtag, soru ile biter", () => {
    const built = buildH2HCard({ left: H2H_LEFT, right: H2H_RIGHT, mode: "PER90", match: null, images: { leftLogo: null, rightLogo: null, leftFace: null, rightFace: null, brandLogo: "" }, frame: MATCH_DAY_FRAMES.IG_PORTRAIT });
    assert.ok(built.ok);
    const caption = buildH2HCaption(H2H_LEFT, H2H_RIGHT, built.data.card);
    assert.deepEqual(findBannedWords(caption), []);
    assert.equal(hasLink(caption), false);
    assert.ok(hashtagCount(caption) <= MAX_HASHTAGS, caption);
    assert.ok(caption.includes(H2H_QUESTION));
    assert.match(caption, /^Kerem Aktürkoğlu – Alassane Pléa \| Oyuncu karşılaştırması/);
    assert.ok(caption.includes("(90 dakika başına)"));
  });

  it("vesikalık elle ayar: zoom kareyi daraltır, kaydırma merkezi kaydırır, sınıra kıstırılır", () => {
    const face = { x: 900, y: 400, width: 200, height: 260, score: 0.9 };
    const auto = portraitCrop(face, { width: 2000, height: 2600 });
    const zoomed = portraitCrop(face, { width: 2000, height: 2600 }, { zoom: 2 });
    assert.equal(zoomed.side, Math.round(auto.side / 2));
    const shifted = portraitCrop(face, { width: 2000, height: 2600 }, { offset: { x: 0.5, y: 0 } });
    assert.equal(shifted.left - auto.left, Math.round(auto.side * 0.25));
    const far = portraitCrop(face, { width: 2000, height: 2600 }, { offset: { x: -1, y: -1 }, zoom: 1 });
    assert.ok(far.left >= 0 && far.top >= 0);
  });

  it("İçerik Planı ve Maç Merkezi: maç öncesi, aktif tür", () => {
    const type = getContentType("PLAYER_H2H");
    assert.equal(type?.phase, "pre_match");
    assert.equal(type?.status, "active");
    assert.equal(type?.status === "active" ? type.route : null, "/dashboard/studio/player-h2h");
  });
});
