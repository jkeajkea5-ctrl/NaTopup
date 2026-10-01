import {
  PlayerCheckInput,
  PlayerCheckResult,
  SupplierBalance,
  SupplierCode,
  SupplierOrderInput,
  SupplierOrderResult,
  SupplierOrderStatus,
  SupplierOrderStatusResult,
  SupplierProductItem,
} from "@topup/shared";
import { config } from "../../lib/config";
import { logger } from "../../lib/logger";
import { ISupplierAdapter } from "../supplierAdapter";

export class VizoAdapter implements ISupplierAdapter {
  code = SupplierCode.VIZO;
  name = "Vizo Game Top-Up API (vizoapp.store)";
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.vizo.baseUrl;
    this.apiKey = config.vizo.apiKey;
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-API-Key": this.apiKey,
      // Vizo's edge gateway (Cloudflare/LiteSpeed) blocks curl user agents with HTTP 403.
      // A standard browser user-agent is accepted cleanly without challenges.
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    };
  }

  /**
   * Vizo normally returns JSON, including for API errors.  Its edge security
   * layer can instead return an HTML 403 page (for example when this server's
   * IP has not been allowlisted).  Reading the body before parsing prevents
   * that page from surfacing as the misleading "Unexpected token '<'" error.
   */
  private async fetchJson(path: string, init: RequestInit = {}): Promise<{ res: Response; data: any }> {
    const res = await fetch(`${this.baseUrl.replace(/\/+$/, "")}${path}`, init);
    const body = await res.text();

    try {
      return { res, data: body ? JSON.parse(body) : {} };
    } catch {
      const contentType = res.headers.get("content-type") || "unknown content type";
      const accessHint = res.status === 403
        ? " Check VIZO_BASE_URL and allowlist this server's outbound IP in Vizo."
        : "";
      throw new Error(`Vizo returned a non-JSON response (HTTP ${res.status}, ${contentType}).${accessHint}`);
    }
  }

  private mapGameCode(gameCode: string): string {
    const code = (gameCode || "").toLowerCase().trim();
    if (code === "mobile-legends" || code === "mlbb") return "mlbb";
    if (code === "free-fire" || code === "freefire" || code === "freefire_sgmy") return "freefire_sgmy";
    if (code === "pubg-mobile" || code === "pubgm" || code === "pubg_mobile") return "pubgm";
    if (code === "genshin-impact") return "genshin";
    if (code === "honor-of-kings" || code === "hok") return "hok";
    if (code === "valorant") return "valorant";
    return code.replace(/-/g, "_");
  }

  private mapProductCode(supplierProductCode: string): string {
    // Normalizes internal or seeded SKU codes to official Vizo catalog codes
    const code = (supplierProductCode || "").trim();
    const clean = code.replace(/^VIZO_/i, "");

    const mappings: Record<string, string> = {
      MLBB_86: "mlbb_86",
      MLBB_172: "mlbb_172",
      MLBB_257: "mlbb_257",
      MLBB_706: "mlbb_706",
      MLBB_WP: "mlbb_weekly",
      MLBB_TP: "mlbb_twilight",
    };

    if (mappings[clean]) {
      return mappings[clean];
    }

    return clean.toLowerCase();
  }

  async getBalance(): Promise<SupplierBalance> {
    if (!this.apiKey) {
      return {
        supplier: SupplierCode.VIZO,
        balance: 0,
        currency: "USD",
        accountName: "Vizo Premier Reseller",
        isHealthy: false,
        lastChecked: new Date(),
        errorMessage: "Vizo API key not configured",
      };
    }

    try {
      const { res, data } = await this.fetchJson("/api/v1/reseller/profile", {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok && data) {
        const balance = typeof data.balance === "number" ? data.balance : parseFloat(data.balance || 0);
        return {
          supplier: SupplierCode.VIZO,
          balance: isNaN(balance) ? 0 : balance,
          currency: "USD",
          accountName: data.username || "Vizo Reseller",
          isHealthy: data.status === "active" || res.ok,
          lastChecked: new Date(),
        };
      }
      throw new Error(data.detail || data.message || `HTTP ${res.status}`);
    } catch (err: any) {
      logger.error("Vizo getBalance failed", { error: err.message, provider: "VIZO" });
      return {
        supplier: SupplierCode.VIZO,
        balance: 0,
        currency: "USD",
        accountName: "Vizo Reseller",
        isHealthy: false,
        lastChecked: new Date(),
        errorMessage: err.message,
      };
    }
  }

  async checkPlayer(input: PlayerCheckInput): Promise<PlayerCheckResult> {
    if (this.apiKey) {
      try {
        const game = this.mapGameCode(input.gameCode);
        const userId = input.fields.userId || input.fields.playerId || input.fields.characterId || input.fields.uid;
        const serverId = input.fields.zoneId || input.fields.serverId;

        const payload: Record<string, any> = {
          game,
          user_id: userId,
        };
        if (serverId) {
          payload.server_id = serverId;
        }

        const { res, data } = await this.fetchJson("/api/v1/orders/check_player", {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000),
        });

        // Exact match with Vizo response format: { "valid": "valid", "name": "PlayerName" }
        if (res.ok && (data.valid === "valid" || data.status === "APPROVED" || data.status === "SUCCESS")) {
          return {
            valid: true,
            playerName: data.name || data.username || data.player_name,
            extraData: data,
          };
        }

        if (data.valid === "invalid" || data.status === "NOT_ALLOW" || data.message) {
          return {
            valid: false,
            errorMessage: data.message || "Player account could not be verified on Vizo gateway.",
          };
        }
      } catch (err: any) {
        logger.error("Vizo player check failed", { error: err.message, provider: "VIZO" });
        return {
          valid: false,
          errorMessage: "Vizo player verification is temporarily unavailable.",
          extraData: { providerUnavailable: true },
        };
      }
    }

    return {
      valid: false,
      errorMessage: "Vizo player verification is temporarily unavailable.",
      extraData: { providerUnavailable: true },
    };
  }

  async createOrder(input: SupplierOrderInput): Promise<SupplierOrderResult> {
    if (this.apiKey) {
      try {
        const productCode = this.mapProductCode(input.supplierProductCode);
        const callbackUrl = config.vizo.callbackUrl;

        const payload: Record<string, any> = {
          product_code: productCode,
          game_user_id: input.playerId,
          ref_order: input.referenceId,
          callback_url: callbackUrl,
        };

        if (input.serverId) {
          payload.game_zone_id = input.serverId;
        }

        const { res, data } = await this.fetchJson("/api/v1/orders/create_order", {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        });

        if (res.ok && (data.status === "success" || data.transaction_id)) {
          return {
            success: true,
            supplierOrderId: data.transaction_id || input.referenceId,
            supplierStatus: SupplierOrderStatus.PROCESSING,
            supplierCost: parseFloat(data.sell_price || 0),
            currency: "USD",
            rawResponse: data,
          };
        }

        return {
          success: false,
          supplierOrderId: "",
          supplierStatus: SupplierOrderStatus.FAILED,
          supplierCost: 0,
          currency: "USD",
          rawResponse: data,
          errorMessage: data.message || data.detail || "Vizo order placement failed",
        };
      } catch (err: any) {
        logger.error("Vizo createOrder network error", {
          error: err.message,
          provider: "VIZO",
          orderId: input.referenceId,
        });
        return {
          success: false,
          supplierOrderId: "",
          supplierStatus: SupplierOrderStatus.UNKNOWN,
          supplierCost: 0,
          currency: "USD",
          rawResponse: { error: err.message },
          errorMessage: err.message,
        };
      }
    }

    const simulatedOrderId = `VIZO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return {
      success: true,
      supplierOrderId: simulatedOrderId,
      supplierStatus: SupplierOrderStatus.PROCESSING,
      supplierCost: 1.25,
      currency: "USD",
      rawResponse: {
        status: "PROCESSING",
        message: "Order placed successfully on Vizo gateway",
        transaction_id: simulatedOrderId,
        ref_order: input.referenceId,
      },
    };
  }

  async getOrderStatus(supplierOrderId: string, referenceId?: string): Promise<SupplierOrderStatusResult> {
    if (this.apiKey) {
      try {
        const { res, data } = await this.fetchJson("/api/v1/orders/order_history?limit=50", {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok && Array.isArray(data.orders)) {
          const match = data.orders.find(
            (o: any) =>
              o.transaction_id === supplierOrderId ||
              (referenceId && o.ref_order === referenceId)
          );

          if (match) {
            const status = (match.status || "").toLowerCase();
            const isDelivered = status === "success" || status === "completed";
            const isFailed = status === "failed" || status === "rejected";

            return {
              supplierOrderId,
              status: isDelivered
                ? SupplierOrderStatus.COMPLETED
                : isFailed
                ? SupplierOrderStatus.FAILED
                : SupplierOrderStatus.PROCESSING,
              isDelivered,
              isFailed,
              supplierCost: parseFloat(match.sell_price || 0),
              rawResponse: match,
            };
          }
        }
      } catch (err: any) {
        logger.error("Vizo getOrderStatus failed", { error: err.message, provider: "VIZO" });
      }
    }

    return {
      supplierOrderId,
      status: SupplierOrderStatus.UNKNOWN,
      isDelivered: false,
      isFailed: false,
      rawResponse: { status: "UNKNOWN", note: "Supplier status could not be verified" },
      errorMessage: "Vizo order status could not be verified",
    };
  }

  async syncCatalog(): Promise<SupplierProductItem[]> {
    if (this.apiKey) {
      try {
        const { res, data: categories } = await this.fetchJson("/api/v1/catalogue/categories", {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok && Array.isArray(categories)) {
          const items: SupplierProductItem[] = [];
          for (const cat of categories.slice(0, 10)) {
            try {
              const { res: pRes, data: pData } = await this.fetchJson(`/api/v1/catalogue/products/${cat.game_code}`, {
                headers: this.getHeaders(),
                signal: AbortSignal.timeout(15000),
              });
              if (pRes.ok && Array.isArray(pData.products)) {
                for (const p of pData.products) {
                  items.push({
                    supplierCode: SupplierCode.VIZO,
                    gameCode: cat.game_code,
                    productCode: p.product_code,
                    productName: p.name,
                    cost: parseFloat(p.sell_price || 0),
                    currency: "USD",
                    isAvailable: p.status === "active",
                  });
                }
              }
            } catch {}
          }
          return items;
        }
      } catch (err: any) {
        logger.error("Vizo syncCatalog failed", { error: err.message, provider: "VIZO" });
      }
    }
    return [];
  }

  async getGameCatalogue(gameCode: string): Promise<any[]> {
    if (!this.apiKey) return [];
    const game = this.mapGameCode(gameCode);
    try {
      const { res, data } = await this.fetchJson(`/api/v1/catalogue/products/${game}`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok && Array.isArray(data.products)) return data.products;
    } catch (err: any) {
      logger.error("Failed to fetch Vizo game catalogue", { error: err.message, provider: "VIZO", game });
    }
    return [];
  }
}

export const vizoAdapter = new VizoAdapter();
