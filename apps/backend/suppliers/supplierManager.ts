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
import { g2bulkAdapter } from "./g2bulk/client";
import { ISupplierAdapter } from "./supplierAdapter";
import { vizoAdapter } from "./vizo/client";

export class SupplierManager {
  private adapters: Map<SupplierCode, ISupplierAdapter> = new Map();

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
    const isG2BulkPriority = gameCode === "mobile-legends" || gameCode === "mlbb" || gameCode.includes("valorant");
    const primarySupplier = isG2BulkPriority ? SupplierCode.G2BULK : SupplierCode.VIZO;
    const secondarySupplier = isG2BulkPriority ? SupplierCode.VIZO : SupplierCode.G2BULK;

    // Try primary supplier
    try {
      const primaryRes = await this.getAdapter(primarySupplier).checkPlayer(input);
      // If primary supplier definitively verified (valid or invalid), return immediately
      if (primaryRes.valid || (primaryRes.errorMessage && !primaryRes.errorMessage.includes("could not be verified"))) {
        return primaryRes;
      }
      if (!primaryRes.valid) {
        return primaryRes;
      }
    } catch (err: any) {
      logger.warn(`${primarySupplier} player check failed with network error, falling back to ${secondarySupplier}`, { error: err.message });
      try {
        const secondaryRes = await this.getAdapter(secondarySupplier).checkPlayer(input);
        return secondaryRes;
      } catch (err2: any) {
        logger.warn(`${secondarySupplier} player check fallback also failed`, { error: err2.message });
      }
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
    return Promise.all(Array.from(this.adapters.entries()).map(async ([code, adapter]) => {
      try {
        return await adapter.getBalance();
      } catch (err: any) {
        return {
          supplier: code,
          balance: 0,
          currency: "USD",
          isHealthy: false,
          lastChecked: new Date(),
          errorMessage: err.message,
        };
      }
    }));
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
    referenceId?: string
  ): Promise<SupplierOrderStatusResult> {
    const adapter = this.getAdapter(supplierCode);
    return adapter.getOrderStatus(supplierOrderId, referenceId);
  }
}

export const supplierManager = new SupplierManager();
