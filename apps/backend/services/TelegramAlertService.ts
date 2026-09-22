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

function threadIdFor(topic: TelegramAlertTopic): number {
  if (topic === "paid") return config.telegram.paidThreadId;
  if (topic === "completed") return config.telegram.completedThreadId;
  if (topic === "lowBalanceG2b") return config.telegram.lowBalanceG2bThreadId;
  if (topic === "lowBalanceVizo") return config.telegram.lowBalanceVizoThreadId;
  return config.telegram.systemThreadId;
}

function headingFor(topic: TelegramAlertTopic): string {
  if (topic === "paid") return "⚡ <b>Paid</b>";
  if (topic === "completed") return "💎 <b>Delivered</b>";
  return "‼️ <b>Order Error</b>";
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

class TelegramAlertService {
  private lowBalanceAlertAt = new Map<string, number>();
  private isConfigured(topic: TelegramAlertTopic): boolean {
    return Boolean(
      config.telegram.botToken &&
        config.telegram.adminChatId &&
        Number.isInteger(threadIdFor(topic)) &&
        threadIdFor(topic) > 0
    );
  }

  private async send(topic: TelegramAlertTopic, text: string): Promise<boolean> {
    if (!this.isConfigured(topic)) return false;

    const endpoint = `https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`;
    let lastError = "Unknown Telegram error";

    for (let attempt = 1; attempt <= 3; attempt += 1) {
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
          signal: AbortSignal.timeout(7000),
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

      if (attempt < 3) await wait(attempt * 300);
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
    reason: string
  ): Promise<boolean> {
    const topic = getTelegramAlertTopic(status);
    if (!topic || !this.isConfigured(topic)) return false;

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
                game: { select: { name: true } },
                product: { select: { name: true } },
                fulfilment: {
                  select: { supplier: true, supplierOrderId: true, lastError: true },
                },
              },
            }),
          null,
          1500
        );

    const lines = [
      headingFor(topic),
      `<b>Order:</b> <code>${escapeTelegramHtml(order?.publicOrderId || publicOrderId)}</code>`,
    ];

    if (order?.game?.name) lines.push(`<b>Game:</b> ${escapeTelegramHtml(order.game.name)}`);
    if (order?.product?.name) lines.push(`<b>Package:</b> ${escapeTelegramHtml(order.product.name)}`);
    if (order?.playerId) {
      const server = order.serverId ? ` (${escapeTelegramHtml(order.serverId)})` : "";
      lines.push(`<b>Player:</b> <code>${escapeTelegramHtml(order.playerId)}</code>${server}`);
    }
    if (order?.playerName) lines.push(`<b>Name:</b> ${escapeTelegramHtml(order.playerName)}`);
    if (typeof order?.total === "number") {
      lines.push(`<b>Amount:</b> $${order.total.toFixed(2)} USD`);
    }
    if (order?.fulfilment?.supplier) {
      const supplierOrder = order.fulfilment.supplierOrderId
        ? ` · ${escapeTelegramHtml(order.fulfilment.supplierOrderId)}`
        : "";
      lines.push(`<b>Supplier:</b> ${escapeTelegramHtml(order.fulfilment.supplier)}${supplierOrder}`);
    }
    if (topic === "system") {
      lines.push(
        `<b>Reason:</b> ${escapeTelegramHtml(order?.fulfilment?.lastError || reason || "Unknown error")}`
      );
    }
    lines.push(`<b>Time:</b> ${escapeTelegramHtml(new Date().toISOString())}`);

    return this.send(topic, lines.join("\n"));
  }

  async notifyLowBalance(supplier: "G2BULK" | "VIZO", balance: number, currency = "USD") {
    const topic: TelegramAlertTopic = supplier === "G2BULK" ? "lowBalanceG2b" : "lowBalanceVizo";
    if (!this.isConfigured(topic)) return false;
    const now = Date.now();
    const lastAlert = this.lowBalanceAlertAt.get(supplier) || 0;
    if (now - lastAlert < 30 * 60 * 1000) return false;
    const lines = [
      `<b>Low Balance ${supplier === "G2BULK" ? "G2B" : "Vizo"}</b>`,
      `<b>Supplier:</b> ${escapeTelegramHtml(supplier)}`,
      `<b>Balance:</b> ${escapeTelegramHtml(balance.toFixed(2))} ${escapeTelegramHtml(currency)}`,
      `<b>Threshold:</b> $3.00 USD`,
      `<b>Time:</b> ${escapeTelegramHtml(new Date().toISOString())}`,
    ];
    const sent = await this.send(topic, lines.join("\n"));
    if (sent) this.lowBalanceAlertAt.set(supplier, now);
    return sent;
  }
}

export const telegramAlertService = new TelegramAlertService();
