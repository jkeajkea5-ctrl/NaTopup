import React, { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

export const SuccessInvoiceModal = ({ order, status, onClose }) => {
  useEffect(() => {
    if (!order) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [order, onClose]);

  if (!order) return null;
  const completed = status === "DELIVERED";

  return (
    <div className="fixed inset-0 z-[1000000000] flex items-center justify-center overflow-y-auto bg-slate-900/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Payment receipt">
      <section className="relative my-auto w-full max-w-[430px] overflow-hidden rounded-[30px] border border-violet-100 bg-gradient-to-b from-white to-[#f7f5ff] px-7 pb-7 pt-7 shadow-[0_24px_70px_rgba(77,60,130,0.22)] sm:px-8 sm:pb-8">
        <button type="button" onClick={onClose} aria-label="Close receipt" className="absolute right-4 top-4 rounded-full bg-violet-50 p-2 text-slate-500 transition hover:bg-violet-100 hover:text-slate-700">
          <X className="h-5 w-5" />
        </button>

        <div className="text-center">
          <img src="/na-topup-brand-2026.png" alt="NA TOPUP" className="mx-auto h-28 w-28 object-contain drop-shadow-md sm:h-32 sm:w-32" />
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-100 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-emerald-800">
            <CheckCircle2 className="h-4 w-4" /> Payment Success
          </div>
          <h2 className="mt-3 font-heading text-4xl font-black leading-none text-slate-800">Thank You!</h2>
          <p className="mt-2 font-kulen text-sm font-semibold text-slate-500">អរគុណ សម្រាប់ការទិញជាមួយយើង!</p>
        </div>

        <div className="my-6 border-t border-dashed border-violet-200" />

        <div className="rounded-[22px] border border-violet-100 bg-white px-5 py-5 shadow-[0_8px_25px_rgba(90,72,145,0.08)]">
          <dl className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="font-extrabold tracking-wide text-slate-500">ORDER ID</dt>
              <dd className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1 font-mono text-xs font-bold text-slate-700">#{order.publicOrderId}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="font-extrabold tracking-wide text-slate-500">STATUS</dt>
              <dd className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />{completed ? "Completed" : "Paid"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="font-extrabold tracking-wide text-slate-500">PLAYER ID</dt>
              <dd className="break-all text-right font-mono text-xs font-semibold text-slate-700">{order.playerId}</dd>
            </div>
            {order.serverId && <div className="flex items-center justify-between gap-4"><dt className="font-extrabold tracking-wide text-slate-500">SERVER ID</dt><dd className="font-mono text-xs font-semibold text-slate-700">{order.serverId}</dd></div>}
            <div className="flex items-center justify-between gap-4">
              <dt className="font-extrabold tracking-wide text-slate-500">PACKAGE</dt>
              <dd className="max-w-[58%] text-right text-sm font-extrabold text-brand-violet">{order.product.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-violet-50 pt-4">
              <dt className="font-black tracking-wide text-slate-700">PRICE</dt>
              <dd className="font-heading text-3xl font-black leading-none text-emerald-600">${Number(order.total).toFixed(2)}</dd>
            </div>
          </dl>
        </div>

        <button type="button" onClick={onClose} className="mt-7 min-h-14 w-full rounded-2xl bg-[#20c669] px-6 py-3 font-heading text-lg font-extrabold text-white shadow-[0_10px_24px_rgba(32,198,105,0.25)] transition hover:bg-[#18b85d] active:scale-[0.99]">Done</button>
      </section>
    </div>
  );
};
