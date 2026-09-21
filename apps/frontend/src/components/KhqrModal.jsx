import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import {
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  Copy,
  Check,
  Download,
  ExternalLink,
} from "lucide-react";
import confetti from "canvas-confetti";
import { fetchOrderStatus } from "../services/api";

export const KhqrModal = ({
  publicOrderId,
  totalUsd,
  totalKhr,
  qrPayload,
  qrImageUrl: propQrImageUrl,
  expiresAt,
  initialSeconds,
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds ?? 600);
  const [paymentStatus, setPaymentStatus] = useState("PENDING");
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  // Generate clean, high-precision unoccluded QR code matrix locally
  useEffect(() => {
    if (qrPayload) {
      QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 340,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => {
          console.error("Local QR generation error:", err);
        });
    }
  }, [qrPayload]);

  // Fallback QR display URL
  const qrDisplayUrl =
    qrDataUrl ||
    propQrImageUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      qrPayload || ""
    )}&ecc=M&margin=10`;

  // Bakong Mobile App Deeplink
  const bakongDeeplink = `bakong://qr?data=${encodeURIComponent(qrPayload || "")}`;
  const abaMobileDeeplink = `abamobilebank://ababank.com?type=payway&qrcode=${encodeURIComponent(qrPayload || "")}`;

  // Use the server deadline so background tabs do not extend QR validity.
  useEffect(() => {
    if (!isOpen || paymentStatus !== "PENDING") return;
    const deadline = expiresAt ? new Date(expiresAt).getTime() : Date.now() + (initialSeconds ?? 600) * 1000;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) setPaymentStatus("EXPIRED");
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [isOpen, paymentStatus, expiresAt, initialSeconds]);

  // Poll backend authority every 3 seconds without overlapping slow requests.
  useEffect(() => {
    if (!isOpen || paymentStatus !== "PENDING") return;
    let cancelled = false;
    let inFlight = false;
    const poll = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const data = await fetchOrderStatus(publicOrderId);
        if (cancelled) return;
        if (data.paymentStatus === "PAID" || ["PAID", "FULFILMENT_QUEUED", "PROCESSING", "DELIVERED"].includes(data.status)) {
          setPaymentStatus("PAID");
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        } else if (data.status === "EXPIRED" || data.paymentStatus === "EXPIRED") {
          setPaymentStatus("EXPIRED");
        } else if (data.isTerminal) {
          setPaymentStatus("FAILED");
        }
      } catch {
        // A temporary connection failure is retried on the next interval.
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isOpen, publicOrderId, paymentStatus]);

  useEffect(() => {
    if (!isOpen || paymentStatus !== "PAID") return;
    const timer = setTimeout(() => navigate(`/check-order?orderId=${publicOrderId}`), 2500);
    return () => clearTimeout(timer);
  }, [isOpen, paymentStatus, publicOrderId, navigate]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

  const handleCopyRef = () => {
    navigator.clipboard.writeText(publicOrderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    try {
      const a = document.createElement("a");
      a.href = qrDisplayUrl;
      a.download = `KHQR_${publicOrderId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(qrDisplayUrl, "_blank");
    }
  };

  const handleAbaMobileClick = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && qrPayload) {
      window.location.href = abaMobileDeeplink;
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-sm sm:max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-auto">
        {/* Top Close Bar */}
        <div className="absolute top-3 right-3 z-10">
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {paymentStatus === "PAID" ? (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="font-heading font-bold text-2xl text-gray-900 mb-2">
              ទូទាត់ប្រាក់ជោគជ័យ!
            </h3>
            <p className="text-sm text-gray-600 max-w-xs mb-6 font-medium">
              យើងទទួលបានការទូទាត់ចំនួន{" "}
              <span className="font-extrabold text-gray-900">${totalUsd.toFixed(2)}</span>{" "}
              របស់អ្នករួចរាល់ហើយ។ ការបញ្ចូលលុយហ្គេមកំពុងដំណើរការដោយស្វ័យប្រវត្តិ។
            </p>
            <div className="flex items-center gap-2 text-xs text-brand-violet font-semibold bg-brand-violet/10 px-4 py-2 rounded-full animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>កំពុងបញ្ជូនទៅទំព័រតាមដាន...</span>
            </div>
          </div>
        ) : ["EXPIRED", "FAILED"].includes(paymentStatus) ? (
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10" />
            </div>
            <h3 className="font-heading font-bold text-xl text-gray-900 mb-2">
              ការទូទាត់បានផុតកំណត់
            </h3>
            <p className="text-sm text-gray-600 mb-6 font-medium">
              ការទូទាត់ QR នេះបានផុតកំណត់ពេលវេលាហើយ។ សូមធ្វើការបញ្ជាទិញម្តងទៀត។
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors cursor-pointer"
            >
              បិទ និងត្រឡប់ក្រោយ
            </button>
          </div>
        ) : (
          <div className="p-4 sm:p-5 flex flex-col items-center">
            {/* AUTHENTIC ANAJAKPAY.COM KHQR CARD */}
            <div className="w-full max-w-[310px] bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200/90 overflow-hidden">
              {/* Signature Red Header with White KHQR Logo & Diagonal Corner Cut */}
              <div
                className="bg-[#E11D2A] text-white py-3 px-6 flex items-center justify-center relative shadow-sm"
                style={{
                  clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)",
                }}
              >
                {/* Official KHQR Logo Typography */}
                <div className="flex items-center justify-center font-black tracking-widest text-xl text-white font-sans select-none drop-shadow-xs">
                  <span>KH</span>
                  <div className="relative inline-flex items-center justify-center mx-0.5">
                    <div className="w-4 h-4 rounded-full border-[2.5px] border-white"></div>
                    <div className="absolute -bottom-0.5 right-0 w-1.5 h-1.5 bg-white rounded-xs rotate-45"></div>
                  </div>
                  <span>R</span>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-3.5 sm:p-4 text-center">
                {/* Merchant Name */}
                <div className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
                  Na Topup
                </div>

                {/* Amount in USD */}
                <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-baseline justify-center gap-1.5 mt-0.5">
                  <span>{totalUsd.toFixed(2)}</span>
                  <span className="text-xs font-bold text-gray-500">USD</span>
                </div>

                {/* Perforated Ticket Dashed Line */}
                <div className="relative my-3 flex items-center">
                  <div className="w-3 h-5 rounded-r-full bg-[#F3F4F6] border-r border-gray-200 -ml-5 sm:-ml-6 flex-shrink-0"></div>
                  <div className="w-full border-t-2 border-dashed border-gray-200 mx-2"></div>
                  <div className="w-3 h-5 rounded-l-full bg-[#F3F4F6] border-l border-gray-200 -mr-5 sm:-mr-6 flex-shrink-0"></div>
                </div>

                {/* QR Code Container with 100% scannable unoccluded matrix */}
                <div className="relative p-2 bg-white flex items-center justify-center mx-auto rounded-xl">
                  <img
                    src={qrDisplayUrl}
                    alt="AnajakPay KHQR Code"
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto transition-transform hover:scale-102 select-none"
                  />
                </div>

                {/* Scan Info */}
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-[11px] font-semibold text-gray-600">
                    Scan with ABA Mobile, or other Mobile Banking App
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    ស្កេនជាមួយ ABA Mobile ឬកម្មវិធីធនាគារដែលគាំទ្រ KHQR
                  </p>
                </div>
              </div>
            </div>

            {/* Countdown & Live Verification Status */}
            <div className="mt-3 flex items-center justify-center gap-2.5 w-full">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                <Clock className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                <span>ផុតកំណត់៖ {formattedTime}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-brand-violet font-semibold bg-brand-violet/10 px-3 py-1 rounded-full border border-brand-violet/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-violet opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-violet"></span>
                </span>
                <span>រង់ចាំការបង់ប្រាក់...</span>
              </div>
            </div>

            {/* DEEPLINK BUTTONS SECTION */}
            <div className="mt-3 w-full space-y-2">
              {/* Primary Deeplink: Open in ABA Mobile */}
              <a
                href={abaMobileDeeplink}
                onClick={handleAbaMobileClick}
                className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm bg-[#005E7B] hover:bg-[#004B62] active:scale-98 text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <img src="/aba-khqr.png" alt="ABA Mobile" className="w-4 h-4 rounded-xs object-contain" />
                <span className="font-kulen font-bold text-xs sm:text-sm">បើកក្នុង</span>
                <span className="font-bold text-xs sm:text-sm tracking-wide">ABA Mobile (Deeplink)</span>
                <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
              </a>

              {/* Secondary Deeplink: Open in Bakong App */}
              <a
                href={bakongDeeplink}
                className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm bg-[#E11D2A] hover:bg-[#C91521] active:scale-98 text-white shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span className="font-kulen font-bold text-xs sm:text-sm">បើកក្នុង</span>
                <span className="font-bold text-xs sm:text-sm tracking-wide">Bakong App (Deeplink)</span>
                <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
              </a>

              {/* Auxiliary Actions: Save Image & Copy Order ID */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="py-2 px-3 rounded-lg text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-gray-500" />
                  <span>ទាញយក QR</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="py-2 px-3 rounded-lg text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-green-600">បានចម្លង</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-gray-500" />
                      <span>{publicOrderId}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Supported Banks Footnote */}
            <div className="mt-3 pt-2.5 border-t border-gray-100 w-full flex items-center justify-center gap-2 text-[11px] text-gray-400 font-medium">
              <Smartphone className="w-3.5 h-3.5 text-gray-400" />
              <span>គាំទ្រ 40+ ធនាគារ និងកាបូបឌីជីថលនៅកម្ពុជា</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
