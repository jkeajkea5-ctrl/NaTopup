export interface KhqrGenerateInput {
  merchantId: string;
  merchantName: string;
  terminalId: string;
  amount: number;
  currency: "USD" | "KHR";
  orderReference: string;
  expirationMinutes?: number;
}

export interface KhqrGenerateOutput {
  qrString: string;
  qrImageUrl?: string;
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
}

export interface KhqrVerifyOutput {
  paid: boolean;
  status: "PAID" | "PENDING" | "EXPIRED" | "FAILED";
  transactionId?: string;
  paidAmount?: number;
  currency?: string;
  rawResponse?: any;
}
