import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isExpired, redactLog, secretValues } from "@/lib/ops/log-redact";

/** Deploy öncesi günlük kaydı: sırlar maskelenir, değerler hiçbir yerde kalmaz; 30 gün saklama. */
describe("günlük sır taraması", () => {
  const env = [
    "# yorum",
    "POSTGRES_PASSWORD=0123456789abcdef0123456789abcdef",
    'JWT_SECRET="ffffeeeeddddccccbbbbaaaa99998888"',
    "FAL_KEY=fal-key-1234567890",
    "APP_BASE_URL=https://www.betrix.pro",
    "SOCIAL_USE_MOCKS=false",
    "X_DAILY_READ_LIMIT=300",
  ].join("\n");

  it("yalnızca sır anahtarlarının değerleri alınır (kısa/açık değerler değil)", () => {
    assert.deepEqual(secretValues(env).map((entry) => entry.key).sort(), ["FAL_KEY", "JWT_SECRET", "POSTGRES_PASSWORD"]);
  });

  it("bilinen değerler ve sır desenleri maskelenir; sayılar raporlanır", () => {
    const log = [
      "2026-10-29T18:10:00Z [fal] istek fal-key-1234567890 ile",
      "postgresql://betrix:0123456789abcdef0123456789abcdef@postgres:5432/betrix",
      "redis://user:baskaSifre99@cache:6379",
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz",
      "cookie checkmatch_session=eyJhbGciOiJIUzI1NiJ9.eyJhZG1pbklkIjoieCJ9.c2lnbmF0dXJlLXZhbHVl; path=/",
      "GET /x?api_key=SUPERSECRET123&page=2",
      "https://www.betrix.pro/login 200",
    ].join("\n");
    const result = redactLog(log, secretValues(env));
    for (const leaked of ["fal-key-1234567890", "0123456789abcdef0123456789abcdef", "baskaSifre99", "abcdefghijklmnopqrstuvwxyz", "c2lnbmF0dXJlLXZhbHVl", "SUPERSECRET123"]) {
      assert.equal(result.text.includes(leaked), false, `sızdı: ${leaked.slice(0, 4)}…`);
    }
    assert.match(result.text, /\[GİZLİ:FAL_KEY\]/);
    assert.match(result.text, /redis:\/\/user:\[GİZLİ\]@cache/);
    assert.match(result.text, /page=2/);
    assert.match(result.text, /https:\/\/www\.betrix\.pro\/login 200/);
    assert.equal(result.envHits.FAL_KEY, 1);
    assert.equal(result.envHits.POSTGRES_PASSWORD, 1);
    assert.ok((result.patternHits["Bearer"] ?? 0) >= 1);
  });

  it("30 günden eski günlük silinir", () => {
    const day = 24 * 60 * 60 * 1000;
    assert.equal(isExpired(0, 31 * day), true);
    assert.equal(isExpired(0, 29 * day), false);
  });
});
