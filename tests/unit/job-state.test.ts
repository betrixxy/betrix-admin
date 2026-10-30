import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { settleJobState, visibleJobState } from "@/lib/jobs/job-state";

/**
 * Tekrar denemede eski hata (2026-10-30, Maç Sonucu): ilk "Kartı Üret" keskinlikten düştü, ikincisi taslağı
 * kaydetti ama ekran eski hatayla stüdyoda kaldı. Kural saf: gönderim sürerken eski hata gizlenir, başarıda
 * taslağa gidilir, başarısızlıkta yeni mesaj yazılır.
 */

type State = { error?: string | undefined; result?: { id: string } | undefined; job?: unknown };
const draftHref = (state: State) => (state.result ? `/dashboard/drafts/${state.result.id}` : null);
const failed: State = { error: "Fotoğraf yeterince net değil: keskinlik 2 < 45." };

describe("stüdyo iş durumu", () => {
  it("gönderim sürerken önceki denemenin hatası gösterilmez; bitince (hata varsa) görünür", () => {
    assert.equal(visibleJobState(failed, true).error, undefined);
    assert.equal(visibleJobState(failed, false).error, failed.error);
  });

  it("başarısız denemeden sonra başarı: eski hata taşınmaz, taslağa gidilir", () => {
    const settled = settleJobState(failed, { ok: true, value: { result: { id: "d1" } } }, draftHref);
    assert.deepEqual(settled.state, { result: { id: "d1" } });
    assert.equal(settled.href, "/dashboard/drafts/d1");
  });

  it("iş hatayla biterse (değer error taşır) yönlendirme yok; bağlantı kaybında önceki durum + yeni mesaj", () => {
    assert.equal(settleJobState<State>({}, { ok: true, value: { error: "Kart üretilmedi." } }, draftHref).href, null);
    const lost = settleJobState<State>({ result: { id: "d0" } }, { ok: false, message: "Üretim durumu alınamadı" }, draftHref);
    assert.equal(lost.href, null);
    assert.equal(lost.state.error, "Üretim durumu alınamadı");
  });

  it("hedef verilmezse sayfada kalınır (diğer formlar)", () => {
    assert.equal(settleJobState(failed, { ok: true, value: { result: { id: "d1" } } }).href, null);
  });
});
