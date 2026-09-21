import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

export const PaymentReturnPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") || "";

  useEffect(() => {
    if (!orderId) {
      navigate("/", { replace: true });
      return;
    }

    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "na-topup:payment-return", orderId },
        window.location.origin
      );
      return;
    }

    navigate(`/check-order?orderId=${encodeURIComponent(orderId)}`, { replace: true });
  }, [navigate, orderId]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f8f5fb] p-6 text-center">
      <section className="w-full max-w-sm rounded-[28px] border border-violet-100 bg-white p-8 shadow-[0_20px_60px_rgba(77,60,130,0.16)]">
        <img src="/na-topup-logo.png" alt="NA TOPUP" className="mx-auto h-20 w-20 object-contain" />
        <Loader2 className="mx-auto mt-5 h-8 w-8 animate-spin text-brand-violet" />
        <h1 className="mt-4 font-heading text-2xl font-black text-brand-text">Verifying payment</h1>
        <p className="mt-2 text-sm text-brand-muted">Please wait while we prepare your invoice.</p>
      </section>
    </main>
  );
};
