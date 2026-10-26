import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;

function rootKey(): Buffer {
  const secret = process.env.AUTH_SECRET || process.env.ADMIN_DASHBOARD_KEY || (process.env.NODE_ENV !== "production" ? "local-development-admin-secret-change-me-32" : "");
  if (secret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters");
  return Buffer.from(crypto.hkdfSync("sha256", Buffer.from(secret), Buffer.from("na-topup-2fa"), Buffer.from("admin-totp-v1"), 32));
}

export function encodeBase32(input: Buffer): string {
  let bits = "";
  for (const byte of input) bits += byte.toString(2).padStart(8, "0");
  let result = "";
  for (let index = 0; index < bits.length; index += 5) result += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  return result;
}

export function decodeBase32(value: string): Buffer {
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const character of clean) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string { return encodeBase32(crypto.randomBytes(20)); }

export function totpAt(secret: string, timestampMs = Date.now(), digits = 6): { code: string; step: number } {
  const step = Math.floor(timestampMs / 1000 / STEP_SECONDS);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return { code: String(binary % 10 ** digits).padStart(digits, "0"), step };
}

export function verifyTotp(secret: string, value: unknown, now = Date.now()): number | null {
  if (typeof value !== "string" || !/^\d{6}$/.test(value)) return null;
  for (const drift of [-1, 0, 1]) {
    const result = totpAt(secret, now + drift * STEP_SECONDS * 1000);
    if (crypto.timingSafeEqual(Buffer.from(result.code), Buffer.from(value))) return result.step;
  }
  return null;
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", rootKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptTotpSecret(value: string): string {
  const [version, iv, tag, encrypted, extra] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted || extra) throw new Error("Invalid encrypted 2FA secret");
  const decipher = crypto.createDecipheriv("aes-256-gcm", rootKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

function signChallenge(payload: string): string { return crypto.createHmac("sha256", rootKey()).update(payload).digest("base64url"); }

export function createTwoFactorChallenge(adminId: string): string {
  const payload = Buffer.from(JSON.stringify({ adminId, expiresAt: Date.now() + 5 * 60_000, nonce: crypto.randomBytes(16).toString("hex") })).toString("base64url");
  return `${payload}.${signChallenge(payload)}`;
}

export function verifyTwoFactorChallenge(token: unknown): string | null {
  if (typeof token !== "string" || token.length > 1024) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  const expected = signChallenge(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof parsed.adminId === "string" && parsed.expiresAt > Date.now() ? parsed.adminId : null;
  } catch { return null; }
}

export function provisioningUri(username: string, secret: string): string {
  const issuer = "NA TOPUP";
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${username}`)}?${new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: "6", period: String(STEP_SECONDS) })}`;
}

function recoveryHash(code: string): string { return crypto.createHmac("sha256", rootKey()).update(code.replace(/\s/g, "").toUpperCase()).digest("hex"); }

export function generateRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: 8 }, () => `${crypto.randomBytes(4).toString("hex").slice(0, 4)}-${crypto.randomBytes(4).toString("hex").slice(0, 4)}`.toUpperCase());
  return { codes, hashes: codes.map(recoveryHash) };
}

export function consumeRecoveryCode(encoded: string | null | undefined, value: unknown): string[] | null {
  if (typeof value !== "string" || !encoded) return null;
  let hashes: string[];
  try { hashes = JSON.parse(encoded); } catch { return null; }
  const candidate = recoveryHash(value);
  const index = hashes.findIndex((hash) => typeof hash === "string" && hash.length === candidate.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(candidate)));
  if (index < 0) return null;
  return hashes.filter((_, current) => current !== index);
}
