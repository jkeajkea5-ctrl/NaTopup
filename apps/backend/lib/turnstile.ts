const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "create_order";

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export type TurnstileVerification = {
  success: boolean;
  reason?: "missing-token" | "not-configured" | "provider-error" | "invalid-token";
};

function allowedHostnames(): Set<string> {
  const configured = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || "natopup.com,www.natopup.com")
    .split(",")
    .map((hostname) => hostname.trim().toLowerCase())
    .filter(Boolean);
  return new Set(configured);
}

export async function verifyTurnstileToken(
  token: unknown,
  remoteIp?: string
): Promise<TurnstileVerification> {
  if (typeof token !== "string" || token.length < 10 || token.length > 2048) {
    return { success: false, reason: "missing-token" };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { success: false, reason: "not-configured" };

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);

  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) return { success: false, reason: "provider-error" };

    const result = (await response.json()) as TurnstileResponse;
    const hostname = result.hostname?.toLowerCase();
    const hostnameAllowed = Boolean(hostname && allowedHostnames().has(hostname));
    if (!result.success || result.action !== TURNSTILE_ACTION || !hostnameAllowed) {
      return { success: false, reason: "invalid-token" };
    }

    return { success: true };
  } catch {
    return { success: false, reason: "provider-error" };
  }
}
