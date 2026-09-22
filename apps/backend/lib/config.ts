import dns from "node:dns";
import dotenv from "dotenv";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch (e) {}

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || "development",
  isProduction: process.env.NODE_ENV === "production",
  port: parseInt(process.env.PORT || "3001", 10),
  
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  backendUrl: process.env.BACKEND_URL || "http://localhost:3001",
  
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

  khqrcc: {
    enabled: process.env.KHQRCC_ENABLED === "true",
    baseUrl: process.env.KHQRCC_BASE_URL || "https://anajakpay.com",
    checkoutUrl: process.env.KHQRCC_CHECKOUT_URL || "https://anajakpay.com/api/payment/requestv2",
    profileId: process.env.KHQRCC_PROFILE_ID || "",
    secretKey: process.env.KHQRCC_SECRET_KEY || "",
    sessionSeconds: parseInt(process.env.KHQRCC_SESSION_SECONDS || "420", 10),
    webhookTimeoutMinutes: parseInt(process.env.KHQRCC_WEBHOOK_TIMEOUT_MINUTES || "7", 10),
  },
  
  g2bulk: {
    baseUrl: process.env.G2BULK_BASE_URL || "https://api.g2bulk.com/v1",
    apiKey: process.env.G2BULK_API_KEY || "",
  },
  
  vizo: {
    baseUrl: process.env.VIZO_BASE_URL || "https://api.vizoapp.store",
    apiKey: process.env.VIZO_API_KEY || "",
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
  },
  
  business: {
    maxPriceSurgePercent: parseFloat(process.env.MAX_SUPPLIER_PRICE_SURGE_PERCENT || "5.0"),
    usdToKhrRate: parseInt(process.env.USD_TO_KHR_RATE || "4100", 10),
    paymentExpiryMinutes: 10,
  },
};
