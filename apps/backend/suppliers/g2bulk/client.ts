import crypto from "crypto";
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

export class G2BulkAdapter implements ISupplierAdapter {
  code = SupplierCode.G2BULK;
  name = "G2Bulk Direct Top-Up API";
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    let url = (config.g2bulk.baseUrl || "https://api.g2bulk.com/v1").trim().replace(/\/+$/, "");
    if (!url.endsWith("/v1")) {
      url = `${url}/v1`;
    }
    this.baseUrl = url;
    this.apiKey = config.g2bulk.apiKey;
  }

  private getHeaders(idempotencyKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": this.apiKey,
      "User-Agent": "LukasTopup/1.0",
    };

    if (idempotencyKey) {
      headers["X-Idempotency-Key"] = idempotencyKey;
    }

    return headers;
  }

  private mapGameCode(gameCode: string): string {
    const code = (gameCode || "").toLowerCase().trim();
    if (code === "mobile-legends" || code === "mobile legends" || code === "mobile legends: bang bang" || code === "mlbb") return "mlbb";
    if (code === "free-fire" || code === "freefire" || code === "freefire_sgmy") return "free_fire";
    if (code === "pubg-mobile" || code === "pubgm" || code === "pubg_mobile") return "pubg_mobile";
    if (code === "valorant-cambodia" || code === "valorant_kh" || code === "valorant-kh") return "valorant_kh";
    if (code === "valorant-sg" || code === "valorant_sg") return "valorant_sg";
    if (code === "valorant") return "valorant_kh";
    if (code === "honor-of-kings" || code === "hok") return "hok";
    return code.replace(/-/g, "_");
  }

  private mapCatalogueGameCode(gameCode: string): string {
    return this.mapGameCode(gameCode);
  }

  private mapCatalogueName(supplierProductCode: string): string {
    const clean = (supplierProductCode || "")
      .replace(/^G2B_/i, "")
      .replace(/^MLBB_/i, "")
      .replace(/^PUBGM_/i, "")
      .replace(/^VAL_/i, "")
      .replace(/^HOK_/i, "")
      .replace(/^DELTA_/i, "")
      .replace(/^BLOODSTRIKE_/i, "")
      .trim();

    const mappings: Record<string, string> = {
      "5": "5",
      "12": "12",
      "19": "19",
      "28": "28",
      "44": "44",
      "55": "55",
      "59": "59",
      "85": "85",
      "86": "85",
      "165": "165",
      "170": "170",
      "172": "170",
      "240": "240",
      "275": "275",
      "257": "275",
      "296": "296",
      "408": "408",
      "565": "565",
      "568": "568",
      "706": "875",
      "875": "875",
      "2010": "2010",
      "4830": "4830",
      "WP": "Weekly",
      "Weekly": "Weekly",
      "Weekly Diamond Pass": "Weekly",
      "TP": "Twilight",
      "Twilight": "Twilight",
      "Twilight Pass": "Twilight",
      "Weekly Elite Pack": "Weekly Elite Pack",
      "Monthly Elite Pack": "Monthly Elite Pack",
    };

    if (mappings[clean]) {
      return mappings[clean];
    }

    return clean;
  }

  /**
   * Fetches real live catalogue items for standard Mobile Legends from G2Bulk API.
   */
  async getMlbbCatalogue(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/games/mlbb/catalogue`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.catalogues)) {
        return data.catalogues;
      }
    } catch (err: any) {
      logger.error("Failed to fetch G2Bulk mlbb catalogue", { error: err.message });
    }
    return [];
  }

  async getPubgGlobalCatalogue(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/games/pubgm/catalogue`, {
        headers: this.getHeaders(), signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.catalogues)) return data.catalogues;
    } catch (err: any) {
      logger.error("Failed to fetch G2Bulk PUBG Global catalogue", { error: err.message });
    }
    return [];
  }

  async getHokCatalogue(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/games/hok/catalogue`, {
        headers: this.getHeaders(), signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.catalogues)) return data.catalogues;
    } catch (err: any) {
      logger.error("Failed to fetch G2Bulk HOK catalogue", { error: err.message });
    }
    return [];
  }

  async getZepetoCatalogue(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/games/zepeto/catalogue`, { headers: this.getHeaders(), signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (res.ok && Array.isArray(data.catalogues)) return data.catalogues;
    } catch (err: any) { logger.error("Failed to fetch G2Bulk Zepeto catalogue", { error: err.message }); }
    return [];
  }

  async getDeltaForceCatalogue(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/games/deltaforce/catalogue`, { headers: this.getHeaders(), signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (res.ok && Array.isArray(data.catalogues)) return data.catalogues;
    } catch (err: any) { logger.error("Failed to fetch G2Bulk Delta Force catalogue", { error: err.message }); }
    return [];
  }

  async getBloodStrikeCatalogue(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/games/bloodstrike/catalogue`, { headers: this.getHeaders(), signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (res.ok && Array.isArray(data.catalogues)) return data.catalogues;
    } catch (err: any) { logger.error("Failed to fetch G2Bulk Blood Strike catalogue", { error: err.message }); }
    return [];
  }

  async getMagicChessGogoCatalogue(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/games/magic_chess_gogo/catalogue`, { headers: this.getHeaders(), signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (res.ok && Array.isArray(data.catalogues)) return data.catalogues;
    } catch (err: any) { logger.error("Failed to fetch G2Bulk Magic Chess Gogo catalogue", { error: err.message }); }
    return [];
  }

  async getCrossfireCatalogue(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/games/crossfire/catalogue`, { headers: this.getHeaders(), signal: AbortSignal.timeout(6000) });
      const data = await res.json();
      if (res.ok && Array.isArray(data.catalogues)) return data.catalogues;
    } catch (err: any) { logger.error("Failed to fetch G2Bulk Crossfire catalogue", { error: err.message }); }
    return [];
  }

  /**
   * Fetches real live catalogue items for Valorant Cambodia from G2Bulk API.
   */
  async getValorantKhCatalogue(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/games/valorant_kh/catalogue`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.catalogues)) {
        return data.catalogues;
      }
    } catch (err: any) {
      logger.error("Failed to fetch G2Bulk valorant_kh catalogue", { error: err.message });
    }
    return [];
  }

  /**
   * Fetches real live catalogue items for Valorant SG from G2Bulk API.
   */
  async getValorantSgCatalogue(): Promise<any[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/games/valorant_sg/catalogue`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.catalogues)) {
        return data.catalogues;
      }
    } catch (err: any) {
      logger.error("Failed to fetch G2Bulk valorant_sg catalogue", { error: err.message });
    }
    return [];
  }

  async getBalance(): Promise<SupplierBalance> {
    if (!this.apiKey) {
      return {
        supplier: SupplierCode.G2BULK,
        balance: 0,
        currency: "USD",
        accountName: "G2Bulk Reseller",
        isHealthy: false,
        lastChecked: new Date(),
        errorMessage: "G2Bulk API key not configured",
      };
    }

    try {
      const res = await fetch(`${this.baseUrl}/getMe`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();

      if (res.ok && data) {
        const balance = typeof data.balance === "number" ? data.balance : parseFloat(data.balance || 0);
        return {
          supplier: SupplierCode.G2BULK,
          balance: isNaN(balance) ? 0 : balance,
          currency: "USD",
          accountName: data.username || data.first_name || "G2Bulk Reseller",
          isHealthy: data.success === true || res.ok,
          lastChecked: new Date(),
        };
      }
      throw new Error(data.message || `HTTP ${res.status}`);
    } catch (err: any) {
      logger.error("G2Bulk getBalance failed", { error: err.message, provider: "G2BULK" });
      return {
        supplier: SupplierCode.G2BULK,
        balance: 0,
        currency: "USD",
        accountName: "G2Bulk Reseller",
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
        let userId = input.fields.userId || input.fields.playerId || input.fields.characterId || input.fields.uid || input.fields.riotId;
        const serverId = input.fields.zoneId || input.fields.serverId || input.fields.tagline;
        const charname = input.fields.characterName || input.fields.charname;

        if (game.startsWith("valorant") && serverId && !userId.includes("#")) {
          userId = `${userId}#${serverId.replace(/^#/, "")}`;
        }

        const payload: Record<string, any> = {
          game,
          user_id: userId,
        };
        if (serverId) payload.server_id = serverId;
        if (charname) payload.charname = charname;

        const res = await fetch(`${this.baseUrl}/games/checkPlayerId`, {
          method: "POST",
          headers: this.getHeaders(),
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(8000),
        });

        const data = await res.json();

        // Exact match with G2Bulk: { "valid": "valid", "name": "PlayerName", "region": "cambodia" }
        if (res.ok && data.valid === "valid" && data.name && data.name.trim().length > 0) {
          return {
            valid: true,
            playerName: data.name,
            extraData: data,
          };
        }

        if (data.valid === "invalid" || data.success === false || data.name === "") {
          return {
            valid: false,
            errorMessage: "មិនអាចពិនិត្យគណនីអ្នកលេងបានទេនៅពេលនេះ។ សូមព្យាយាមម្តងទៀត។",
          };
        }
      } catch (err: any) {
        logger.error("G2Bulk player check failed", { error: err.message, provider: "G2BULK" });
      }
    }

    return {
      valid: false,
      errorMessage: "មិនអាចពិនិត្យគណនីអ្នកលេងបានទេនៅពេលនេះ។ សូមព្យាយាមម្តងទៀត។",
    };
  }

  async createOrder(input: SupplierOrderInput): Promise<SupplierOrderResult> {
    if (this.apiKey) {
      try {
        const gameCode = this.mapCatalogueGameCode(input.supplierGameCode || "mlbb");
        const catalogueName = this.mapCatalogueName(input.supplierProductCode);
        const idempotencyKey = crypto.randomUUID(); // Must be valid 36-char UUID

        let playerId = input.playerId;
        if (gameCode.startsWith("valorant") && input.serverId && !playerId.includes("#")) {
          playerId = `${playerId}#${input.serverId.replace(/^#/, "")}`;
        }

        const payload: Record<string, any> = {
          catalogue_name: catalogueName,
          player_id: playerId,
          remark: input.referenceId,
          callback_url: config.g2bulk.callbackUrl,
        };

        if (input.serverId) {
          payload.server_id = input.serverId;
        }
        if (input.extraFields?.charname) {
          payload.charname = input.extraFields.charname;
        }

        const res = await fetch(`${this.baseUrl}/games/${gameCode}/order`, {
          method: "POST",
          headers: this.getHeaders(idempotencyKey),
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        });

        const data = await res.json();

        if (res.ok && data.success && data.order) {
          return {
            success: true,
            supplierOrderId: String(data.order.order_id || data.order.id),
            supplierStatus: SupplierOrderStatus.PROCESSING,
            supplierCost: parseFloat(data.order.price || 0),
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
          errorMessage: data.message || "G2Bulk supplier order creation failed",
        };
      } catch (err: any) {
        logger.error("G2Bulk createOrder network error", {
          error: err.message,
          provider: "G2BULK",
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

    const simulatedOrderId = `G2B-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return {
      success: true,
      supplierOrderId: simulatedOrderId,
      supplierStatus: SupplierOrderStatus.PROCESSING,
      supplierCost: 1.25,
      currency: "USD",
      rawResponse: {
        status: "PROCESSING",
        message: "Order placed successfully on G2Bulk gateway",
        order_id: simulatedOrderId,
      },
    };
  }

  async getOrderStatus(
    supplierOrderId: string,
    referenceId?: string,
    gameCode?: string
  ): Promise<SupplierOrderStatusResult> {
    if (this.apiKey) {
      const numericOrderId = Number(supplierOrderId);

      // G2Bulk's documented endpoint is the game-specific POST endpoint. Use it
      // first when we have the numeric supplier id and game. The legacy GET
      // endpoint can be slow or unavailable for some accounts and was adding a
      // 15-second delay before the real status check.
      if (Number.isInteger(numericOrderId) && gameCode) {
        try {
          const res = await fetch(`${this.baseUrl}/games/order/status`, {
            method: "POST",
            headers: this.getHeaders(),
            body: JSON.stringify({
              order_id: numericOrderId,
              game: this.mapCatalogueGameCode(gameCode),
            }),
            signal: AbortSignal.timeout(8000),
          });
          const data = await res.json();
          if (res.ok && data?.order) {
            const status = String(data.order.status || "").toUpperCase();
            const isDelivered = ["COMPLETED", "SUCCESS", "DELIVERED"].includes(status);
            const isFailed = ["FAILED", "CANCELLED", "CANCELED", "REFUNDED"].includes(status);
            return {
              supplierOrderId,
              status: isDelivered
                ? SupplierOrderStatus.COMPLETED
                : isFailed
                ? SupplierOrderStatus.FAILED
                : SupplierOrderStatus.PROCESSING,
              isDelivered,
              isFailed,
              supplierCost: parseFloat(data.order.price || 0),
              rawResponse: data,
            };
          }
        } catch (err: any) {
          logger.warn("G2Bulk game order status check failed; trying legacy endpoint", {
            error: err.message,
            provider: "G2BULK",
          });
        }
      }

      try {
        // Legacy fallback for suppliers/orders where the game is unavailable.
        const res = await fetch(`${this.baseUrl}/orders/${supplierOrderId}`, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json();

        if (res.ok && data) {
          const status = (data.status || data.order?.status || "").toUpperCase();
          const isDelivered = status === "COMPLETED" || status === "SUCCESS" || status === "DELIVERED";
          const isFailed = status === "FAILED" || status === "CANCELLED" || status === "REFUNDED";

          return {
            supplierOrderId,
            status: isDelivered
              ? SupplierOrderStatus.COMPLETED
              : isFailed
              ? SupplierOrderStatus.FAILED
              : SupplierOrderStatus.PROCESSING,
            isDelivered,
            isFailed,
            supplierCost: parseFloat(data.price || data.order?.price || 0),
            rawResponse: data,
          };
        }
      } catch (err: any) {
        logger.error("G2Bulk getOrderStatus failed", { error: err.message, provider: "G2BULK" });
      }

    }

    return {
      supplierOrderId,
      status: SupplierOrderStatus.UNKNOWN,
      isDelivered: false,
      isFailed: false,
      rawResponse: { status: "UNKNOWN", note: "Supplier status could not be verified" },
      errorMessage: "G2Bulk order status could not be verified",
    };
  }

  async syncCatalog(): Promise<SupplierProductItem[]> {
    if (this.apiKey) {
      try {
        const res = await fetch(`${this.baseUrl}/games`, {
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.games)) {
          const items: SupplierProductItem[] = [];
          for (const g of data.games.slice(0, 10)) {
            try {
              const catRes = await fetch(`${this.baseUrl}/games/${g.code}/catalogue`, {
                headers: this.getHeaders(),
              });
              const catData = await catRes.json();
              if (catRes.ok && Array.isArray(catData.catalogues)) {
                for (const item of catData.catalogues) {
                  items.push({
                    supplierCode: SupplierCode.G2BULK,
                    gameCode: g.code,
                    productCode: String(item.id),
                    productName: item.name,
                    cost: parseFloat(item.amount || 0),
                    currency: "USD",
                    isAvailable: true,
                  });
                }
              }
            } catch {}
          }
          return items;
        }
      } catch (err: any) {
        logger.error("G2Bulk syncCatalog failed", { error: err.message, provider: "G2BULK" });
      }
    }
    return [];
  }
}

export const g2bulkAdapter = new G2BulkAdapter();
