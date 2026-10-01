import {
  PlayerCheckInput,
  PlayerCheckResult,
  SupplierBalance,
  SupplierCode,
  SupplierOrderInput,
  SupplierOrderResult,
  SupplierOrderStatusResult,
} from "@topup/shared";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { g2bulkAdapter } from "./g2bulk/client";
import { ISupplierAdapter } from "./supplierAdapter";
import { vizoAdapter } from "./vizo/client";

export class SupplierManager {
  private adapters: Map<SupplierCode, ISupplierAdapter> = new Map();
  private balanceRefreshes = new Map<SupplierCode, Promise<SupplierBalance>>();

  constructor() {
    this.adapters.set(SupplierCode.VIZO, vizoAdapter);
    this.adapters.set(SupplierCode.G2BULK, g2bulkAdapter);
  }

  getAdapter(code: SupplierCode): ISupplierAdapter {
    const adapter = this.adapters.get(code);
    if (!adapter) {
      throw new Error(`Unsupported supplier: ${code}`);
    }
    return adapter;
  }

  async requireVerifiedPlayer(gameCode: string, fields: Record<string, string>): Promise<PlayerCheckResult> {
    const normalizedCode = gameCode === "free-fire-khsgmy" ? "free-fire" : gameCode;
    const result = await this.checkPlayer(normalizedCode, fields);
    if (result.valid !== true) {
      throw new Error("Player ID was not found or could not be verified. Please check your player details and verify again before payment.");
    }
    return result;
  }

  /**
   * Validates player across available suppliers.
   */
  async checkPlayer(gameCode: string, fields: Record<string, string>): Promise<PlayerCheckResult> {
    const input: PlayerCheckInput = { gameCode, fields };

    // For Mobile Legends and Valorant, prioritize G2Bulk then Vizo
    const isG2BulkPriority = gameCode === "mobile-legends" || gameCode === "mobile-legends-philippines" || gameCode === "mobile-legends-indonesia" || gameCode === "mlbb" || gameCode === "mlbb_exclusive" || gameCode === "mlbb_global" || gameCode === "honor-of-kings" || gameCode === "hok" || gameCode.includes("valorant");
    const primarySupplier = isG2BulkPriority ? SupplierCode.G2BULK : SupplierCode.VIZO;
    const secondarySupplier = isG2BulkPriority ? SupplierCode.VIZO : SupplierCode.G2BULK;

    // Try the primary supplier. A definitive invalid-player response must be
    // respected, while provider/network failures should fall back safely.
    try {
      const primaryRes = await this.getAdapter(primarySupplier).checkPlayer(input);
      if (primaryRes.valid || !primaryRes.extraData?.providerUnavailable) {
        return primaryRes;
      }
      logger.warn(`${primarySupplier} player check unavailable, falling back to ${secondarySupplier}`, {
        error: primaryRes.errorMessage,
      });
    } catch (err: any) {
      logger.warn(`${primarySupplier} player check failed with network error, falling back to ${secondarySupplier}`, { error: err.message });
    }

    try {
      return await this.getAdapter(secondarySupplier).checkPlayer(input);
    } catch (err: any) {
      logger.warn(`${secondarySupplier} player check fallback also failed`, { error: err.message });
    }

    return {
      valid: false,
      errorMessage: "មិនអាចពិនិត្យគណនីអ្នកលេងបានទេនៅពេលនេះ។ សូមព្យាយាមម្តងទៀត។",
    };
  }

  /**
   * Retrieves balances across all suppliers for admin dashboard.
   */
  async getAllBalances(): Promise<SupplierBalance[]> {
    return Promise.all(Array.from(this.adapters.keys()).map((code) => this.getCachedBalance(code)));
  }

  private async getCachedBalance(code: SupplierCode): Promise<SupplierBalance> {
    const key = balanceCacheKey(code);
    const setting = await prisma.appSetting.findUnique({ where: { key } });
    const cached = parseBalanceCache(setting?.value);
    if (cached && isBalanceCacheFresh(cached.lastAttemptAt)) {
      return balanceFromCache(code, cached);
    }

    const pending = this.balanceRefreshes.get(code);
    if (pending) return pending;

    const refresh = this.refreshBalance(code, key, cached).finally(() => {
      this.balanceRefreshes.delete(code);
    });
    this.balanceRefreshes.set(code, refresh);
    return refresh;
  }

  private async refreshBalance(
    code: SupplierCode,
    key: string,
    cached: StoredBalanceCache | null
  ): Promise<SupplierBalance> {
    let result: SupplierBalance;
    try {
      result = await this.getAdapter(code).getBalance();
    } catch (err: any) {
      result = {
        supplier: code,
        balance: 0,
        currency: "USD",
        isHealthy: false,
        lastChecked: new Date(),
        errorMessage: err.message,
      };
    }

    const now = new Date();
    if (result.isHealthy) {
      const next: StoredBalanceCache = {
        balance: result.balance,
        currency: result.currency,
        accountName: result.accountName,
        lastSuccessfulAt: result.lastChecked.toISOString(),
        lastAttemptAt: now.toISOString(),
      };
      await Promise.all([
        saveBalanceCache(key, next),
        prisma.supplier.updateMany({
          where: { code },
          data: {
            balance: result.balance,
            currency: result.currency,
            healthStatus: "HEALTHY",
            lastChecked: result.lastChecked,
            lastError: null,
          },
        }),
      ]);
      return { ...result, cached: false, stale: false };
    }

    const errorMessage = result.errorMessage || "Supplier balance is temporarily unavailable";
    const next: StoredBalanceCache = {
      ...(cached || {}),
      lastAttemptAt: now.toISOString(),
      errorMessage,
    };
    await Promise.all([
      saveBalanceCache(key, next),
      prisma.supplier.updateMany({
        where: { code },
        data: { healthStatus: "DEGRADED", lastError: errorMessage },
      }),
    ]);

    return hasSuccessfulBalance(next)
      ? balanceFromCache(code, next)
      : { ...result, cached: false, stale: false };
  }

  /**
   * Places supplier order with exact supplier selected.
   */
  async placeOrder(input: SupplierOrderInput): Promise<SupplierOrderResult> {
    const adapter = this.getAdapter(input.supplierCode);
    return adapter.createOrder(input);
  }

  /**
   * Checks order status from selected supplier.
   */
  async checkOrderStatus(
    supplierCode: SupplierCode,
    supplierOrderId: string,
    referenceId?: string,
    gameCode?: string
  ): Promise<SupplierOrderStatusResult> {
    const adapter = this.getAdapter(supplierCode);
    return adapter.getOrderStatus(supplierOrderId, referenceId, gameCode);
  }
}

export const BALANCE_CACHE_TTL_MS = 5 * 60 * 1000;

type StoredBalanceCache = {
  balance?: number;
  currency?: string;
  accountName?: string;
  lastSuccessfulAt?: string;
  lastAttemptAt: string;
  errorMessage?: string;
};

function balanceCacheKey(code: SupplierCode) {
  return `supplier_balance:${code}`;
}

export function parseBalanceCache(value: string | null | undefined): StoredBalanceCache | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || typeof parsed.lastAttemptAt !== "string") return null;
    return parsed as StoredBalanceCache;
  } catch {
    return null;
  }
}

export function isBalanceCacheFresh(lastAttemptAt: string, now = Date.now()) {
  const timestamp = Date.parse(lastAttemptAt);
  return Number.isFinite(timestamp) && now - timestamp >= 0 && now - timestamp < BALANCE_CACHE_TTL_MS;
}

function hasSuccessfulBalance(cache: StoredBalanceCache) {
  return typeof cache.balance === "number" && Number.isFinite(cache.balance) && !!cache.lastSuccessfulAt;
}

function balanceFromCache(code: SupplierCode, cache: StoredBalanceCache): SupplierBalance {
  const stale = !!cache.errorMessage;
  return {
    supplier: code,
    balance: cache.balance || 0,
    currency: cache.currency || "USD",
    accountName: cache.accountName,
    isHealthy: hasSuccessfulBalance(cache),
    lastChecked: new Date(cache.lastSuccessfulAt || cache.lastAttemptAt),
    errorMessage: cache.errorMessage,
    cached: true,
    stale,
  };
}

async function saveBalanceCache(key: string, cache: StoredBalanceCache) {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value: JSON.stringify(cache), type: "json" },
    create: { key, value: JSON.stringify(cache), type: "json" },
  });
}

export const supplierManager = new SupplierManager();
