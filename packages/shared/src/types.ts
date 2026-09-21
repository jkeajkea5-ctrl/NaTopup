import { OrderStatus, PaymentStatus, FulfilmentStatus, SupplierOrderStatus, SupplierCode } from "./enums";

export interface PlayerCheckInput {
  gameCode: string;
  fields: Record<string, string>;
}

export interface PlayerCheckResult {
  valid: boolean;
  playerName?: string;
  userId?: string;
  zoneId?: string;
  extraData?: Record<string, any>;
  errorMessage?: string;
}

export interface SupplierOrderInput {
  supplierCode: SupplierCode;
  supplierProductCode: string;
  supplierGameCode: string;
  referenceId: string; // Unique local reference (e.g. TP-2026-XXXXXXXX)
  playerId: string;
  serverId?: string;
  extraFields?: Record<string, any>;
}

export interface SupplierOrderResult {
  success: boolean;
  supplierOrderId: string;
  supplierStatus: SupplierOrderStatus;
  supplierCost: number;
  currency: string;
  rawResponse: any;
  errorMessage?: string;
}

export interface SupplierOrderStatusResult {
  supplierOrderId: string;
  status: SupplierOrderStatus;
  isDelivered: boolean;
  isFailed: boolean;
  supplierCost?: number;
  rawResponse?: any;
  errorMessage?: string;
}

export interface SupplierBalance {
  supplier: SupplierCode;
  balance: number;
  currency: string;
  accountName?: string;
  isHealthy: boolean;
  lastChecked: Date;
  errorMessage?: string;
}

export interface SupplierProductItem {
  supplierCode: SupplierCode;
  gameCode: string;
  productCode: string;
  productName: string;
  cost: number;
  currency: string;
  isAvailable: boolean;
  category?: string;
}
