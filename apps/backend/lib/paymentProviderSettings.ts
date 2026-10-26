import { config } from "./config";
import { prisma } from "./prisma";

export const PAYMENT_PROVIDER_IDS = ["ANJAKPAY", "KHQRPAY_ABA_V2"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export type PaymentProviderSetting = {
  id: PaymentProviderId;
  displayName: string;
  enabled: boolean;
  configured: boolean;
  description: string;
};

const SETTING_KEYS: Record<PaymentProviderId, string> = {
  ANJAKPAY: "PAYMENT_PROVIDER_ANJAKPAY",
  KHQRPAY_ABA_V2: "PAYMENT_PROVIDER_KHQRPAY_ABA_V2",
};

function defaults(): Record<PaymentProviderId, PaymentProviderSetting> {
  return {
    ANJAKPAY: {
      id: "ANJAKPAY",
      displayName: "ABA KHQR",
      // Preserve the current storefront behavior until an administrator
      // explicitly enables the restored Anajak option.
      enabled: false,
      configured: Boolean(config.khqrcc.profileId && config.khqrcc.secretKey),
      description: "Powered by AnajakPay",
    },
    KHQRPAY_ABA_V2: {
      id: "KHQRPAY_ABA_V2",
      displayName: "ABA KHQR v2",
      enabled: config.khqrpay.enabled,
      configured: Boolean(config.khqrpay.apiKey),
      description: "Powered by KHQR PAY",
    },
  };
}

export function parsePaymentProviderSetting(
  id: PaymentProviderId,
  value?: string | null
): PaymentProviderSetting {
  const fallback = defaults()[id];
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    const displayName = typeof parsed?.displayName === "string" ? parsed.displayName.trim() : "";
    return {
      ...fallback,
      displayName: displayName.length >= 2 && displayName.length <= 50 ? displayName : fallback.displayName,
      enabled: typeof parsed?.enabled === "boolean" ? parsed.enabled : fallback.enabled,
    };
  } catch {
    return fallback;
  }
}

export async function getPaymentProviderSettings(): Promise<PaymentProviderSetting[]> {
  const records = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEYS) } },
    select: { key: true, value: true },
  });
  const byKey = new Map(records.map((record) => [record.key, record.value]));
  return PAYMENT_PROVIDER_IDS.map((id) => parsePaymentProviderSetting(id, byKey.get(SETTING_KEYS[id])));
}

export async function savePaymentProviderSettings(input: unknown): Promise<PaymentProviderSetting[]> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Payment provider settings are required.");
  }
  const submitted = input as Record<string, unknown>;
  const updates = PAYMENT_PROVIDER_IDS.map((id) => {
    const provider = submitted[id];
    if (!provider || typeof provider !== "object" || Array.isArray(provider)) {
      throw new Error(`Settings for ${id} are required.`);
    }
    const values = provider as Record<string, unknown>;
    const displayName = typeof values.displayName === "string" ? values.displayName.trim() : "";
    if (displayName.length < 2 || displayName.length > 50 || typeof values.enabled !== "boolean") {
      throw new Error("Each payment name must be 2-50 characters and include an active state.");
    }
    return { id, displayName, enabled: values.enabled };
  });

  await Promise.all(updates.map((provider) => prisma.appSetting.upsert({
    where: { key: SETTING_KEYS[provider.id] },
    update: { value: JSON.stringify(provider), type: "json" },
    create: { key: SETTING_KEYS[provider.id], value: JSON.stringify(provider), type: "json" },
  })));
  return getPaymentProviderSettings();
}

export async function getEnabledPaymentProvider(id: string): Promise<PaymentProviderSetting | null> {
  if (!PAYMENT_PROVIDER_IDS.includes(id as PaymentProviderId)) return null;
  const providers = await getPaymentProviderSettings();
  return providers.find((provider) => provider.id === id && provider.enabled && provider.configured) || null;
}
