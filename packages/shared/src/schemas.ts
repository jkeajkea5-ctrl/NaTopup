import { z } from "zod";
import { Currency, OrderStatus, PaymentStatus, PricingStrategy, SupplierCode } from "./enums";

export const PlayerCheckRequestSchema = z.object({
  gameSlug: z.string().min(1),
  fields: z.record(z.string().min(1)),
});

export type PlayerCheckRequest = z.infer<typeof PlayerCheckRequestSchema>;

export const PlayerCheckResponseSchema = z.object({
  valid: z.boolean(),
  playerName: z.string().optional(),
  message: z.string().optional(),
  extraData: z.record(z.any()).optional(),
});

export type PlayerCheckResponse = z.infer<typeof PlayerCheckResponseSchema>;

export const CreateOrderRequestSchema = z.object({
  gameSlug: z.string().min(1),
  productId: z.string().min(1),
  playerData: z.record(z.string().min(1)),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  clientIp: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
});

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

export const OrderPublicResponseSchema = z.object({
  publicOrderId: z.string(),
  status: z.nativeEnum(OrderStatus),
  game: z.object({
    name: z.string(),
    slug: z.string(),
    logo: z.string(),
  }),
  product: z.object({
    id: z.string(),
    name: z.string(),
    amount: z.string(),
  }),
  playerData: z.record(z.string()),
  playerName: z.string().nullable().optional(),
  currency: z.string(),
  subtotal: z.number(),
  discount: z.number(),
  total: z.number(),
  totalKhr: z.number(),
  lookupToken: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  paidAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
});

export type OrderPublicResponse = z.infer<typeof OrderPublicResponseSchema>;

export const CreatePaymentRequestSchema = z.object({
  publicOrderId: z.string().min(1),
  lookupToken: z.string().optional(),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequestSchema>;

export const KhqrPaymentResponseSchema = z.object({
  paymentId: z.string(),
  orderId: z.string(),
  publicOrderId: z.string(),
  qrString: z.string(),
  md5: z.string(),
  amount: z.number(),
  currency: z.string(),
  amountKhr: z.number(),
  expiresAt: z.string(),
  remainingSeconds: z.number(),
  status: z.nativeEnum(PaymentStatus),
});

export type KhqrPaymentResponse = z.infer<typeof KhqrPaymentResponseSchema>;

export const KhqrWebhookPayloadSchema = z.object({
  merchantId: z.string().optional(),
  terminalId: z.string().optional(),
  orderReference: z.string().min(1),
  transactionId: z.string().min(1),
  amount: z.union([z.number(), z.string().transform((v) => parseFloat(v))]),
  currency: z.string().default("USD"),
  md5: z.string().optional(),
  status: z.string(),
  timestamp: z.union([z.number(), z.string()]).optional(),
  signature: z.string().optional(),
});

export type KhqrWebhookPayload = z.infer<typeof KhqrWebhookPayloadSchema>;

export const SupplierWebhookPayloadSchema = z.object({
  supplier: z.nativeEnum(SupplierCode),
  supplierOrderId: z.string().min(1),
  refOrder: z.string().min(1),
  status: z.string(),
  price: z.number().optional(),
  note: z.string().optional(),
  rawPayload: z.any().optional(),
});

export type SupplierWebhookPayload = z.infer<typeof SupplierWebhookPayloadSchema>;

export const AdminPriceUpdateSchema = z.object({
  productId: z.string().min(1),
  strategy: z.nativeEnum(PricingStrategy),
  markupValue: z.number().min(0),
  fixedSellingPrice: z.number().min(0).optional(),
  discount: z.number().min(0).default(0),
});

export type AdminPriceUpdate = z.infer<typeof AdminPriceUpdateSchema>;
