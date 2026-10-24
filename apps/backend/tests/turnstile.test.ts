import test from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstileToken } from "../lib/turnstile";

function configureTurnstile(t: any) {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  const originalHostnames = process.env.TURNSTILE_ALLOWED_HOSTNAMES;
  process.env.TURNSTILE_SECRET_KEY = "test-secret";
  process.env.TURNSTILE_ALLOWED_HOSTNAMES = "natopup.com,www.natopup.com";
  t.after(() => {
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
    if (originalHostnames === undefined) delete process.env.TURNSTILE_ALLOWED_HOSTNAMES;
    else process.env.TURNSTILE_ALLOWED_HOSTNAMES = originalHostnames;
  });
}

test("accepts a valid checkout token for an allowed hostname and action", async (t) => {
  configureTurnstile(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async (_url: string | URL | Request, init?: RequestInit) => {
    const form = new URLSearchParams(String(init?.body));
    assert.equal(form.get("secret"), "test-secret");
    assert.equal(form.get("response"), "valid-turnstile-token");
    assert.equal(form.get("remoteip"), "203.0.113.10");
    return new Response(JSON.stringify({ success: true, hostname: "natopup.com", action: "create_order" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  assert.deepEqual(await verifyTurnstileToken("valid-turnstile-token", "203.0.113.10"), { success: true });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("rejects missing, replayed, wrong-action, and wrong-hostname tokens", async (t) => {
  configureTurnstile(t);
  assert.deepEqual(await verifyTurnstileToken(""), { success: false, reason: "missing-token" });

  const results = [
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { success: true, hostname: "natopup.com", action: "admin_login" },
    { success: true, hostname: "attacker.example", action: "create_order" },
  ];
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(results.shift()), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));

  for (const token of ["replayed-token", "wrong-action-token", "wrong-host-token"]) {
    assert.deepEqual(await verifyTurnstileToken(token), { success: false, reason: "invalid-token" });
  }
});

test("fails closed when Turnstile is unavailable or not configured", async (t) => {
  const originalSecret = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  t.after(() => {
    if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = originalSecret;
  });
  assert.deepEqual(await verifyTurnstileToken("valid-looking-token"), {
    success: false,
    reason: "not-configured",
  });
});
