import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { checkRateLimit } from "../lib/rateLimit";

function mockMethod(t: any, target: any, name: string, implementation: any) {
  const original = target[name];
  const mock = t.mock.fn(implementation);
  target[name] = mock;
  t.after(() => { target[name] = original; });
  return mock;
}

test("creates the first shared rate-limit bucket", async (t) => {
  mockMethod(t, prisma.apiRateLimit, "updateMany", async () => ({ count: 0 }));
  const create = mockMethod(t, prisma.apiRateLimit, "create", async () => ({ id: "bucket" } as any));

  const result = await checkRateLimit("test:first", { windowMs: 60_000, maxRequests: 3 });

  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 2);
  assert.equal(create.mock.callCount(), 1);
});

test("rejects a request when a concurrent bucket is already full", async (t) => {
  mockMethod(t, prisma.apiRateLimit, "updateMany", async () => ({ count: 0 }));
  mockMethod(t, prisma.apiRateLimit, "create", async () => { throw new Error("duplicate key"); });

  const result = await checkRateLimit("test:full", { windowMs: 60_000, maxRequests: 1 });

  assert.equal(result.allowed, false);
  assert.equal(result.unavailable, undefined);
});

test("fails closed when the shared limiter database is unavailable", async (t) => {
  mockMethod(t, prisma.apiRateLimit, "updateMany", async () => { throw new Error("offline"); });

  const result = await checkRateLimit("test:offline", { windowMs: 60_000, maxRequests: 3 });

  assert.equal(result.allowed, false);
  assert.equal(result.unavailable, true);
});
