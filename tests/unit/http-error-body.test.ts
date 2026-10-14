import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeErrorBody } from "../../src/lib/services/shared/http";

describe("describeErrorBody", () => {
  it("Meta hata nesnesinden yalnızca tanı alanlarını çıkarır", () => {
    const body = {
      error: { message: "Invalid OAuth access token.", type: "OAuthException", code: 190, error_subcode: 463, fbtrace_id: "AbC123", extra: "x" },
    };
    assert.equal(describeErrorBody(body), 'type=OAuthException code=190 error_subcode=463 fbtrace_id=AbC123 message="Invalid OAuth access token."');
  });
  it("message ilk 300 karakterle sınırlanır", () => {
    const detail = describeErrorBody({ error: { message: "a".repeat(500) } });
    assert.equal(detail, `message="${"a".repeat(300)}"`);
  });
  it("hata nesnesi yoksa ya da tanınan alan yoksa null", () => {
    assert.equal(describeErrorBody(null), null);
    assert.equal(describeErrorBody({ errors: ["x"] }), null);
    assert.equal(describeErrorBody({ error: "access_denied" }), null);
    assert.equal(describeErrorBody({ error: { foo: 1 } }), null);
  });
});
