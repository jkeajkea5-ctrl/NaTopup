import { canTransitionOrder, OrderStatus, roundCurrency, SupplierCode } from "@topup/shared";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { prisma, safeDbQuery } from "../lib/prisma";
import { FALLBACK_GAMES } from "../lib/fallbackData";
import { generateLookupToken, generatePublicOrderId } from "../lib/security";
import { verifyOrderLookupToken } from "../lib/requestSecurity";
import { supplierManager } from "../suppliers/supplierManager";
import { telegramAlertService } from "./TelegramAlertService";

export const inMemoryOrders: Map<string, any> =
  (global as any).__inMemoryOrders || ((global as any).__inMemoryOrders = new Map<string, any>());

const MONGO_OBJECT_ID = /^[a-f\d]{24}$/i;
const ACTIVE_CHECKOUT_WINDOW_MS = 15 * 60_000;
const ACTIVE_CHECKOUT_STATUSES = [OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_VERIFYING];

export class OrderService {
  /**
   * Creates a new customer order with immutable price snapshot.
   */
  async createOrder(input: {
    gameSlug: string;
    productId: string;
    playerData: Record<string, string>;
    playerName?: string;
    currency?: string;
    clientIp?: string;
    customerEmail?: string;
    customerPhone?: string;
    checkoutRequestId?: string;
    checkoutRequestHash?: string;
    activeCheckoutKey?: string;
  }) {
    const existingOrder = input.checkoutRequestId
      ? await prisma.order.findUnique({ where: { checkoutRequestId: input.checkoutRequestId } }).catch(() => null)
      : null;
    if (existingOrder) {
      if (existingOrder.checkoutRequestHash !== input.checkoutRequestHash) {
        throw new Error("This checkout request key was already used for different order details.");
      }
      return existingOrder;
    }

    if (input.activeCheckoutKey) {
      const existingActive = await prisma.order.findUnique({
        where: { activeCheckoutKey: input.activeCheckoutKey },
      }).catch(() => null);
      if (existingActive) {
        const isReusable =
          ACTIVE_CHECKOUT_STATUSES.includes(existingActive.status as OrderStatus) &&
          existingActive.createdAt.getTime() >= Date.now() - ACTIVE_CHECKOUT_WINDOW_MS;
        if (isReusable) {
          if (input.checkoutRequestId && existingActive.checkoutRequestId === input.checkoutRequestId) {
            return existingActive;
          }
          throw new Error("An unpaid checkout already exists for this player and package. Please use the original checkout or wait for it to expire.");
        }

        // Release an expired or completed checkout lock before allowing a new
        // purchase for the same player and product.
        await prisma.order.updateMany({
          where: { id: existingActive.id, activeCheckoutKey: input.activeCheckoutKey },
          data: { activeCheckoutKey: null },
        });
      }
    }

    // 1. Fetch the product. Live G2Bulk catalogue IDs (for example,
    // "g2b_1942") are not Mongo ObjectIds, so never send them to Prisma's
    // id lookup.
    let product: any = null;
    if (MONGO_OBJECT_ID.test(input.productId)) {
      product = await safeDbQuery(
        () =>
          prisma.product.findUnique({
            where: { id: input.productId },
            include: { game: true, price: true },
          }),
        null,
        5000
      );
    }

    if (!product && !["mobile-legends", "mobile-legends-philippines", "mobile-legends-indonesia", "mlbb", "free-fire", "free-fire-khsgmy", "free-fire-kh", "pubg-mobile", "honor-of-kings", "hok", "valorant", "zepeto", "delta-force", "blood-strike", "magic-chess-gogo", "crossfire-legend"].includes(input.gameSlug)) {
      const fallbackGame = FALLBACK_GAMES.find((g) => g.slug === input.gameSlug);
      const fallbackProd = fallbackGame?.products.find((p: any) => p.id === input.productId || p.sku === input.productId);
      if (fallbackProd) {
        // Persist the trusted server catalogue entry first. The client only
        // supplies an ID; all name and price values come from fallbackData.
        product = await safeDbQuery(async () => {
          const game = await prisma.game.findUnique({ where: { slug: fallbackGame!.slug } });
          if (!game) return null;

          const persistedProduct = await prisma.product.upsert({
            where: { sku: fallbackProd.sku },
            update: {
              gameId: game.id,
              name: fallbackProd.name,
              amount: fallbackProd.amount,
              isPopular: !!fallbackProd.isPopular,
              isFeatured: !!fallbackProd.isFeatured,
              isActive: true,
            },
            create: {
              gameId: game.id,
              sku: fallbackProd.sku,
              name: fallbackProd.name,
              amount: fallbackProd.amount,
              isPopular: !!fallbackProd.isPopular,
              isFeatured: !!fallbackProd.isFeatured,
              isActive: true,
            },
          });

          const sellingPrice = fallbackProd.priceUsd;
          const supplierCost = (fallbackProd as any).supplierCost ?? sellingPrice * 0.9;
          const price = await prisma.productPrice.upsert({
            where: { productId: persistedProduct.id },
            update: {
              supplierCost,
              sellingPrice,
              discount: fallbackProd.discountUsd || 0,
            },
            create: {
              productId: persistedProduct.id,
              supplierCost,
              sellingPrice,
              discount: fallbackProd.discountUsd || 0,
            },
          });

          // Live G2Bulk products must also have a supplier mapping or a paid
          // order would be moved to manual review instead of being delivered.
          const supplier = await prisma.supplier.findUnique({
            where: { code: SupplierCode.G2BULK },
          });
          if (supplier) {
            const supplierProductCode = String((fallbackProd as any).catalogueName || fallbackProd.amount);
            const supplierProduct = await prisma.supplierProduct.upsert({
              where: {
                supplierId_supplierProductCode: {
                  supplierId: supplier.id,
                  supplierProductCode,
                },
              },
              update: {
                supplierGameCode: "mlbb",
                supplierProductName: fallbackProd.name,
                currentCost: supplierCost,
                isAvailable: true,
              },
              create: {
                supplierId: supplier.id,
                supplierGameCode: "mlbb",
                supplierProductCode,
                supplierProductName: fallbackProd.name,
                currentCost: supplierCost,
                currency: "USD",
                isAvailable: true,
              },
            });

            await prisma.supplierMapping.upsert({
              where: {
                productId_supplierId: {
                  productId: persistedProduct.id,
                  supplierId: supplier.id,
                },
              },
              update: {
                supplierProductId: supplierProduct.id,
                isEnabled: true,
                priority: 1,
              },
              create: {
                productId: persistedProduct.id,
                supplierId: supplier.id,
                supplierProductId: supplierProduct.id,
                isEnabled: true,
                priority: 1,
              },
            });
          }

          return { ...persistedProduct, game, price };
        }, null, 5000);
      }
    }

    const isCatalogGame = ["mobile-legends", "mobile-legends-philippines", "mobile-legends-indonesia", "mlbb", "free-fire", "free-fire-khsgmy", "free-fire-kh", "pubg-mobile", "honor-of-kings", "hok", "valorant", "zepeto", "delta-force", "blood-strike", "magic-chess-gogo", "crossfire-legend"].includes(input.gameSlug);
    const normalizedGameSlug = input.gameSlug === "mlbb" ? "mobile-legends" : input.gameSlug === "free-fire-khsgmy" ? "free-fire" : input.gameSlug === "hok" ? "honor-of-kings" : input.gameSlug;
    if (!product || !product.isActive || (isCatalogGame && (!product.game?.isActive || product.game.slug !== normalizedGameSlug))) {
      throw new Error("Invalid game or product package selected.");
    }

    if (!product.price) {
      throw new Error("Product pricing is not configured.");
    }

    // 2. Extract primary player IDs
    const playerId =
      input.playerData.userId ||
      input.playerData.playerId ||
      input.playerData.characterId ||
      input.playerData.uid ||
      input.playerData.riotId ||
      "";

    const serverId =
      input.playerData.zoneId ||
      input.playerData.serverId ||
      input.playerData.tagline ||
      null;

    if (!playerId) {
      throw new Error("Required player identifier is missing.");
    }

    const verification = await supplierManager.requireVerifiedPlayer(product.game.slug, input.playerData);

    // 3. Snapshot prices (immune to future changes)
    const sellingPrice = product.price.sellingPrice;
    const discount = product.price.discount;
    const totalUsd = roundCurrency(Math.max(0.01, sellingPrice - discount));
    const totalKhr = Math.ceil((totalUsd * config.business.usdToKhrRate) / 100) * 100;
    const supplierCost = product.price.supplierCost;

    const publicOrderId = generatePublicOrderId();
    const publicLookupToken = generateLookupToken();

    // 4. Create a durable order before accepting payment. Atlas may need more
    // than one second for a cold connection, so a short timeout must not turn
    // a real customer order into temporary server memory.
    let order: any = null;
    try {
      order = await prisma.order.create({
          data: {
            publicOrderId,
            publicLookupToken,
            checkoutRequestId: input.checkoutRequestId,
            checkoutRequestHash: input.checkoutRequestHash,
            activeCheckoutKey: input.activeCheckoutKey,
            status: OrderStatus.AWAITING_PAYMENT,
            gameId: product.gameId,
            productId: product.id,
            playerData: JSON.stringify(input.playerData),
            playerId,
            serverId,
            playerName: verification.playerName || null,
            currency: input.currency || "USD",
            subtotal: sellingPrice,
            discount,
            total: totalUsd,
            totalKhr,
            supplierCostSnapshot: supplierCost,
            sellingPriceSnapshot: sellingPrice,
            clientIp: input.clientIp,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone,
            events: {
              create: {
                fromStatus: "NONE",
                toStatus: OrderStatus.AWAITING_PAYMENT,
                reason: "Order created by customer",
              },
            },
          },
          include: {
            game: true,
            product: true,
          },
      });
    } catch (error: any) {
      // A unique-key race is expected when a browser retries the exact same
      // checkout. Do not trip the shared database circuit breaker for it.
      if (error?.code !== "P2002" || (!input.checkoutRequestId && !input.activeCheckoutKey)) throw error;
    }

    if (!order) {
      // A concurrent request with the same idempotency key may have won the
      // unique insert. Return that exact order instead of creating a duplicate.
      let concurrentOrder = input.checkoutRequestId
        ? await prisma.order.findUnique({ where: { checkoutRequestId: input.checkoutRequestId } }).catch(() => null)
        : null;
      if (!concurrentOrder && input.activeCheckoutKey) {
        concurrentOrder = await prisma.order.findUnique({
          where: { activeCheckoutKey: input.activeCheckoutKey },
        }).catch(() => null);
      }
      if (concurrentOrder) {
        const sameActiveCheckout = Boolean(
          input.activeCheckoutKey && concurrentOrder.activeCheckoutKey === input.activeCheckoutKey
        );
        if (sameActiveCheckout && concurrentOrder.checkoutRequestId !== input.checkoutRequestId) {
          throw new Error("An unpaid checkout already exists for this player and package. Please use the original checkout or wait for it to expire.");
        }
        if (!sameActiveCheckout && concurrentOrder.checkoutRequestHash !== input.checkoutRequestHash) {
          throw new Error("This checkout request key was already used for different order details.");
        }
        return concurrentOrder;
      }
      throw new Error("Order database is unavailable. Please try again shortly.");
    }


    logger.info("Order created successfully", {
      orderId: order.publicOrderId,
      status: order.status,
      metadata: { totalUsd, totalKhr, game: product.game.name },
    });

    return order;
  }

  /**
   * Retrieves order by publicOrderId, sanitizing internal costs and secrets.
   */
  async getPublicOrder(publicOrderId: string, lookupToken: string) {
    let order: any = await safeDbQuery(
      () =>
        prisma.order.findUnique({
          where: { publicOrderId },
          include: {
            game: {
              select: {
                name: true,
                slug: true,
                logoUrl: true,
                instructions: true,
                deliveryTime: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                amount: true,
              },
            },
            payment: {
              select: {
                id: true,
                status: true,
                amount: true,
                amountKhr: true,
                qrPayload: true,
                qrExpiresAt: true,
                paidAt: true,
              },
            },
          },
        }),
      null,
      1000
    );

    if (!order) {
      order = inMemoryOrders.get(publicOrderId);
    }

    if (!order) return null;
    if (!verifyOrderLookupToken(lookupToken, order.publicLookupToken || "")) return null;

    return {
      publicOrderId: order.publicOrderId,
      status: order.status,
      game: order.game,
      product: order.product,
      playerData: JSON.parse(order.playerData || "{}"),
      playerId: order.playerId,
      serverId: order.serverId,
      playerName: order.playerName,
      currency: order.currency,
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      totalKhr: order.totalKhr,
      payment: order.payment,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
      completedAt: order.completedAt,
    };
  }

  /**
   * Transitions order status adhering strictly to the state machine.
   */
  async transitionStatus(orderId: string, toStatus: OrderStatus, reason: string, metadata?: any) {
    let order: any = null;
    if (!String(orderId).startsWith("mem_")) {
      order = await safeDbQuery(
        () =>
          prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true, publicOrderId: true, status: true },
          }),
        null,
        1000
      );
    }

    if (!order) {
      order = inMemoryOrders.get(orderId);
      if (!order) {
        for (const o of inMemoryOrders.values()) {
          if (o.id === orderId || o.publicOrderId === orderId) {
            order = o;
            break;
          }
        }
      }
    }

    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    const currentStatus = order.status as OrderStatus;
    // The payment webhook, reconciliation cron, and browser polling can all
    // observe the same provider confirmation. A repeated state is not a new
    // transition and must not create another Telegram outbox event.
    if (currentStatus === toStatus) {
      logger.info("Duplicate order status transition ignored", {
        orderId: order.publicOrderId,
        status: toStatus,
      });
      return order;
    }

    if (!canTransitionOrder(currentStatus, toStatus)) {
      const errorMsg = `Illegal order transition from ${currentStatus} to ${toStatus} on order ${order.publicOrderId}`;
      logger.error(errorMsg, { orderId: order.publicOrderId });
      throw new Error(errorMsg);
    }

    const updateData: any = {
      status: toStatus,
    };

    if (!ACTIVE_CHECKOUT_STATUSES.includes(toStatus)) {
      updateData.activeCheckoutKey = null;
    }

    if (toStatus === OrderStatus.PAID) {
      updateData.paidAt = new Date();
    } else if (toStatus === OrderStatus.DELIVERED) {
      updateData.completedAt = new Date();
    } else if (toStatus === OrderStatus.FAILED) {
      updateData.failedAt = new Date();
    } else if (toStatus === OrderStatus.EXPIRED) {
      updateData.expiredAt = new Date();
    }

    let updated: any = null;
    if (!String(order.id).startsWith("mem_")) {
      updated = await safeDbQuery(
        () =>
          prisma.order.update({
            where: { id: order.id },
            data: {
              ...updateData,
              events: {
                create: {
                  fromStatus: currentStatus,
                  toStatus,
                  reason,
                  metadata: metadata ? JSON.stringify(metadata) : null,
                  telegramSentAt: null,
                  telegramAttemptCount: 0,
                  telegramLastError: null,
                  telegramLastAttemptAt: null,
                },
              },
            },
            include: {
              events: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
            },
          }),
        null,
        1200
      );
    }

    // Always keep in-memory cache synchronized
    order.status = toStatus;
    if (updateData.paidAt) order.paidAt = updateData.paidAt;
    if (updateData.completedAt) order.completedAt = updateData.completedAt;
    if (updateData.failedAt) order.failedAt = updateData.failedAt;
    if (updateData.expiredAt) order.expiredAt = updateData.expiredAt;
    inMemoryOrders.set(order.publicOrderId, order);
    inMemoryOrders.set(order.id, order);

    logger.info("Order status transitioned", {
      orderId: order.publicOrderId,
      status: toStatus,
      metadata: { from: currentStatus, reason },
    });

    // The order event is a durable Telegram outbox. Delivery is attempted now
    // and retried by the reconciliation cron if Telegram is temporarily down.
    try {
      const eventId = updated?.events?.[0]?.id;
      if (eventId) {
        await telegramAlertService.deliverOrderEvent(eventId);
      } else {
        await telegramAlertService.notifyOrderStatus(order.id, order.publicOrderId, toStatus, reason);
      }
    } catch (error) {
      logger.error("Telegram order alert failed", {
        orderId: order.publicOrderId,
        status: toStatus,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return updated || order;
  }
}

export const orderService = new OrderService();
