import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import {
  getEnabledPaymentProvider,
  getPaymentProviderSettings,
  parsePaymentProviderSetting,
  savePaymentProviderSettings,
} from "../lib/paymentProviderSettings";

function mockMethod(t: any, target: any, name: string, implementation: any) {
  const original = target[name];
  target[name] = t.mock.fn(implementation);
  t.after(() => { target[name] = original; });
}

test("parses safe payment names and active states with guarded fallbacks", () => {
  const parsed = parsePaymentProviderSetting("ANJAKPAY", JSON.stringify({ displayName: "  My ABA  ", enabled: true }));
  assert.equal(parsed.displayName, "My ABA");
  assert.equal(parsed.enabled, true);
  assert.equal(parsed.id, "ANJAKPAY");
  assert.equal(typeof parsed.configured, "boolean");

  const malformed = parsePaymentProviderSetting("KHQRPAY_ABA_V2", "not-json");
  assert.equal(malformed.displayName, "ABA KHQR v2");
});

test("saves both provider controls without storing credentials", async (t) => {
  const stored = new Map<string, string>();
  mockMethod(t, prisma.appSetting, "upsert", async ({ where, create, update }: any) => {
    stored.set(where.key, update.value || create.value);
    return { key: where.key, value: stored.get(where.key) };
  });
  mockMethod(t, prisma.appSetting, "findMany", async () => [...stored].map(([key, value]) => ({ key, value })));

  const result = await savePaymentProviderSettings({
    ANJAKPAY: { displayName: "ABA Primary", enabled: true },
    KHQRPAY_ABA_V2: { displayName: "ABA Backup", enabled: false },
  });

  assert.equal(result[0].displayName, "ABA Primary");
  assert.equal(result[0].enabled, true);
  assert.equal(result[1].displayName, "ABA Backup");
  assert.equal(result[1].enabled, false);
  assert.equal([...stored.values()].some((value) => value.toLowerCase().includes("secret")), false);
});

test("returns only enabled and configured providers for payment initialization", async (t) => {
  mockMethod(t, prisma.appSetting, "findMany", async () => [
    { key: "PAYMENT_PROVIDER_ANJAKPAY", value: JSON.stringify({ displayName: "ABA One", enabled: false }) },
    { key: "PAYMENT_PROVIDER_KHQRPAY_ABA_V2", value: JSON.stringify({ displayName: "ABA Two", enabled: true }) },
  ]);
  const all = await getPaymentProviderSettings();
  assert.equal(all.length, 2);
  assert.equal(await getEnabledPaymentProvider("ANJAKPAY"), null);
  const enabled = await getEnabledPaymentProvider("KHQRPAY_ABA_V2");
  assert.equal(enabled?.id, all[1].configured ? "KHQRPAY_ABA_V2" : undefined);
  assert.equal(await getEnabledPaymentProvider("ATTACKER_PROVIDER"), null);
});
