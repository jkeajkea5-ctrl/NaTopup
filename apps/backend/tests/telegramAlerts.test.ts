import test from "node:test";
import assert from "node:assert/strict";
import { OrderStatus } from "@topup/shared";
import { escapeTelegramHtml, getTelegramAlertTopic } from "../services/TelegramAlertService";

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
