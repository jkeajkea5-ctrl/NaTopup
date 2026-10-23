export interface KhqrGenerateInput {
  merchantId: string;
  merchantName: string;
  terminalId: string;
  amount: number;
  currency: "USD" | "KHR";
  orderReference: string;
  expirationMinutes?: number;
  provider?: "ANJAKPAY" | "KHQRPAY_ABA_V2";
}

export interface KhqrGenerateOutput {
  qrString: string;
  qrImageUrl?: string;
  merchantName?: string;
  abaDeepLink?: string;
  checkoutUrl?: string;
  md5: string;
  amount: number;
  currency: string;
  orderReference: string;
  expiresAt: Date;
}

export interface KhqrVerifyInput {
  md5?: string;
  orderReference: string;
  transactionId?: string;
  provider?: string;
}

export interface KhqrVerifyOutput {
  paid: boolean;
  status: "PAID" | "PENDING" | "EXPIRED" | "FAILED";
  transactionId?: string;
  paidAmount?: number;
  currency?: string;
  rawResponse?: any;
}
