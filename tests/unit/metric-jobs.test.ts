import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyOutcome,
  backoffMs,
  connectionWarning,
  MAX_ATTEMPTS,
  nextIstanbulMonday,
  nextIstanbulTime,
  nextUtcDayStart,
  previousIstanbulDay,
} from "@/lib/metrics/job-policy";

const now = new Date("2026-10-15T10:00:00Z");
const MIN = 60_000;

describe("iş kuyruğu — sonuç → durum", () => {
  it("başarı: sonraki kontrol noktası varsa PENDING (deneme sıfırlanır), yoksa DONE", () => {
    const next = new Date("2026-10-16T10:00:00Z");
    assert.deepEqual(applyOutcome(3, { status: "OK" }, next, now), { status: "PENDING", attempts: 0, nextRunAt: next, lastError: null, succeeded: true });
    assert.equal(applyOutcome(0, { status: "OK" }, null, now).status, "DONE");
  });

  it("hata: üstel bekleme 5/10/20 dk…, 5. denemede FAILED", () => {
    assert.equal(backoffMs(1), 5 * MIN);
    assert.equal(backoffMs(2), 10 * MIN);
    assert.equal(backoffMs(3), 20 * MIN);
    assert.equal(backoffMs(20), 6 * 60 * MIN);
    const first = applyOutcome(0, { status: "ERROR", message: "HTTP 503" }, null, now);
    assert.equal(first.status, "PENDING");
    assert.equal(first.attempts, 1);
    assert.equal(first.nextRunAt.getTime() - now.getTime(), 5 * MIN);
    const last = applyOutcome(MAX_ATTEMPTS - 1, { status: "ERROR", message: "HTTP 503" }, null, now);
    assert.equal(last.status, "FAILED");
    assert.equal(last.lastError, "HTTP 503");
  });

  it("erteleme denemeyi saymaz; verilen zamana (yoksa 1 sa sonraya) kayar", () => {
    const until = nextUtcDayStart(now);
    const deferred = applyOutcome(2, { status: "DEFERRED", reason: "X_DAILY_READ_LIMIT", until }, null, now);
    assert.equal(deferred.status, "PENDING");
    assert.equal(deferred.attempts, 2);
    assert.equal(deferred.nextRunAt.toISOString(), "2026-10-16T00:05:00.000Z");
    assert.equal(applyOutcome(0, { status: "DEFERRED", reason: "x" }, null, now).nextRunAt.getTime() - now.getTime(), 60 * MIN);
  });

  it("token sorunu BLOCKED (yeniden bağlanınca devam), silinmiş gönderi DONE", () => {
    assert.equal(applyOutcome(0, { status: "BLOCKED", message: "token" }, null, now).status, "BLOCKED");
    const gone = applyOutcome(0, { status: "GONE", message: "silinmiş" }, new Date(), now);
    assert.equal(gone.status, "DONE");
    assert.equal(gone.succeeded, false);
  });
});

describe("iş takvimi (İstanbul)", () => {
  it("günlük hesap işi: bir sonraki 00:30 İstanbul; veri dünün", () => {
    assert.equal(nextIstanbulTime(now, 0, 30).toISOString(), "2026-10-15T21:30:00.000Z");
    assert.equal(nextIstanbulTime(new Date("2026-10-14T21:00:00Z"), 0, 30).toISOString(), "2026-10-14T21:30:00.000Z");
    assert.equal(previousIstanbulDay(new Date("2026-10-14T21:31:00Z")), "2026-10-14");
  });

  it("haftalık demografi: bir sonraki Pazartesi 01:00 İstanbul", () => {
    const monday = nextIstanbulMonday(now, 1, 0);
    assert.equal(monday.toISOString(), "2026-10-18T22:00:00.000Z");
  });

  it("X günlük sınırı UTC gününde sıfırlanır", () => {
    assert.equal(nextUtcDayStart(new Date("2026-10-15T23:59:00Z")).toISOString(), "2026-10-16T00:05:00.000Z");
  });
});

describe("token bitiş uyarısı", () => {
  it("Meta (yenileme token'ı yok): bitmiş → expired, 7 gün kala → expiring, uzak → yok", () => {
    assert.deepEqual(connectionWarning(new Date("2026-10-14T00:00:00Z"), false, now), { level: "expired", daysLeft: 0 });
    assert.deepEqual(connectionWarning(new Date("2026-10-20T00:00:00Z"), false, now), { level: "expiring", daysLeft: 5 });
    assert.equal(connectionWarning(new Date("2026-12-01T00:00:00Z"), false, now), null);
  });

  it("X gibi kendiliğinden yenilenen token'da uyarı yok", () => {
    assert.equal(connectionWarning(new Date("2026-10-15T09:00:00Z"), true, now), null);
    assert.equal(connectionWarning(null, false, now), null);
  });
});
