import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { config } from "../lib/config";
import { reconciliationService } from "../services/ReconciliationService";
import { GET as reconcilePayments } from "../app/api/internal/cron/payments/route";
import { GET as reconcileFulfilments } from "../app/api/internal/cron/fulfilments/route";
import { GET as reconcileAll } from "../app/api/internal/cron/all/route";

function cronRequest(path: string) {
  return new Request(`http://localhost:3001${path}`, {
    headers: { authorization: `Bearer ${config.cronSecret}` },
  });
}

test("Vercel GET cron independently reconciles payments and fulfilments", async (t) => {
  const payments = t.mock.method(
    reconciliationService,
    "reconcilePendingPayments",
    async () => ({ checked: 1, resolved: 1 })
  );
  const fulfilments = t.mock.method(
    reconciliationService,
    "reconcilePendingFulfilments",
    async () => ({ checked: 1, updated: 1 })
  );

  assert.equal((await reconcilePayments(cronRequest("/api/internal/cron/payments"))).status, 200);
  assert.equal((await reconcileFulfilments(cronRequest("/api/internal/cron/fulfilments"))).status, 200);
  assert.equal(payments.mock.callCount(), 1);
  assert.equal(fulfilments.mock.callCount(), 1);
});

test("all-in-one cron reconciles ABA payments before supplier fulfilments", async (t) => {
  const calls: string[] = [];
  t.mock.method(reconciliationService, "reconcilePendingPayments", async () => {
    calls.push("payments");
    return { checked: 1, resolved: 1 };
  });
  t.mock.method(reconciliationService, "reconcilePendingFulfilments", async () => {
    calls.push("fulfilments");
    return { checked: 1, updated: 1 };
  });

  const response = await reconcileAll(cronRequest("/api/internal/cron/all"));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["payments", "fulfilments"]);
  assert.deepEqual(await response.json(), {
    success: true,
    data: {
      payments: { checked: 1, resolved: 1 },
      fulfilments: { checked: 1, updated: 1 },
    },
  });
});

test("all-in-one cron rejects requests without the shared secret", async () => {
  const response = await reconcileAll(
    new Request("http://localhost:3001/api/internal/cron/all")
  );
  assert.equal(response.status, 401);
});

test("Vercel schedules the all-in-one customer-independent recovery job", async () => {
  const vercelConfig = JSON.parse(
    await readFile(new URL("../../../vercel.json", import.meta.url), "utf8")
  );
  const paths = vercelConfig.crons.map((cron: { path: string }) => cron.path);
  assert.ok(paths.includes("/api/internal/cron/all"));
});

test("explicit supplier callback URLs remain authoritative", () => {
  if (process.env.G2BULK_CALLBACK_URL) {
    assert.equal(config.g2bulk.callbackUrl, process.env.G2BULK_CALLBACK_URL);
  }
  if (process.env.VIZO_CALLBACK_URL) {
    assert.equal(config.vizo.callbackUrl, process.env.VIZO_CALLBACK_URL);
  }
});
