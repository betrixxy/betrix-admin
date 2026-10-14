import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FRAGMENT_MARKER,
  describeProviderError,
  hasProviderError,
  isUserDenial,
  needsFragmentBounce,
} from "../../src/lib/services/social/oauth-fragment";

describe("needsFragmentBounce", () => {
  it("parametresiz callback'te fragment'a bakılır", () => {
    assert.equal(needsFragmentBounce(new URLSearchParams("")), true);
  });
  it("sorguda code/state/error varsa doğrudan işlenir", () => {
    assert.equal(needsFragmentBounce(new URLSearchParams("code=a&state=b")), false);
    assert.equal(needsFragmentBounce(new URLSearchParams("error=access_denied&state=b")), false);
  });
  it("yalnızca error_code (Meta, state'siz) yanıt sayılır — fragment'a yönlendirilmez", () => {
    assert.equal(needsFragmentBounce(new URLSearchParams("error_code=1349048&error_message=x")), false);
  });
  it("işaretli ikinci istek tekrar yönlendirilmez (döngü yok)", () => {
    assert.equal(needsFragmentBounce(new URLSearchParams(`${FRAGMENT_MARKER}=1`)), false);
  });
});

describe("sağlayıcı hatası", () => {
  it("error ya da error_code varsa hata sayılır", () => {
    assert.equal(hasProviderError(new URLSearchParams("error=access_denied")), true);
    assert.equal(hasProviderError(new URLSearchParams("error_code=200")), true);
    assert.equal(hasProviderError(new URLSearchParams("code=a&state=b")), false);
  });
  it("yalnızca kullanıcı iptali 'denied' sayılır", () => {
    assert.equal(isUserDenial(new URLSearchParams("error=access_denied&error_reason=user_denied")), true);
    assert.equal(isUserDenial(new URLSearchParams("error_code=1349048")), false);
  });
  it("log satırı dört alanı tırnaklı, tek satır ve 300 karakterle sınırlı verir", () => {
    const query = new URLSearchParams({ error_code: "1349048", error_message: `Satır\nkırık ${"a".repeat(400)}` });
    const line = describeProviderError(query);
    assert.ok(line.startsWith('error=- error_reason=- error_code="1349048" error_message="Satır kırık a'));
    assert.ok(!line.includes("\n"));
    assert.equal(line.length, 'error=- error_reason=- error_code="1349048" error_message=""'.length + 300);
  });
});
