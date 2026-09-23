import {
  PlayerCheckInput,
  PlayerCheckResult,
  SupplierBalance,
  SupplierCode,
  SupplierOrderInput,
  SupplierOrderResult,
  SupplierOrderStatusResult,
  SupplierProductItem,
} from "@topup/shared";

export interface ISupplierAdapter {
  code: SupplierCode;
  name: string;

  /**
   * Retrieves reseller account profile and available balance.
   */
  getBalance(): Promise<SupplierBalance>;

  /**
   * Checks player ID / Zone ID validity before placing an order.
   */
  checkPlayer(input: PlayerCheckInput): Promise<PlayerCheckResult>;

  /**
   * Submits a top-up order to the supplier with idempotency reference.
   */
  createOrder(input: SupplierOrderInput): Promise<SupplierOrderResult>;

  /**
   * Queries real-time order delivery status from the supplier.
   */
  getOrderStatus(
    supplierOrderId: string,
    referenceId?: string,
    gameCode?: string
  ): Promise<SupplierOrderStatusResult>;

  /**
   * Syncs active products and real-time costs from supplier.
   */
  syncCatalog(): Promise<SupplierProductItem[]>;
}
