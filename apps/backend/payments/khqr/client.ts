import { config } from "../../lib/config";
import { logger } from "../../lib/logger";
import { sha1, sha256, timingSafeEqualHex, verifyHmacSha256 } from "../../lib/security";
import { mapProviderStatusToInternal } from "./mapper";
import { KhqrGenerateInput, KhqrGenerateOutput, KhqrVerifyInput, KhqrVerifyOutput } from "./types";

/**
 * A provider "paid" flag is not sufficient to release a supplier order.
 * Require the authenticated status response to contain the exact amount and
 * currency that were persisted for the local payment.
 */
export function verifiedPaymentMatches(
  verification: KhqrVerifyOutput,
  expectedAmount: number,
  expectedCurrency: string,
  expectedTransactionId?: string | null
): boolean {
  return (
    verification.paid === true &&
    typeof verification.paidAmount === "number" &&
    Number.isFinite(verification.paidAmount) &&
    Math.abs(verification.paidAmount - expectedAmount) <= 0.01 &&
    typeof verification.currency === "string" &&
    verification.currency.trim().toUpperCase() === expectedCurrency.trim().toUpperCase() &&
    (!expectedTransactionId || verification.transactionId === expectedTransactionId)
  );
}

export function parseWebhookTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{14}$/.test(trimmed)) {
    const year = Number(trimmed.slice(0, 4));
    const month = Number(trimmed.slice(4, 6));
    const day = Number(trimmed.slice(6, 8));
    const hour = Number(trimmed.slice(8, 10));
    const minute = Number(trimmed.slice(10, 12));
    const second = Number(trimmed.slice(12, 14));
    const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
    const parsed = new Date(timestamp);
    if (
      parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day && parsed.getUTCHours() === hour &&
      parsed.getUTCMinutes() === minute && parsed.getUTCSeconds() === second
    ) {
      return timestamp;
    }
    return null;
  }
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) return null;
    return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isWebhookTimestampFresh(
  value: unknown,
  maxAgeSeconds: number,
  now = Date.now()
): boolean {
  if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) return false;
  const timestamp = parseWebhookTimestamp(value);
  if (timestamp === null) return false;
  const age = now - timestamp;
  return age >= -60_000 && age <= maxAgeSeconds * 1000;
}

export class KhqrClient {
  private khqrpayBaseUrl: string;
  private khqrpayApiKey: string;
  private khqrpayWebhookSecret: string;
  private khqrccBaseUrl: string;
  private khqrccCheckoutUrl: string;
  private khqrccProfileId: string;
  private khqrccSecretKey: string;

  private khqrBaseUrl: string;
  private khqrApiKey: string;
  private khqrWebhookSecret: string;

  constructor() {
    this.khqrpayBaseUrl = config.khqrpay.baseUrl.replace(/\/$/, "");
    this.khqrpayApiKey = config.khqrpay.apiKey;
    this.khqrpayWebhookSecret = config.khqrpay.webhookSecret;
    this.khqrccBaseUrl = config.khqrcc.baseUrl.replace(/\/$/, "");
    this.khqrccCheckoutUrl = config.khqrcc.checkoutUrl.replace(/\/$/, "");
    this.khqrccProfileId = config.khqrcc.profileId;
    this.khqrccSecretKey = config.khqrcc.secretKey;

    this.khqrBaseUrl = config.khqr.baseUrl;
    this.khqrApiKey = config.khqr.apiKey;
    this.khqrWebhookSecret = config.khqr.webhookSecret;
  }

  /**
   * Build AnajakPay's managed checkout URL after the direct QR session exists.
   * The checkout parameters are signed here so the browser never receives a key.
   */
  getCheckoutUrl(orderReference: string, amount: number, provider = "KHQRPAY_ABA_V2"): string {
    if (provider === "KHQRPAY_ABA_V2") {
      if (!this.khqrpayApiKey) throw new Error("ABA KHQR v2 is not configured");
      return `${this.khqrpayBaseUrl}/pay/${encodeURIComponent(orderReference)}`;
    }
    if (!this.khqrccProfileId || !this.khqrccSecretKey) throw new Error("ABA Anajak is not configured");
    const amountStr = amount.toFixed(2);
    const successUrlObject = new URL("/api/payments/anajakpay/success", config.backendUrl);
    successUrlObject.searchParams.set("orderId", orderReference);
    const successUrl = successUrlObject.toString();
    const remark = `Order ${orderReference}`;
    const hash = sha1(this.khqrccSecretKey + orderReference + amountStr + successUrl + remark);
    return `${this.khqrccCheckoutUrl}/${this.khqrccProfileId}?${new URLSearchParams({ transaction_id: orderReference, amount: amountStr, success_url: successUrl, remark, hash }).toString()}`;
  }

  /**
   * Generates a dynamic KHQR code with standard EMVCo compliance and MD5 hash.
   * The Direct QR API is the source of truth for a tracked payment. Do not
   * substitute a locally generated QR when it fails: that QR would not create
   * a provider transaction and therefore cannot be reconciled reliably.
   */
  async generatePayment(input: KhqrGenerateInput): Promise<KhqrGenerateOutput> {
    if ((input.provider || "KHQRPAY_ABA_V2") === "KHQRPAY_ABA_V2") {
      if (!this.khqrpayApiKey) throw new Error("KHQR PAY v2 API key is not configured");
      const webhook = new URL("/api/webhooks/khqr", config.backendUrl);
      if (config.isProduction && webhook.protocol !== "https:") {
        throw new Error("BACKEND_URL must be public HTTPS for KHQR PAY v2 webhooks");
      }
      let response: Response;
      try {
        response = await fetch(`${this.khqrpayBaseUrl}/api/v1/aba/create`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.khqrpayApiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": input.orderReference,
          },
          body: JSON.stringify({ amount: Number(input.amount.toFixed(2)), webhook: webhook.toString() }),
        });
      } catch (err: any) {
        logger.error("KHQR PAY v2 ABA creation request failed", { orderId: input.orderReference, error: err.message });
        throw new Error("Unable to contact the payment provider. Please try again.");
      }
      let result: any;
      try { result = await response.json(); } catch { throw new Error("The payment provider returned invalid JSON."); }
      if (!response.ok || result?.ok !== true || !result?.id || !result?.qr) {
        logger.error("KHQR PAY v2 ABA creation rejected", { orderId: input.orderReference, httpStatus: response.status, error: result?.error });
        throw new Error(result?.error_text || result?.msg || "Payment session could not be created.");
      }
      const expiresAt = result.expires_at ? new Date(result.expires_at) : new Date(Date.now() + 10 * 60 * 1000);
      if (Number.isNaN(expiresAt.getTime())) throw new Error("The payment provider returned an invalid expiry time.");
      return {
        qrString: result.qr,
        qrImageUrl: result.qr_image,
        merchantName: result.merchant_name,
        abaDeepLink: result.aba_deeplink,
        checkoutUrl: result.checkout_url || `${this.khqrpayBaseUrl}/pay/${result.id}`,
        md5: result.md5 || "",
        amount: Number(result.amount ?? input.amount),
        currency: "USD",
        orderReference: String(result.id),
        expiresAt,
      };
    }
    const expirationMinutes = input.expirationMinutes || config.business.paymentExpiryMinutes;
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);

    if (!this.khqrccProfileId || !this.khqrccSecretKey) {
      throw new Error("AnajakPay Direct QR is not configured");
    }

    const txId = input.orderReference;
    const amountStr = input.amount.toFixed(2);
    const frontendUrl = new URL(config.frontendUrl);
    const backendUrl = new URL(config.backendUrl);
    const localHosts = ["localhost", "127.0.0.1"];
    if (
      config.isProduction &&
      (frontendUrl.protocol !== "https:" ||
        backendUrl.protocol !== "https:" ||
        localHosts.includes(frontendUrl.hostname) ||
        localHosts.includes(backendUrl.hostname))
    ) {
      throw new Error("FRONTEND_URL and BACKEND_URL must be public HTTPS URLs in production");
    }

    // The provider returns here once payment succeeds. This endpoint redirects
    // to the customer status page, which immediately verifies the transaction.
    const successUrlObject = new URL("/api/payments/anajakpay/success", backendUrl);
    successUrlObject.searchParams.set("orderId", txId);
    const successUrl = successUrlObject.toString();

    const remark = `Order ${txId}`;
    const hash = sha1(this.khqrccSecretKey + txId + amountStr + successUrl + remark);
    const url = `${this.khqrccBaseUrl}/api/${this.khqrccProfileId}/payment-gateway/v1/payments/qr-api-khqrcc`;
    const body = new URLSearchParams({
      transaction_id: txId,
      amount: amountStr,
      success_url: successUrl,
      remark,
      hash,
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
    } catch (err: any) {
      logger.error("AnajakPay Direct QR request failed", {
        orderId: txId,
        error: err.message,
      });
      throw new Error("Unable to contact the payment provider. Please try again.");
    }

    let result: any;
    try {
      result = await response.json();
    } catch {
      logger.error("AnajakPay Direct QR returned invalid JSON", { orderId: txId, status: String(response.status) });
      throw new Error("The payment provider returned an invalid response. Please try again.");
    }

    if (!response.ok || Number(result?.responseCode) !== 0 || !result?.data?.qr) {
      logger.error("AnajakPay Direct QR creation rejected", {
        orderId: txId,
        httpStatus: response.status,
        providerCode: result?.responseCode === undefined ? undefined : String(result.responseCode),
        providerMessage: result?.responseMessage,
      });
      throw new Error("Payment session could not be created. Please try again.");
    }

    const qrImageUrl = result.data.qr_url || `${this.khqrccBaseUrl}/api/khqrcc/qr/${txId}`;
    logger.info("Generated KHQR via AnajakPay Direct QR API", {
      orderId: txId,
      amount: amountStr,
      hasQrUrl: !!result.data.qr_url,
    });

    return {
      qrString: result.data.qr,
      qrImageUrl,
      checkoutUrl: this.getCheckoutUrl(txId, input.amount, "ANJAKPAY"),
      md5: result.data.md5 || "",
      amount: input.amount,
      currency: input.currency,
      orderReference: input.orderReference,
      expiresAt,
    };
  }

  /**
   * Verifies KHQR transaction via Check Transaction V2 endpoint.
   * POST https://anajakpay.com/api/{profile_id}/payment-gateway/v1/payments/check-transv2-khqrcc
   * Parameters: transaction_id, hash: sha1(secret + transaction_id)
   */
  async verifyPayment(input: KhqrVerifyInput): Promise<KhqrVerifyOutput> {
    const txId = input.transactionId || input.orderReference;

    if (input.provider === "KHQRPAY_ABA_V2") {
      if (!this.khqrpayApiKey) return { paid: false, status: "PENDING", rawResponse: { message: "KHQR PAY v2 API key is not configured" } };
      try {
        const response = await fetch(`${this.khqrpayBaseUrl}/api/v1/payment?id=${encodeURIComponent(txId)}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${this.khqrpayApiKey}`, "Cache-Control": "no-cache" },
        });
        const result: any = await response.json();
        const payment = result?.payment;
        if (!response.ok || result?.ok !== true || payment?.type !== "aba") {
          return { paid: false, status: "PENDING", rawResponse: result };
        }
        const providerStatus = String(payment?.status || "Pending").toUpperCase();
        return {
          paid: providerStatus === "PAID",
          status: providerStatus === "PAID" ? "PAID" : providerStatus === "EXPIRED" ? "EXPIRED" : providerStatus === "FAILED" || providerStatus === "UNDERPAID" ? "FAILED" : "PENDING",
          transactionId: payment?.id ? String(payment.id) : txId,
          paidAmount: Number(payment?.amount),
          currency: "USD",
          rawResponse: result,
        };
      } catch (err: any) {
        logger.error("KHQR PAY v2 payment check failed", { orderId: input.orderReference, error: err.message });
        return { paid: false, status: "PENDING", rawResponse: { message: "KHQR PAY v2 payment check failed" } };
      }
    }

    // 1. Check with AnajakPay / KHQRcc Check Transaction V2 API
    if (this.khqrccProfileId && this.khqrccSecretKey) {
      try {
        const hash = sha1(this.khqrccSecretKey + txId);
        const url = `${this.khqrccBaseUrl}/api/${this.khqrccProfileId}/payment-gateway/v1/payments/check-transv2-khqrcc`;
        const body = new URLSearchParams({
          transaction_id: txId,
          hash: hash,
        });

        let response = await fetch(url, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Cache-Control": "no-cache",
          },
          body: body.toString(),
        });

        if (response.status === 429 || response.status >= 500) {
          await new Promise((resolve) => setTimeout(resolve, 400));
          response = await fetch(url, {
            method: "POST",
            cache: "no-store",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Cache-Control": "no-cache",
            },
            body: body.toString(),
          });
        }

        if (response.ok) {
          const result = await response.json();

          if (result.responseCode === 0 && result.data) {
            const status = (result.data.status || "").toLowerCase();
            if (status === "success") {
              return {
                paid: true,
                status: "PAID",
                transactionId: result.data.transaction_id || txId,
                paidAmount: result.data.amount ? parseFloat(result.data.amount) : undefined,
                currency: result.data.currency || "USD",
                rawResponse: result,
              };
            } else if (status === "pending") {
              return {
                paid: false,
                status: "PENDING",
                rawResponse: result,
              };
            } else if (status === "failed" || status === "expired") {
              return {
                paid: false,
                status: status === "expired" ? "EXPIRED" : "FAILED",
                rawResponse: result,
              };
            }
          } else if (result.responseCode === 1 && result.responseMessage === "Transaction Not Found") {
            // Not yet paid or created with external provider
            return {
              paid: false,
              status: "PENDING",
              rawResponse: result,
            };
          }

          logger.warn("AnajakPay Check Transaction V2 returned an unexpected response", {
            orderId: txId,
            providerCode: result?.responseCode === undefined ? undefined : String(result.responseCode),
            providerMessage: result?.responseMessage,
            providerStatus: result?.data?.status,
          });
        } else {
          logger.warn("AnajakPay Check Transaction V2 returned an HTTP error", {
            orderId: txId,
            httpStatus: response.status,
          });
        }
      } catch (err: any) {
        logger.error("AnajakPay Check Transaction V2 request failed", {
          error: err.message,
          orderId: txId,
        });
      }
    }

    // 2. Fallback legacy verify if configured
    if (this.khqrApiKey && this.khqrApiKey.trim().length > 0) {
      try {
        const response = await fetch(`${this.khqrBaseUrl}/payments/verify-v2`, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            Authorization: `Bearer ${this.khqrApiKey}`,
          },
          body: JSON.stringify({
            md5: input.md5,
            order_reference: input.orderReference,
            transaction_id: input.transactionId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const internalStatus = mapProviderStatusToInternal(data.status);
          const mappedStatus: "PAID" | "PENDING" | "EXPIRED" | "FAILED" =
            internalStatus === "PAID"
              ? "PAID"
              : internalStatus === "EXPIRED"
              ? "EXPIRED"
              : internalStatus === "FAILED"
              ? "FAILED"
              : "PENDING";
          return {
            paid: mappedStatus === "PAID",
            status: mappedStatus,
            transactionId: data.transaction_id || data.hash,
            paidAmount: data.amount,
            currency: data.currency,
            rawResponse: data,
          };
        }
      } catch (err: any) {
        logger.error("Legacy KHQR verify request failed", {
          error: err.message,
          orderId: input.orderReference,
        });
      }
    }

    return {
      paid: false,
      status: "PENDING",
      rawResponse: { message: "Payment verification pending provider confirmation" },
    };
  }

  /**
   * Verifies webhook signature against raw request payload.
   */
  verifyWebhook(payloadString: string, signature: string | null | undefined): boolean {
    // Check AnajakPay's signed callback first. It has no HTTP signature
    // header; its SHA-256 signature is supplied in the JSON payload.
    try {
      const payload = JSON.parse(payloadString);
      if (payload.hash && payload.req_time && payload.transaction_id && payload.amount && this.khqrccSecretKey) {
        const expectedHash = sha256(
          `${this.khqrccSecretKey}${payload.req_time}${payload.transaction_id}${payload.amount}SUCCESS`
        );
        return (
          isWebhookTimestampFresh(payload.req_time, config.khqrcc.webhookMaxAgeSeconds) &&
          timingSafeEqualHex(String(payload.hash), expectedHash)
        );
      }
    } catch {
      // not JSON
    }

    // KHQR PAY sends X-Webhook-Signature as `sha256=<hex>`; its dedicated
    // ABA V2 secret must never be shared with another provider.
    try {
      const payload = JSON.parse(payloadString);
      if (payload?.event === "payment.update" && payload?.type === "aba") {
        const digest = signature?.trim().replace(/^sha256=/i, "") || "";
        return !!this.khqrpayWebhookSecret && verifyHmacSha256(payloadString, digest, this.khqrpayWebhookSecret);
      }
    } catch {
      // The JSON validation performed by the route will reject malformed input.
    }

    // Older KHQR integrations use a separate HMAC secret.
    // integrations may send only the hexadecimal digest. Both sign the exact
    // raw request body with HMAC-SHA256. Reject everything else rather than
    // treating an unsigned callback as a completed payment.
    if (this.khqrWebhookSecret && this.khqrWebhookSecret.trim().length > 0 && signature) {
      const digest = signature.trim().replace(/^sha256=/i, "");
      return verifyHmacSha256(payloadString, digest, this.khqrWebhookSecret);
    }

    return false;
  }
}

export const khqrClient = new KhqrClient();
