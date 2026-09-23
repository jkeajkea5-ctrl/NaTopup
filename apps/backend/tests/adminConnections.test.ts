import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_COOKIE, adminIpRuleMatches, createAdminSession, hasAdminSession, isAdminIpRule, requireAdmin, requireAdminWithIp, validAdminKey } from "../lib/adminAuth";
import { adminMutation } from "../lib/adminValidation";
import { prisma } from "../lib/prisma";
import { PATCH } from "../app/api/admin/dashboard/route";

process.env.ADMIN_DASHBOARD_KEY = "test-only-key-with-at-least-32-characters";
process.env.ADMIN_DASHBOARD_ORIGIN = "http://localhost:5200";
const TEST_ADMIN_ID = "a".repeat(24);

function request(body: unknown, origin = "http://localhost:5200") {
  return new Request("http://localhost:3001/api/admin/dashboard", {
    method: "PATCH", headers: { cookie: `${ADMIN_COOKIE}=${createAdminSession({ id: TEST_ADMIN_ID, username: "admin", role: "SUPERADMIN" })}`, origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
const game = { entity: "game", id: "a".repeat(24), data: { name: "Game", category: "Mobile", logoUrl: "/game.png", sortOrder: 0, isActive: true, isPopular: false } };
const packageMutation = {
  entity: "package",
  id: "a".repeat(24),
  data: {
    name: "Pack", amount: "10", iconUrl: "", customBadge: "", category: "normal",
    sortOrder: 0, isActive: true, supplierCost: 1, sellingPrice: 1.25, discount: 0.25,
  },
};

test("admin sessions reject absent and altered tokens", () => {
  assert.equal(hasAdminSession(new Request("http://localhost")), false);
  const token = createAdminSession();
  assert.equal(hasAdminSession(new Request("http://localhost", { headers: { cookie: `${ADMIN_COOKIE}=${token}` } })), true);
  assert.equal(hasAdminSession(new Request("http://localhost", { headers: { cookie: `${ADMIN_COOKIE}=0.${token.split('.').slice(1).join('.')}` } })), false);
  assert.equal(validAdminKey("incorrect"), false);
  assert.equal(validAdminKey(process.env.ADMIN_DASHBOARD_KEY), true);
});

test("mutations reject untrusted origins even with a valid session", () => {
  assert.equal(requireAdmin(request(game, "https://other.example"))?.status, 403);
  assert.equal(requireAdmin(request(game)), null);
});

test("admin allowlists accept exact IPs only", () => {
  assert.equal(isAdminIpRule("203.0.113.42"), true);
  assert.equal(isAdminIpRule("2001:db8::42"), true);
  assert.equal(isAdminIpRule("203.0.113.0/24"), false);
  assert.equal(adminIpRuleMatches("203.0.113.42", "203.0.113.42"), true);
  assert.equal(adminIpRuleMatches("203.0.113.99", "203.0.113.0/24"), false);
});

test("protected admin APIs identify an unapproved network", async () => {
  const originalFindAdmin = prisma.adminUser.findUnique;
  const originalFindIps = prisma.adminIpAllowlist.findMany;
  (prisma.adminUser as any).findUnique = async () => ({ username: "admin", role: "SUPERADMIN", isActive: true });
  (prisma.adminIpAllowlist as any).findMany = async () => [];
  try {
    const denied = await requireAdminWithIp(new Request("http://localhost:3001/api/admin/dashboard", {
      headers: {
        cookie: `${ADMIN_COOKIE}=${createAdminSession({ id: TEST_ADMIN_ID, username: "admin", role: "SUPERADMIN" })}`,
        origin: "http://localhost:5200",
        "x-forwarded-for": "203.0.113.250",
      },
    }));
    assert.equal(denied?.status, 403);
    assert.equal((await denied?.json()).code, "ADMIN_IP_DENIED");
  } finally {
    (prisma.adminUser as any).findUnique = originalFindAdmin;
    (prisma.adminIpAllowlist as any).findMany = originalFindIps;
  }
});

test("validation rejects mass assignment, unsafe URLs and invalid prices", () => {
  assert.equal(adminMutation.safeParse(game).success, true);
  assert.equal(adminMutation.safeParse({ ...game, data: { ...game.data, slug: "overwrite" } }).success, false);
  assert.equal(adminMutation.safeParse({ ...game, data: { ...game.data, logoUrl: "javascript:alert(1)" } }).success, false);
  assert.equal(adminMutation.safeParse(packageMutation).success, true);
  assert.equal(adminMutation.safeParse({ ...packageMutation, data: { ...packageMutation.data, sellingPrice: 1.24 } }).success, false);
  assert.equal(adminMutation.safeParse({ ...packageMutation, data: { ...packageMutation.data, sellingPrice: 1, discount: 1 } }).success, false);
});

test("save route validates before writing, and wraps updates with the audit in a transaction", async () => {
  const original = prisma.$transaction;
  const originalFindAdmin = prisma.adminUser.findUnique;
  const calls: string[] = [];
  (prisma.adminUser as any).findUnique = async () => ({ username: "admin", role: "SUPERADMIN", isActive: true });
  (prisma as any).$transaction = async (callback: any) => callback({
    game: { update: async () => { calls.push("update"); } },
    auditLog: { create: async () => { calls.push("audit"); } },
  });
  try {
    const invalid = await PATCH(request({ ...game, id: "bad" }));
    assert.equal(invalid.status, 400);
    assert.deepEqual(calls, []);
    const saved = await PATCH(request(game));
    assert.equal(saved.status, 200);
    assert.deepEqual(calls, ["update", "audit"]);
    (prisma as any).$transaction = async () => { throw new Error("Database unavailable"); };
    assert.equal((await PATCH(request(game))).status, 409);
  } finally {
    prisma.$transaction = original;
    (prisma.adminUser as any).findUnique = originalFindAdmin;
  }
});
