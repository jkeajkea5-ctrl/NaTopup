import test from "node:test";
import assert from "node:assert/strict";
import { OrderStatus } from "@topup/shared";
import {
  escapeTelegramHtml,
  formatCambodiaTime,
  formatTelegramReceipt,
  getTelegramAlertTopic,
} from "../services/TelegramAlertService";

test("routes order statuses to the correct Telegram topic", () => {
  assert.equal(getTelegramAlertTopic(OrderStatus.PAID), "paid");
  assert.equal(getTelegramAlertTopic(OrderStatus.DELIVERED), "completed");
  assert.equal(getTelegramAlertTopic(OrderStatus.FAILED), "system");
  assert.equal(getTelegramAlertTopic(OrderStatus.REVIEW_REQUIRED), "system");
  assert.equal(getTelegramAlertTopic(OrderStatus.PROCESSING), null);
});

test("escapes customer and supplier text before using Telegram HTML", () => {
  assert.equal(escapeTelegramHtml('A&B <script>'), "A&amp;B &lt;script&gt;");
});

test("formats Telegram timestamps in Cambodia time", () => {
  assert.equal(
    formatCambodiaTime(new Date("2026-09-22T17:50:11.902Z")),
    "2026-09-23 00:50:11 (Cambodia)"
  );
});

test("formats a paid Telegram receipt with an explicit status", () => {
  const receipt = formatTelegramReceipt({
    publicOrderId: "NT-ABC12345",
    status: OrderStatus.PAID,
    gameName: "Mobile Legends",
    productName: "Weekly Elite Pack",
    playerId: "123456",
    serverId: "7890",
    playerName: "Player One",
    total: 0.86,
    currency: "USD",
    paymentProvider: "KHQR",
    paymentReference: "TX-100",
    time: new Date("2026-09-22T17:50:11.902Z"),
  });

  assert.match(receipt, /PAYMENT SUCCESS/);
  assert.match(receipt, /Status:<\/b> 🟢 <b>PAID/);
  assert.match(receipt, /Weekly Elite Pack/);
  assert.match(receipt, /\$0\.86 USD/);
  assert.match(receipt, /TX-100/);
});

test("formats a delivered Telegram receipt after the paid receipt", () => {
  const receipt = formatTelegramReceipt({
    publicOrderId: "NT-DELIVERED1",
    status: OrderStatus.DELIVERED,
    productName: "55 Diamonds",
  });

  assert.match(receipt, /ORDER DELIVERED/);
  assert.match(receipt, /Status:<\/b> ✅ <b>DELIVERED/);
});

test("formats review receipts with an escaped reason", () => {
  const receipt = formatTelegramReceipt({
    publicOrderId: "NT-REVIEW1",
    status: OrderStatus.REVIEW_REQUIRED,
    reason: "Supplier <timeout> & retry",
  });

  assert.match(receipt, /Status:<\/b> ⚠️ <b>REVIEW REQUIRED/);
  assert.match(receipt, /Supplier &lt;timeout&gt; &amp; retry/);
});
