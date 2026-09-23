export enum OrderStatus {
  CREATED = "CREATED",
  AWAITING_PAYMENT = "AWAITING_PAYMENT",
  PAYMENT_VERIFYING = "PAYMENT_VERIFYING",
  PAID = "PAID",
  FULFILMENT_QUEUED = "FULFILMENT_QUEUED",
  PROCESSING = "PROCESSING",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  REVIEW_REQUIRED = "REVIEW_REQUIRED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  VERIFYING = "VERIFYING",
  PAID = "PAID",
  EXPIRED = "EXPIRED",
  FAILED = "FAILED",
}

export enum FulfilmentStatus {
  PENDING = "PENDING",
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED",
  REVIEW_REQUIRED = "REVIEW_REQUIRED",
}

export enum SupplierOrderStatus {
  PENDING = "PENDING",
  SUBMITTED = "SUBMITTED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  UNKNOWN = "UNKNOWN",
}

export enum SupplierCode {
  G2BULK = "G2BULK",
  VIZO = "VIZO",
}

export enum PricingStrategy {
  FIXED_MARKUP = "FIXED_MARKUP",
  PERCENTAGE_MARKUP = "PERCENTAGE_MARKUP",
  MANUAL = "MANUAL",
  MINIMUM_MARGIN = "MINIMUM_MARGIN",
}

export enum Currency {
  USD = "USD",
  KHR = "KHR",
}

/**
 * Valid state transitions for Orders to ensure strict state machine correctness.
 */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED],
  [OrderStatus.AWAITING_PAYMENT]: [
    OrderStatus.PAYMENT_VERIFYING,
    OrderStatus.PAID,
    OrderStatus.EXPIRED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_VERIFYING]: [
    OrderStatus.PAID,
    OrderStatus.AWAITING_PAYMENT,
    OrderStatus.FAILED,
    OrderStatus.EXPIRED,
  ],
  [OrderStatus.PAID]: [
    OrderStatus.FULFILMENT_QUEUED,
    OrderStatus.PROCESSING,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.FULFILMENT_QUEUED]: [
    OrderStatus.PROCESSING,
    OrderStatus.REVIEW_REQUIRED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.PROCESSING]: [
    OrderStatus.DELIVERED,
    OrderStatus.FAILED,
    OrderStatus.REVIEW_REQUIRED,
  ],
  [OrderStatus.REVIEW_REQUIRED]: [
    OrderStatus.PROCESSING,
    OrderStatus.DELIVERED,
    OrderStatus.FAILED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.FAILED]: [OrderStatus.REFUNDED, OrderStatus.FULFILMENT_QUEUED],
  // A provider webhook or reconciliation check can confirm a payment after
  // the local checkout timer expires. Paid funds must still be fulfilled.
  [OrderStatus.EXPIRED]: [OrderStatus.PAID],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_ORDER_TRANSITIONS[from] || [];
  return allowed.includes(to);
}
