const SENSITIVE_KEYS = [
  "apikey",
  "api_key",
  "secret",
  "password",
  "token",
  "authorization",
  "x-api-key",
  "webhooksecret",
  "webhook_secret",
  "authsecret",
];

export function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = redactSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface StructuredLog {
  requestId?: string;
  orderId?: string;
  paymentId?: string;
  supplierOrderId?: string;
  provider?: string;
  event?: string;
  durationMs?: number;
  status?: string;
  errorCode?: string;
  error?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
  [key: string]: any;
}

export const logger = {
  info(event: string, payload: Partial<StructuredLog> = {}) {
    const entry = {
      level: "INFO",
      timestamp: new Date().toISOString(),
      event,
      ...payload,
      metadata: payload.metadata ? redactSensitiveData(payload.metadata) : undefined,
    };
    console.log(JSON.stringify(entry));
  },

  warn(event: string, payload: Partial<StructuredLog> = {}) {
    const entry = {
      level: "WARN",
      timestamp: new Date().toISOString(),
      event,
      ...payload,
      metadata: payload.metadata ? redactSensitiveData(payload.metadata) : undefined,
    };
    console.warn(JSON.stringify(entry));
  },

  error(event: string, payload: Partial<StructuredLog> = {}) {
    const entry = {
      level: "ERROR",
      timestamp: new Date().toISOString(),
      event,
      ...payload,
      metadata: payload.metadata ? redactSensitiveData(payload.metadata) : undefined,
    };
    console.error(JSON.stringify(entry));
  },
};
