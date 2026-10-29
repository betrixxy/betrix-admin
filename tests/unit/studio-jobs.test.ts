import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { awaitJob, JOB_MISSING_MESSAGE, JOB_POLL_FAILED_MESSAGE } from "@/lib/jobs/await-job";
import { reportJobStep, startStudioJob, studioJobView } from "@/lib/jobs/studio-jobs";
import { loserPhotoWarning } from "@/lib/dashboard/match-result-featured";
import { isStaleActionError, STALE_ACTION_MESSAGE, actionFailureMessage } from "@/lib/dashboard/upload-prep";
import { falTimeoutMessage, falUpload, isFalTimeout } from "@/lib/services/fal/timeout";
import type { StudioJobView } from "@/types/studio-job";

/**
 * Arka plan stüdyo işleri (2026-10-29: Maç Sonucu canlıda "Sunucu isteği tamamlayamadı"). Uzun üretim
 * istekten ayrılır: eylem iş kimliğini hemen döner, stüdyo durumu sorar; aynı iş iki kez başlamaz;
 * zaman aşımı / Fal hatası anlaşılır mesajla biter; sayfa kapansa da iş biter.
 */

type State = { error?: string; result?: { id: string } };
const failState = (message: string): State => ({ error: message });
const tick = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));
let seq = 0;
const key = (name: string) => `test:${name}:${++seq}`;

async function finished(jobId: string): Promise<StudioJobView> {
  for (let i = 0; i < 200; i += 1) {
    const view = studioJobView(jobId);
    if (view.status !== "running") return view;
    await tick(5);
  }
  throw new Error("iş bitmedi");
}

describe("arka plan stüdyo işi", () => {
  it("eylem hemen döner; iş arka planda biter, adımlar görünür", async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const started = startStudioJob<State>({
      kind: "test",
      key: key("adım"),
      firstStep: "Maç verisi alınıyor",
      run: async () => {
        await tick();
        // İç içe await + Promise.all içinden de adım yazılır (AsyncLocalStorage).
        await Promise.all([(async () => reportJobStep("Fotoğraf büyütülüyor (Fal ESRGAN)"))()]);
        await gate;
        return { result: { id: "draft-1" } };
      },
      fail: failState,
    });
    assert.equal(started.reused, false);
    await tick(5);
    const running = studioJobView(started.jobId);
    assert.equal(running.status, "running");
    assert.equal(running.status === "running" && running.step, "Fotoğraf büyütülüyor (Fal ESRGAN)");
    release();
    const done = await finished(started.jobId);
    assert.deepEqual(done.status === "done" && done.value, { result: { id: "draft-1" } });
  });

  it("aynı iş çalışırken ikinci tıklama yeni iş başlatmaz, çalışana bağlanır", async () => {
    const k = key("tekrar");
    let runs = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const run = async (): Promise<State> => {
      runs += 1;
      await gate;
      return { result: { id: "tek" } };
    };
    const first = startStudioJob<State>({ kind: "test", key: k, firstStep: "başla", run, fail: failState });
    const second = startStudioJob<State>({ kind: "test", key: k, firstStep: "başla", run, fail: failState });
    assert.equal(second.jobId, first.jobId);
    assert.equal(second.reused, true);
    release();
    await finished(first.jobId);
    assert.equal(runs, 1);
    // Bitmiş işten sonra aynı anahtar yeni iş açar (yeni kart istenmiştir).
    const third = startStudioJob<State>({ kind: "test", key: k, firstStep: "başla", run: async () => ({ result: { id: "yeni" } }), fail: failState });
    assert.notEqual(third.jobId, first.jobId);
  });

  it("zaman aşımı: iş süreyi aşarsa son adımı söyleyen hatayla biter", async () => {
    const started = startStudioJob<State>({
      kind: "test",
      key: key("süre"),
      firstStep: "Maç verisi alınıyor",
      run: async () => {
        reportJobStep("Fotoğraf büyütülüyor (Fal ESRGAN)");
        await new Promise(() => undefined); // Fal kuyruğu hiç dönmüyor
        return {};
      },
      fail: failState,
      timeoutMs: 30,
    });
    const done = await finished(started.jobId);
    const value = done.status === "done" ? (done.value as State) : {};
    assert.match(value.error ?? "", /bitmedi \(son adım: Fotoğraf büyütülüyor \(Fal ESRGAN\)\)/);
  });

  it("Fal hatası (istisna): sayfa çökmez, adımı söyleyen tek satır döner", async () => {
    const started = startStudioJob<State>({
      kind: "test",
      key: key("fal"),
      firstStep: "Maç verisi alınıyor",
      run: async () => {
        reportJobStep("Oyuncu kesimi ve stadyum arka planı (Fal)");
        throw new Error("Fal 502 Bad Gateway");
      },
      fail: failState,
    });
    const done = await finished(started.jobId);
    assert.equal((done.status === "done" ? (done.value as State) : {}).error, 'Üretim "Oyuncu kesimi ve stadyum arka planı (Fal)" adımında tamamlanamadı — tekrar deneyin.');
  });

  it("yarıda kapatılan sayfa: kimse sormasa da iş biter, sonuç sonradan alınabilir", async () => {
    let saved = false;
    const started = startStudioJob<State>({
      kind: "test",
      key: key("kapandı"),
      firstStep: "Kart çiziliyor",
      run: async () => {
        await tick(20);
        saved = true; // DRAFT yazıldı
        return { result: { id: "draft-kapandı" } };
      },
      fail: failState,
    });
    // Stüdyo hiç sormuyor (sekme kapandı).
    await tick(60);
    assert.equal(saved, true);
    const view = studioJobView(started.jobId);
    assert.equal(view.status, "done");
  });

  it("sunucu yeniden başladı (iş bilinmiyor) → missing", () => {
    assert.deepEqual(studioJobView("00000000-0000-0000-0000-000000000000"), { status: "missing" });
  });
});

describe("istemci bekleme döngüsü", () => {
  const noSleep = async () => undefined;

  it("bitene kadar sorar, adımları iletir", async () => {
    const views: StudioJobView<State>[] = [
      { status: "running", step: "Maç verisi alınıyor", elapsedMs: 100 },
      { status: "running", step: "Kart çiziliyor (01)", elapsedMs: 2100 },
      { status: "done", value: { result: { id: "x" } }, elapsedMs: 4100 },
    ];
    const steps: string[] = [];
    const result = await awaitJob("j", async () => views.shift() ?? { status: "missing" }, (step) => steps.push(step), { sleep: noSleep });
    assert.deepEqual(result, { ok: true, value: { result: { id: "x" } } });
    assert.deepEqual(steps, ["Maç verisi alınıyor", "Kart çiziliyor (01)"]);
  });

  it("iş kaybolduysa anlaşılır mesaj", async () => {
    const result = await awaitJob<State>("j", async () => ({ status: "missing" }), () => undefined, { sleep: noSleep });
    assert.deepEqual(result, { ok: false, message: JOB_MISSING_MESSAGE });
  });

  it("tek kopuk sorgu işi bitirmez; art arda kopuklukta vazgeçer", async () => {
    let calls = 0;
    const flaky = async (): Promise<StudioJobView<State>> => {
      calls += 1;
      if (calls === 1) throw new Error("fetch failed");
      return { status: "done", value: {}, elapsedMs: 1 };
    };
    assert.deepEqual(await awaitJob("j", flaky, () => undefined, { sleep: noSleep }), { ok: true, value: {} });
    const dead = await awaitJob<State>("j", async () => Promise.reject(new Error("fetch failed")), () => undefined, { sleep: noSleep, maxPollFailures: 3 });
    assert.deepEqual(dead, { ok: false, message: JOB_POLL_FAILED_MESSAGE });
  });
});

describe("Fal zaman sınırı", () => {
  it("AbortSignal.timeout hatası zaman aşımı sayılır, mesaj saniyeyi söyler", async () => {
    const signal = AbortSignal.timeout(1);
    await tick(10);
    assert.equal(isFalTimeout(signal.reason), true);
    assert.equal(isFalTimeout(new Error("Unprocessable Entity")), false);
    assert.match(falTimeoutMessage("Fotoğraf büyütme (ESRGAN)", 120_000), /^Fotoğraf büyütme \(ESRGAN\): Fal\.ai 120 sn içinde yanıt vermedi/);
  });

  it("Fal yüklemesi dönmezse süre sonunda bırakılır", async () => {
    const stuck = { storage: { upload: () => new Promise<string>(() => undefined) } } as unknown as Parameters<typeof falUpload>[0];
    await assert.rejects(falUpload(stuck, new Blob(["x"]), 20), (error: unknown) => isFalTimeout(error));
  });
});

describe("Maç Sonucu kazanan takım kuralı", () => {
  const facts = (outcome: "HOME" | "AWAY" | "DRAW") => ({ outcome, home: { id: 489, name: "Milan" }, away: { id: 500, name: "Bologna" } }) as Parameters<typeof loserPhotoWarning>[0];

  it("kaybedenin forması → uyarı; kazanan, beraberlik ya da bilinmeyen forma → yok", () => {
    assert.equal(loserPhotoWarning(facts("AWAY"), 489), "Milan bu maçı kaybetti; kazanan takımın (Bologna) fotoğrafı önerilir.");
    assert.equal(loserPhotoWarning(facts("AWAY"), 500), null);
    assert.equal(loserPhotoWarning(facts("DRAW"), 489), null);
    assert.equal(loserPhotoWarning(facts("HOME"), null), null);
  });
});

describe("eski sürüm sayfası", () => {
  it("deploy sonrası eski eylem kimliği → 'sayfayı yenileyin'", () => {
    const stale = Object.assign(new Error('Server Action "7f00aa" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action'), { name: "UnrecognizedActionError" });
    assert.equal(isStaleActionError(stale), true);
    assert.equal(actionFailureMessage(1000, stale), STALE_ACTION_MESSAGE);
    assert.match(actionFailureMessage(1000, new TypeError("Failed to fetch")), /bağlantı koptu/);
  });
});
