import React, { useEffect, useRef } from "react";

const TURNSTILE_SCRIPT_ID = "cloudflare-turnstile-script";
let scriptPromise;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
    const script = existing || document.createElement("script");
    const handleLoad = () => window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load."));
    const handleError = () => reject(new Error("Unable to load the security check."));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!existing) {
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });

  return scriptPromise;
}

export function TurnstileWidget({ siteKey, onToken, resetSignal = 0 }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;
    let cancelled = false;

    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: "create_order",
          theme: "light",
          size: "flexible",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
        });
      })
      .catch(() => onTokenRef.current(""));

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current !== null && window.turnstile) {
      onTokenRef.current("");
      window.turnstile.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="turnstile-check relative z-[60] isolate min-h-[65px] w-full pointer-events-auto" aria-label="Security verification" />;
}
