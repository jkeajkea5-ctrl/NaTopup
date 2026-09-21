import test from "node:test";
import assert from "node:assert/strict";
import { closeProviderCheckout } from "../../apps/frontend/src/services/paymentCheckout.js";

test("closes the provider overlay without reloading", () => {
  const calls = [];
  closeProviderCheckout({
    closeCheckoutByContinueUrl: () => calls.push("close"),
    closeCheckout: () => assert.fail("Must not use the provider's reload action"),
  });
  assert.deepEqual(calls, ["close"]);
});

test("does nothing when the provider is unavailable", () => {
  assert.doesNotThrow(() => closeProviderCheckout(null));
});
