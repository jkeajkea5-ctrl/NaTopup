import dns from "node:dns";
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

dotenv.config();

// Workspace development starts Next.js from apps/backend, while the complete
// local payment configuration lives in the repository root .env. Read only
// payment-related values from that file so stale credentials in a nested .env
// cannot produce misleading provider errors. Hosted environments continue to
// use their injected variables because the repository root file is absent.
let rootDevelopmentEnv: Record<string, string> = {};
if (process.env.NODE_ENV !== "production") {
  try {
    const rootEnvPath = path.resolve(process.cwd(), "../../.env");
    if (fs.existsSync(rootEnvPath)) {
      rootDevelopmentEnv = dotenv.parse(fs.readFileSync(rootEnvPath));
    }
  } catch {}
}

function paymentEnv(name: string): string | undefined {
  return rootDevelopmentEnv[name] || process.env[name];
}

function callbackOrigin(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (!value) continue;
    try {
      return new URL(value).origin;
    } catch {}
  }
  return "http://localhost:3001";
}

const frontendUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || "http://localhost:5173";
const backendUrl =
  rootDevelopmentEnv.PUBLIC_BASE_URL ||
  process.env.BACKEND_URL ||
  process.env.PUBLIC_BASE_URL ||
  callbackOrigin(process.env.G2BULK_CALLBACK_URL, process.env.VIZO_CALLBACK_URL);

export const config = {
  env: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT || "3001", 10),
  
  frontendUrl,
  backendUrl,
  
  authSecret: process.env.AUTH_SECRET || "default_auth_secret_must_be_overridden_in_prod",
  internalApiSecret: process.env.INTERNAL_API_SECRET || "default_internal_secret",
  cronSecret: process.env.CRON_SECRET || "default_cron_secret",
  adminSecretKey: process.env.ADMIN_SECRET_KEY || "admin123456",
  
  khqr: {
    baseUrl: process.env.KHQR_API_BASE_URL || "https://api.khqr.cc/v1",
    apiKey: process.env.KHQR_API_KEY || "",
    apiSecret: process.env.KHQR_API_SECRET || "",
    webhookSecret: process.env.KHQR_WEBHOOK_SECRET || "",
    merchantId: process.env.KHQR_MERCHANT_ID || "LUKAS_TOPUP_KHQR",
    merchantName: process.env.KHQR_MERCHANT_NAME || "LUKAS GAME TOPUP",
    terminalId: process.env.KHQR_TERMINAL_ID || "TERM001",
    currency: process.env.KHQR_CURRENCY || "USD",
    bakongAccountId: process.env.KHQR_BAKONG_ACCOUNT_ID || "natopup@abaa",
  },

  // ABA KHQR v2 is the only supported payment provider.
  khqrpay: {
    enabled: paymentEnv("KHQR_PAY_ABA_ENABLED") !== "false",
    baseUrl: paymentEnv("KHQR_PAY_ABA_BASE_URL") || "https://khqrpay.site",
    apiKey: paymentEnv("KHQR_PAY_ABA_API_KEY") || "",
    webhookSecret: paymentEnv("KHQR_PAY_ABA_WEBHOOK_SECRET") || "",
  },

  khqrcc: {
    enabled: paymentEnv("KHQRCC_ENABLED") === "true",
    baseUrl: paymentEnv("KHQRCC_BASE_URL") || "https://anajakpay.com",
    checkoutUrl: paymentEnv("KHQRCC_CHECKOUT_URL") || "https://anajakpay.com/api/payment/requestv2",
    profileId: paymentEnv("KHQRCC_PROFILE_ID") || "",
    secretKey: paymentEnv("KHQRCC_SECRET_KEY") || "",
    sessionSeconds: parseInt(paymentEnv("KHQRCC_SESSION_SECONDS") || "420", 10),
    webhookTimeoutMinutes: parseInt(paymentEnv("KHQRCC_WEBHOOK_TIMEOUT_MINUTES") || "5", 10),
    webhookMaxAgeSeconds: parseInt(paymentEnv("KHQRCC_WEBHOOK_MAX_AGE_SECONDS") || "300", 10),
  },
  
  g2bulk: {
    baseUrl: process.env.G2BULK_BASE_URL || "https://api.g2bulk.com/v1",
    apiKey: process.env.G2BULK_API_KEY || "",
    callbackUrl: process.env.G2BULK_CALLBACK_URL || `${backendUrl}/api/webhooks/g2bulk`,
  },
  
  vizo: {
    baseUrl: process.env.VIZO_BASE_URL || "https://api.vizoapp.store",
    apiKey: process.env.VIZO_API_KEY || "",
    callbackUrl: process.env.VIZO_CALLBACK_URL || `${backendUrl}/api/webhooks/vizo`,
  },

  telegram: {
    // Keep bot credentials server-side. The topic bot is preferred, while the
    // older variables remain supported for existing deployments.
    botToken:
      process.env.TELEGRAM_BOT_TOKEN_TOPIC ||
      process.env.TELEGRAM_BOT_TOKEN_NOTIFICATION ||
      process.env.TELEGRAM_BOT_TOKEN_ADMIN ||
      "",
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID || "",
    paidThreadId: parseInt(process.env.TELEGRAM_PAID_THREAD_ID || "0", 10),
    completedThreadId: parseInt(process.env.TELEGRAM_COMPLETED_THREAD_ID || "0", 10),
    systemThreadId: parseInt(process.env.TELEGRAM_SYSTEM_THREAD_ID || "0", 10),
    lowBalanceG2bThreadId: parseInt(process.env.TELEGRAM_LOW_BALANCE_G2B_THREAD_ID || "22", 10),
    lowBalanceVizoThreadId: parseInt(process.env.TELEGRAM_LOW_BALANCE_VIZO_THREAD_ID || "25", 10),
    lowBalanceThresholdUsd: parseFloat(process.env.TELEGRAM_LOW_BALANCE_THRESHOLD_USD || "3"),
  },

  paymentPolling: {
    intervalSeconds: parseInt(process.env.PAYMENT_POLL_INTERVAL_SECONDS || "30", 10),
    limit: parseInt(process.env.PAYMENT_POLL_LIMIT || "50", 10),
    maxAgeMinutes: parseInt(process.env.PAYMENT_POLL_MAX_AGE_MINUTES || "1440", 10),
  },
  
  business: {
    maxPriceSurgePercent: parseFloat(process.env.MAX_SUPPLIER_PRICE_SURGE_PERCENT || "5.0"),
    usdToKhrRate: parseInt(process.env.USD_TO_KHR_RATE || "4100", 10),
    paymentExpiryMinutes: 10,
  },
};
