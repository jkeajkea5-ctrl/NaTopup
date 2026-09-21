import { PrismaClient } from "@prisma/client";

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

let isDbHealthy = true;
let lastDbFailure = 0;
const DB_RETRY_INTERVAL_MS = 20000; // 20s backoff before trying DB again

/**
 * Safely executes a Prisma database query with a fast timeout and circuit-breaker.
 * If the database connection is failing (e.g. Atlas IP whitelist or network),
 * it returns fallbackValue in 0-1000ms instead of hanging the entire server.
 */
export async function safeDbQuery<T>(
  queryFn: () => Promise<T>,
  fallbackValue: T,
  timeoutMs: number = 1200
): Promise<T> {
  const now = Date.now();
  if (!isDbHealthy && now - lastDbFailure < DB_RETRY_INTERVAL_MS) {
    return fallbackValue;
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DB_TIMEOUT")), timeoutMs)
    );
    const result = await Promise.race([queryFn(), timeoutPromise]);
    isDbHealthy = true;
    return result;
  } catch (err: any) {
    isDbHealthy = false;
    lastDbFailure = now;
    return fallbackValue;
  }
}

