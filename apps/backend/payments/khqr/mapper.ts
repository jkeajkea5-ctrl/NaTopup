import { md5 } from "../../lib/security";
import { PaymentStatus } from "@topup/shared";

/**
 * Calculates standard CRC16-CCITT checksum for EMVCo QR code.
 */
function calculateCrc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function formatTlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

/**
 * Builds an authentic EMVCo standard Bakong KHQR dynamic QR payload.
 */
export function buildEmvcoKhqrPayload(options: {
  merchantId?: string;
  merchantName: string;
  terminalId: string;
  amount: number;
  currency: "USD" | "KHR";
  orderReference: string;
  bakongAccountId?: string;
}): { qrString: string; md5Hash: string } {
  const bakongAccountId = options.bakongAccountId || "natopup@abaa";

  // 1. Attempt generation using official NBC Bakong KHQR SDK
  try {
    const { BakongKHQR, khqrData, IndividualInfo } = require("bakong-khqr");
    const khqr = new BakongKHQR();
    const info = new IndividualInfo(
      bakongAccountId,
      options.merchantName || "Na Topup",
      "Phnom Penh",
      {
        currency: options.currency === "KHR" ? khqrData.currency.khr : khqrData.currency.usd,
        amount: options.amount,
        billNumber: options.orderReference,
        terminalLabel: options.terminalId || "TERM001",
        expirationTimestamp: Date.now() + 15 * 60 * 1000,
      }
    );

    const res = khqr.generateIndividual(info);
    if (res && res.data && res.data.qr) {
      return {
        qrString: res.data.qr,
        md5Hash: res.data.md5 || md5(res.data.qr),
      };
    }
  } catch (err) {
    // Continue to manual EMVCo TLV construction
  }

  // 2. Standard EMVCo Manual TLV Construction
  const currencyCode = options.currency === "KHR" ? "116" : "840";
  const formattedAmount = options.amount.toFixed(options.currency === "KHR" ? 0 : 2);

  // Tag 29: Merchant Account Information (Bakong Individual / Merchant Account)
  const tag29_00 = formatTlv("00", bakongAccountId);
  const tag29_01 = formatTlv("01", options.terminalId || "TERM001");
  const tag29 = formatTlv("29", `${tag29_00}${tag29_01}`);

  // Tag 62: Additional Data (Bill Number / Terminal)
  const tag62_01 = formatTlv("01", options.orderReference);
  const tag62_07 = formatTlv("07", options.terminalId || "TERM001");
  const tag62 = formatTlv("62", `${tag62_01}${tag62_07}`);

  let qrWithoutCrc = "";
  qrWithoutCrc += formatTlv("00", "01"); // Payload Format Indicator
  qrWithoutCrc += formatTlv("01", "12"); // Dynamic QR code
  qrWithoutCrc += tag29;
  qrWithoutCrc += formatTlv("52", "5999"); // Merchant Category Code (General Merchandise / Digital Goods)
  qrWithoutCrc += formatTlv("53", currencyCode); // 840 (USD) or 116 (KHR)
  qrWithoutCrc += formatTlv("54", formattedAmount);
  qrWithoutCrc += formatTlv("58", "KH"); // Country Code
  qrWithoutCrc += formatTlv("59", (options.merchantName || "Na Topup").slice(0, 25)); // Merchant Name
  qrWithoutCrc += formatTlv("60", "Phnom Penh"); // Merchant City
  qrWithoutCrc += tag62;

  // Append Tag 63 with length 04 for checksum calculation
  const qrForCrc = `${qrWithoutCrc}6304`;
  const checksum = calculateCrc16(qrForCrc);
  const finalQrString = `${qrForCrc}${checksum}`;

  return {
    qrString: finalQrString,
    md5Hash: md5(finalQrString),
  };
}

export function mapProviderStatusToInternal(providerStatus: string): PaymentStatus {
  const normalized = (providerStatus || "").toUpperCase().trim();
  switch (normalized) {
    case "PAID":
    case "SUCCESS":
    case "COMPLETED":
      return PaymentStatus.PAID;
    case "VERIFYING":
    case "PROCESSING":
      return PaymentStatus.VERIFYING;
    case "EXPIRED":
    case "TIMEOUT":
      return PaymentStatus.EXPIRED;
    case "FAILED":
    case "REJECTED":
    case "CANCELLED":
      return PaymentStatus.FAILED;
    case "PENDING":
    case "WAITING":
    default:
      return PaymentStatus.PENDING;
  }
}
