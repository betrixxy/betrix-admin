import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { createHealthHandler } from "@/lib/ops/health";

const SECRET_ERROR = "connect failed postgresql://betrix:gizli-sifre@postgres:5432/betrix";

describe("/api/health", () => {
  it("veritabanı yanıt verirse 200 ve önbelleksiz sabit gövde", async () => {
    const response = await createHealthHandler({ pingDatabase: async () => 1 })();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { status: "ok", db: "ok" });
  });

  it("bağlantı hatasında 503; hata metni ne yanıta ne günlüğe düşer", async () => {
    const logged: string[] = [];
    const response = await createHealthHandler({
      pingDatabase: async () => {
        throw new Error(SECRET_ERROR);
      },
      logFailure: (name) => logged.push(name),
    })();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "error", db: "error" });
    assert.deepEqual(logged, ["Error"]);
  });

  it("eşzamanlı hata da 503 olur", async () => {
    const response = await createHealthHandler({
      pingDatabase: () => {
        throw new Error(SECRET_ERROR);
      },
      logFailure: () => {},
    })();
    assert.equal(response.status, 503);
  });

  it("asılı kalan veritabanı zaman aşımıyla 503 olur", async () => {
    const logged: string[] = [];
    const response = await createHealthHandler({
      pingDatabase: () => new Promise(() => {}),
      timeoutMs: 10,
      logFailure: (name) => logged.push(name),
    })();
    assert.equal(response.status, 503);
    assert.deepEqual(logged, ["HealthTimeout"]);
  });

  it("uç dış erişime açık kalır: proxy kapsamı ve Caddy engeli dışında", () => {
    const proxy = readFileSync("src/proxy.ts", "utf8");
    assert.doesNotMatch(proxy, /matcher:[^\]]*\/api/);
    const caddy = readFileSync("Caddyfile", "utf8");
    assert.match(caddy, /respond \/api\/internal\/\* 404/);
    assert.doesNotMatch(caddy, /respond \/api\/health/);
  });
});
