import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FRAGMENT_MARKER, needsFragmentBounce } from "../../src/lib/services/social/oauth-fragment";

describe("needsFragmentBounce", () => {
  it("parametresiz callback'te fragment'a bakılır", () => {
    assert.equal(needsFragmentBounce(new URLSearchParams("")), true);
  });
  it("sorguda code/state/error varsa doğrudan işlenir", () => {
    assert.equal(needsFragmentBounce(new URLSearchParams("code=a&state=b")), false);
    assert.equal(needsFragmentBounce(new URLSearchParams("error=access_denied&state=b")), false);
  });
  it("işaretli ikinci istek tekrar yönlendirilmez (döngü yok)", () => {
    assert.equal(needsFragmentBounce(new URLSearchParams(`${FRAGMENT_MARKER}=1`)), false);
  });
});
