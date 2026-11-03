import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isInReelSquad, isReelSquadFresh, REEL_SQUAD_MAX_AGE_DAYS, reelSquadStatus, refreshReelSquads, type ReelSquadDeps, type ReelSquadEntry, type ReelSquadPlayer } from "@/lib/reels/squad-rule";

const NOW = new Date("2026-11-03T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
const TRABZONSPOR = { id: 998, name: "Trabzonspor" };
const LIVERPOOL = { id: 40, name: "Liverpool" };
/** Kullanıcının test vakası: Salah Ağustos 2026'da Trabzonspor'a geçti. Yalnız fixture; canlı API çağrılmaz. */
const SALAH = { id: 306, name: "Mohamed Salah" };

function deps(sources: Record<number, ReelSquadPlayer[] | Error>, stored: Record<number, ReelSquadEntry> = {}): ReelSquadDeps & { written: Map<number, ReelSquadEntry> } {
  const written = new Map<number, ReelSquadEntry>();
  return {
    written,
    fetchSquad: async (teamId) => {
      const source = sources[teamId];
      if (source instanceof Error) return { ok: false, message: source.message };
      return { ok: true, data: source ?? [] };
    },
    readStored: async (teamId) => stored[teamId] ?? null,
    store: async (teamId, entry) => {
      written.set(teamId, entry);
    },
  };
}

describe("reels kadro kuralı", () => {
  it("Salah Trabzonspor kadrosunda, Liverpool kadrosunda değil", () => {
    const trabzon = { players: [SALAH, { id: 7001, name: "Oyuncu" }], checkedAt: NOW };
    const liverpool = { players: [{ id: 8001, name: "Oyuncu" }], checkedAt: NOW };
    assert.equal(isInReelSquad(trabzon, SALAH.id, NOW), true);
    assert.equal(isInReelSquad(liverpool, SALAH.id, NOW), false);
    assert.equal(isInReelSquad(null, SALAH.id, NOW), false);
  });
  it("adaş eşleşmez: kimlikle bakılır", () => {
    assert.equal(isInReelSquad({ players: [{ id: 999, name: SALAH.name }], checkedAt: NOW }, SALAH.id, NOW), false);
  });
  it("7 günden eski kayıt doğrulama sayılmaz", () => {
    assert.equal(REEL_SQUAD_MAX_AGE_DAYS, 7);
    assert.equal(isReelSquadFresh(daysAgo(7), NOW), true);
    assert.equal(isReelSquadFresh(daysAgo(7.01), NOW), false);
    assert.equal(isInReelSquad({ players: [SALAH], checkedAt: daysAgo(8) }, SALAH.id, NOW), false);
  });
  it("kaynak yenilenir ve önbelleğe yazılır", async () => {
    const fake = deps({ 998: [SALAH], 40: [{ id: 8001, name: "Oyuncu" }] });
    const result = await refreshReelSquads([TRABZONSPOR, LIVERPOOL], fake, NOW);
    assert.equal(result.checkedAt?.getTime(), NOW.getTime());
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(fake.written.get(998)?.players, [SALAH]);
  });
  it("kaynak hata verirse 7 günden yeni kayıt kullanılır, uyarı çıkar; en eski tarih snapshot'a yazılır", async () => {
    const fake = deps({ 998: new Error("zaman aşımı"), 40: [{ id: 8001, name: "Oyuncu" }] }, { 998: { players: [SALAH], checkedAt: daysAgo(3) } });
    const result = await refreshReelSquads([TRABZONSPOR, LIVERPOOL], fake, NOW);
    assert.equal(result.checkedAt?.getTime(), daysAgo(3).getTime());
    assert.match(result.warnings[0] ?? "", /Trabzonspor: kadro yenilenemedi \(zaman aşımı\)/);
    assert.equal(fake.written.has(998), false);
  });
  it("kaynak boş ya da hatalı, kayıt eski ya da yoksa doğrulanamaz: snapshot alanı null", async () => {
    for (const fake of [deps({ 998: [], 40: [SALAH] }), deps({ 998: new Error("x"), 40: [SALAH] }, { 998: { players: [SALAH], checkedAt: daysAgo(8) } })]) {
      const result = await refreshReelSquads([TRABZONSPOR, LIVERPOOL], fake, NOW);
      assert.equal(result.checkedAt, null);
      assert.match(result.warnings[0] ?? "", /doğrulanamadı.*Oyuncu sahneleri kapalı/);
    }
  });
  it("panel satırı", () => {
    const format = (date: Date) => date.toISOString().slice(0, 10);
    assert.deepEqual(reelSquadStatus(NOW, NOW, format), { ok: true, text: "Kadro doğrulandı: 2026-11-03" });
    assert.equal(reelSquadStatus(null, NOW, format).ok, false);
    assert.match(reelSquadStatus(daysAgo(9), NOW, format).text, /7 günden eski/);
  });
  it("seçim ve dondurma kadroyu yeniler; kadro yolu zamanlayıcıya bağlı değil", () => {
    const engine = readFileSync("src/lib/reels/reel-engine.ts", "utf8");
    assert.equal(engine.match(/refreshProjectSquads\(/g)?.length, 2);
    assert.match(engine, /squadCheckedAt: squads\.checkedAt/);
    assert.ok(!/lib\/reels|refreshProjectSquads/u.test(readFileSync("src/app/api/internal/metrics/tick/route.ts", "utf8")));
  });
});
