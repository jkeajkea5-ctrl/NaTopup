import crypto from "crypto";
import { customAlphabet } from "nanoid";

// Safe alphanumeric alphabet avoiding confusing characters (e.g. 0, O, 1, I)
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const nanoid = customAlphabet(alphabet, 8);

export function generatePublicOrderId(): string {
  const prefix = (process.env.ORDER_PREFIX || "TP")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "") || "TP";
  return `${prefix}-${nanoid()}`;
}

export function generateLookupToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function sha1(data: string | Buffer): string {
  return crypto.createHash("sha1").update(data).digest("hex");
}

export function sha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function md5(data: string | Buffer): string {
  return crypto.createHash("md5").update(data).digest("hex");
}

export function createHmacSha256(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

export function verifyHmacSha256(data: string, signature: string, secret: string): boolean {
  try {
    const expected = createHmacSha256(data, secret);
    const expectedBuffer = Buffer.from(expected, "hex");
    const signatureBuffer = Buffer.from(signature, "hex");

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch (err) {
    return false;
  }
}

export function timingSafeEqualHex(actual: string, expected: string): boolean {
  try {
    if (!/^[a-f\d]+$/i.test(actual) || !/^[a-f\d]+$/i.test(expected) || actual.length !== expected.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export function verifyBearerToken(authHeader: string | null | undefined, expectedToken: string): boolean {
  if (!authHeader || !expectedToken) return false;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;
  
  const token = parts[1];
  if (token.length !== expectedToken.length) return false;
  
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken));
}
