import { OrderStatus } from "@topup/shared";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { prisma, safeDbQuery } from "../lib/prisma";

export type TelegramAlertTopic = "paid" | "completed" | "system" | "lowBalanceG2b" | "lowBalanceVizo";

export function getTelegramAlertTopic(status: OrderStatus): TelegramAlertTopic | null {
  if (status === OrderStatus.PAID) return "paid";
  if (status === OrderStatus.DELIVERED) return "completed";
  if (status === OrderStatus.FAILED || status === OrderStatus.REVIEW_REQUIRED) return "system";
  return null;
}

export function escapeTelegramHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function formatCambodiaTime(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Phnom_Penh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")} (Cambodia)`;
}

function threadIdFor(topic: TelegramAlertTopic): number {
  if (topic === "paid") return config.telegram.paidThreadId;
  if (topic === "completed") return config.telegram.completedThreadId;
  if (topic === "lowBalanceG2b") return config.telegram.lowBalanceG2bThreadId;
  if (topic === "lowBalanceVizo") return config.telegram.lowBalanceVizoThreadId;
  return config.telegram.systemThreadId;
}

function statusFor(status: OrderStatus): { icon: string; label: string } {
  if (status === OrderStatus.PAID) return { icon: "🟢", label: "PAID" };
  if (status === OrderStatus.DELIVERED) return { icon: "✅", label: "DELIVERED" };
  if (status === OrderStatus.REVIEW_REQUIRED) return { icon: "⚠️", label: "REVIEW REQUIRED" };
  if (status === OrderStatus.FAILED) return { icon: "❌", label: "FAILED" };
  return { icon: "ℹ️", label: status.replaceAll("_", " ") };
}

export interface TelegramReceiptDetails {
  publicOrderId: string;
  status: OrderStatus;
  gameName?: string | null;
  productName?: string | null;
  playerId?: string | null;
  serverId?: string | null;
  playerName?: string | null;
  total?: number | null;
  currency?: string | null;
  paymentProvider?: string | null;
  paymentReference?: string | null;
  supplier?: string | null;
  supplierOrderId?: string | null;
  reason?: string | null;
  time?: Date;
}

export function formatTelegramReceipt(details: TelegramReceiptDetails): string {
  const status = statusFor(details.status);
  const currency = String(details.currency || "USD").toUpperCase();
  const lines = [
    "🧾 <b>NA TOPUP RECEIPT</b>",
    "━━━━━━━━━━━━━━━━",
    `<b>Status:</b> ${status.icon} <b>${escapeTelegramHtml(status.label)}</b>`,
    `<b>Order ID:</b> <code>${escapeTelegramHtml(details.publicOrderId)}</code>`,
  ];

  if (details.gameName) lines.push(`<b>Game:</b> ${escapeTelegramHtml(details.gameName)}`);
  if (details.productName) lines.push(`<b>Package:</b> ${escapeTelegramHtml(details.productName)}`);
  if (details.playerId) {
    const server = details.serverId ? ` / ${escapeTelegramHtml(details.serverId)}` : "";
    lines.push(`<b>Player ID:</b> <code>${escapeTelegramHtml(details.playerId)}${server}</code>`);
  }
  if (details.playerName) lines.push(`<b>Player Name:</b> ${escapeTelegramHtml(details.playerName)}`);
  if (typeof details.total === "number") {
    const amount = `${currency === "USD" ? "$" : ""}${details.total.toFixed(2)} ${currency}`;
    lines.push(`<b>Amount:</b> <b>${escapeTelegramHtml(amount)}</b>`);
  }
  if (details.paymentProvider) {
    const reference = details.paymentReference
      ? ` · <code>${escapeTelegramHtml(details.paymentReference)}</code>`
      : "";
    lines.push(`<b>Payment:</b> ${escapeTelegramHtml(details.paymentProvider)}${reference}`);
  }
  if (details.supplier) {
    const supplierOrder = details.supplierOrderId
      ? ` · <code>${escapeTelegramHtml(details.supplierOrderId)}</code>`
      : "";
    lines.push(`<b>Supplier:</b> ${escapeTelegramHtml(details.supplier)}${supplierOrder}`);
  }
  if (
    (details.status === OrderStatus.FAILED || details.status === OrderStatus.REVIEW_REQUIRED) &&
    details.reason
  ) {
    lines.push(`<b>Reason:</b> ${escapeTelegramHtml(details.reason)}`);
  }

  lines.push("━━━━━━━━━━━━━━━━");
  lines.push(`<b>Time:</b> ${escapeTelegramHtml(formatCambodiaTime(details.time))}`);
  return lines.join("\n");
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

class TelegramAlertService {
  private lowBalanceAlertAt = new Map<string, number>();

  private async normalizeLegacyOutboxEvents(): Promise<void> {
    // OrderEvent records created before the Telegram outbox fields were added
    // have missing MongoDB keys rather than explicit null/default values.
    // Prisma's `isSet` filter is not accepted by updateMany in production, so
    // backfill only missing keys and keep the normal claim query portable.
    await prisma.$runCommandRaw({
      update: "OrderEvent",
      updates: [
        {
          q: { telegramSentAt: { $exists: false } },
          u: { $set: { telegramSentAt: null } },
          multi: true,
        },
        {
          q: { telegramAttemptCount: { $exists: false } },
          u: { $set: { telegramAttemptCount: 0 } },
          multi: true,
        },
        {
          q: { telegramLastError: { $exists: false } },
          u: { $set: { telegramLastError: null } },
          multi: true,
        },
        {
          q: { telegramLastAttemptAt: { $exists: false } },
          u: { $set: { telegramLastAttemptAt: null } },
          multi: true,
        },
      ],
    });
  }

  private isConfigured(topic: TelegramAlertTopic): boolean {
    return Boolean(
      config.telegram.botToken &&
        config.telegram.adminChatId &&
        Number.isInteger(threadIdFor(topic)) &&
        threadIdFor(topic) > 0
    );
  }

  private async send(topic: TelegramAlertTopic, text: string, maxAttempts = 3): Promise<boolean> {
    if (!this.isConfigured(topic)) return false;

    const endpoint = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
    let lastError = "Unknown Telegram error";

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: config.telegram.adminChatId,
            message_thread_id: threadIdFor(topic),
            text,
            parse_mode: "HTML",
            link_preview_options: { is_disabled: true },
          }),
          signal: AbortSignal.timeout(4000),
        });

        const result = (await response.json().catch(() => null)) as
          | { ok?: boolean; description?: string }
          | null;
        if (response.ok && result?.ok) return true;

        lastError = result?.description || `Telegram HTTP ${response.status}`;
        if (response.status < 500 && response.status !== 429) break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      if (attempt < maxAttempts) await wait(attempt * 300);
    }

    logger.error("Telegram alert delivery failed", {
      provider: "TELEGRAM",
      error: lastError,
      metadata: { topic },
    });
    return false;
  }

  async notifyOrderStatus(
    orderId: string,
    publicOrderId: string,
    status: OrderStatus,
    reason: string,
    maxAttempts = 3
  ): Promise<boolean> {
    const topic = getTelegramAlertTopic(status);
    if (!topic) return false;
    if (!this.isConfigured(topic)) {
      logger.warn("Telegram order alert is not configured", {
        provider: "TELEGRAM",
        orderId: publicOrderId,
        status,
        metadata: { topic },
      });
      return false;
    }

    const order = String(orderId).startsWith("mem_")
      ? null
      : await safeDbQuery(
          () =>
            prisma.order.findUnique({
              where: { id: orderId },
              select: {
                publicOrderId: true,
                playerId: true,
                serverId: true,
                playerName: true,
                total: true,
                currency: true,
                game: { select: { name: true } },
                product: { select: { name: true } },
                payment: {
                  select: { provider: true, providerTransactionId: true, providerReference: true },
                },
                fulfilment: {
                  select: { supplier: true, supplierOrderId: true, lastError: true },
                },
              },
            }),
          null,
          1500
        );

    const receipt = formatTelegramReceipt({
      publicOrderId: order?.publicOrderId || publicOrderId,
      status,
      gameName: order?.game?.name,
      productName: order?.product?.name,
      playerId: order?.playerId,
      serverId: order?.serverId,
      playerName: order?.playerName,
      total: order?.total,
      currency: order?.currency,
      paymentProvider: order?.payment?.provider,
      paymentReference:
        order?.payment?.providerTransactionId || order?.payment?.providerReference,
      supplier: order?.fulfilment?.supplier,
      supplierOrderId: order?.fulfilment?.supplierOrderId,
      reason:
        status === OrderStatus.FAILED || status === OrderStatus.REVIEW_REQUIRED
          ? order?.fulfilment?.lastError || reason || "Unknown error"
          : undefined,
    });

    const sent = await this.send(topic, receipt, maxAttempts);
    if (sent) {
      logger.info("Telegram order alert delivered", {
        provider: "TELEGRAM",
        orderId: order?.publicOrderId || publicOrderId,
        status,
        metadata: { topic },
      });
    }
    return sent;
  }

  async deliverOrderEvent(eventId: string): Promise<boolean> {
    const eventDelegate = prisma.orderEvent as any;
    const event = await eventDelegate.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        orderId: true,
        toStatus: true,
        reason: true,
        telegramSentAt: true,
        telegramAttemptCount: true,
        order: { select: { publicOrderId: true } },
      },
    });
    if (!event || event.telegramSentAt) return Boolean(event?.telegramSentAt);

    const status = event.toStatus as OrderStatus;
    if (!getTelegramAlertTopic(status)) return true;

    const attemptCount = Number(event.telegramAttemptCount || 0);
    const staleClaimBefore = new Date(Date.now() - 2 * 60 * 1000);
    const claimed = await eventDelegate.updateMany({
      where: {
        id: event.id,
        AND: [
          { telegramSentAt: null },
          { telegramAttemptCount: attemptCount },
          {
            OR: [
              { telegramLastAttemptAt: null },
              { telegramLastAttemptAt: { lt: staleClaimBefore } },
            ],
          },
        ],
      },
      data: {
        telegramAttemptCount: { increment: 1 },
        telegramLastAttemptAt: new Date(),
      },
    });
    if (claimed.count !== 1) return false;

    let sent = false;
    let lastError: string | null = null;
    try {
      sent = await this.notifyOrderStatus(
        event.orderId,
        event.order.publicOrderId,
        status,
        event.reason,
        1
      );
      if (!sent) lastError = "Telegram delivery was not acknowledged";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await eventDelegate.update({
      where: { id: event.id },
      data: sent
        ? { telegramSentAt: new Date(), telegramLastError: null }
        : { telegramLastError: lastError || "Telegram delivery failed" },
    });
    return sent;
  }

  async retryPendingOrderAlerts(limit = 10): Promise<{ checked: number; sent: number }> {
    await this.normalizeLegacyOutboxEvents();
    const eventDelegate = prisma.orderEvent as any;
    const retryBefore = new Date(Date.now() - 2 * 60 * 1000);
    const events = await eventDelegate.findMany({
      where: {
        toStatus: {
          in: [OrderStatus.PAID, OrderStatus.DELIVERED, OrderStatus.FAILED, OrderStatus.REVIEW_REQUIRED],
        },
        AND: [
          { telegramSentAt: null },
          {
            OR: [
              { telegramLastAttemptAt: null },
              { telegramLastAttemptAt: { lt: retryBefore } },
            ],
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true },
    });

    let sent = 0;
    for (const event of events) {
      if (await this.deliverOrderEvent(event.id)) sent += 1;
    }
    return { checked: events.length, sent };
  }

  async notifyLowBalance(
    supplier: "G2BULK" | "VIZO",
    balance: number,
    currency = "USD",
    threshold = config.telegram.lowBalanceThresholdUsd
  ) {
    const topic: TelegramAlertTopic = supplier === "G2BULK" ? "lowBalanceG2b" : "lowBalanceVizo";
    if (!this.isConfigured(topic)) return false;
    const now = Date.now();
    const lastAlert = this.lowBalanceAlertAt.get(supplier) || 0;
    if (now - lastAlert < 30 * 60 * 1000) return false;
    const lines = [
      `<b>Low Balance ${supplier === "G2BULK" ? "G2B" : "Vizo"}</b>`,
      `<b>Supplier:</b> ${escapeTelegramHtml(supplier)}`,
      `<b>Balance:</b> ${escapeTelegramHtml(balance.toFixed(2))} ${escapeTelegramHtml(currency)}`,
      `<b>Threshold:</b> $${escapeTelegramHtml(threshold.toFixed(2))} USD`,
      `<b>Time:</b> ${escapeTelegramHtml(formatCambodiaTime())}`,
    ];
    const sent = await this.send(topic, lines.join("\n"));
    if (sent) this.lowBalanceAlertAt.set(supplier, now);
    return sent;
  }
}

export const telegramAlertService = new TelegramAlertService();
