import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  CreditCard,
  HelpCircle,
  UserCheck,
  Gem,
  Wallet,
  X,
  Sparkles,
  Check,
  Send,
  ShoppingBag,
  ArrowLeft,
} from "lucide-react";
import { checkPlayerId, createOrder, fetchGameDetail, initKhqrPayment, fetchOrderDetail, fetchOrderStatus } from "../services/api";
import { ProductCard } from "../components/ProductCard";
import { SuccessInvoiceModal } from "../components/SuccessInvoiceModal";
import { TermsModal } from "../components/TermsModal";
import { closeProviderCheckout } from "../services/paymentCheckout";

let khqrPluginPromise;

async function openProviderCheckout(checkoutUrl, onSuccess, onError) {
  if (!checkoutUrl) throw new Error("Payment checkout is unavailable. Please try again.");
  if (!window.KhqrPayway?.openCheckout) {
    if (!khqrPluginPromise) {
      khqrPluginPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://anajakpay.com/khqrcc-plugin.js";
        script.async = true;
        script.onload = resolve;
        script.onerror = () => {
          script.remove();
          reject(new Error("Unable to load payment checkout. Please try again."));
        };
        document.head.appendChild(script);
      }).catch((error) => {
        khqrPluginPromise = null;
        throw error;
      });
    }
    await khqrPluginPromise;
  }
  if (!window.KhqrPayway?.openCheckout) {
    khqrPluginPromise = null;
    throw new Error("Payment checkout is unavailable. Please try again.");
  }
  window.KhqrPayway.openCheckout({ checkout_url: checkoutUrl, onSuccess, onError });
}

export const GameDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  // Terms and conditions modal state
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Refs for smooth scrolling on alerts
  const step1Ref = useRef(null);
  const step2Ref = useRef(null);
  const toastTimerRef = useRef(null);
  const toastSequenceRef = useRef(0);
  const verificationSequenceRef = useRef(0);

  // Dynamic player fields state
  const [playerFields, setPlayerFields] = useState({});
  const [isValidatingPlayer, setIsValidatingPlayer] = useState(false);
  const [verifiedPlayerName, setVerifiedPlayerName] = useState(null);
  const [playerCheckError, setPlayerCheckError] = useState(null);

  // Selected package
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Top-right toast alert when package selected (Matching LisaTopup screenshot)
  const [packageToast, setPackageToast] = useState(null);

  // Alert State (Explicit requirement: "select package alert")
  const [packageAlertMessage, setPackageAlertMessage] = useState(null);

  // Checkout submission
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState(null);
  const [paymentSession, setPaymentSession] = useState(null);
  const [successInvoice, setSuccessInvoice] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["gameDetail", slug],
    queryFn: () => fetchGameDetail(slug || ""),
    enabled: !!slug,
  });

  useEffect(() => {
    setPackageToast(null);
    setPlayerFields({});
    setVerifiedPlayerName(null);
    setPlayerCheckError(null);
    setIsValidatingPlayer(false);
    setSelectedProduct(null);
    setPaymentNotice(null);
    setPaymentSession(null);
    setSuccessInvoice(null);
    return () => {
      clearTimeout(toastTimerRef.current);
      verificationSequenceRef.current += 1;
    };
  }, [slug]);

  const showSuccessfulInvoice = useCallback(async (publicOrderId, status) => {
    closeProviderCheckout();
    try {
      const order = await fetchOrderDetail(publicOrderId);
      setSuccessInvoice({ order, status });
      setPaymentSession(null);
      setSubmitError(null);
      setPaymentNotice(null);
    } catch (err) {
      setSubmitError(err.message || "Payment succeeded, but the receipt could not be loaded. Please try again.");
    }
  }, []);

  useEffect(() => {
    const handlePaymentReturn = async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "na-topup:payment-return") return;
      if (!paymentSession || event.data.orderId !== paymentSession.publicOrderId) return;

      closeProviderCheckout();
      setSubmitError(null);
      setPaymentNotice("Payment submitted. We are verifying it and preparing your invoice.");

      try {
        const status = await fetchOrderStatus(paymentSession.publicOrderId);
        if (status.paymentStatus === "PAID" ||
            ["PAID", "FULFILMENT_QUEUED", "PROCESSING", "DELIVERED"].includes(status.status)) {
          await showSuccessfulInvoice(paymentSession.publicOrderId, status.status);
        }
      } catch {
        // The regular status poll will retry until the payment session expires.
      }
    };

    window.addEventListener("message", handlePaymentReturn);
    return () => window.removeEventListener("message", handlePaymentReturn);
  }, [paymentSession, showSuccessfulInvoice]);

  useEffect(() => {
    if (!paymentSession) return;
    let cancelled = false;
    let inFlight = false;
    const timer = setInterval(async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const status = await fetchOrderStatus(paymentSession.publicOrderId);
        if (cancelled) return;
        if (status.paymentStatus === "PAID" ||
            ["PAID", "FULFILMENT_QUEUED", "PROCESSING", "DELIVERED"].includes(status.status)) {
          clearInterval(timer);
          await showSuccessfulInvoice(paymentSession.publicOrderId, status.status);
        } else if (status.isTerminal) {
          clearInterval(timer);
          closeProviderCheckout();
          setPaymentSession(null);
          setPaymentNotice(null);
          setSubmitError(status.customerStatusText || "Payment was not completed.");
        } else if (Date.now() >= new Date(paymentSession.expiresAt).getTime()) {
          clearInterval(timer);
          closeProviderCheckout();
          setPaymentSession(null);
          setPaymentNotice(null);
          setSubmitError("Payment session expired. Please try again.");
        }
      } catch {
        // Retry temporary status failures on the next interval.
      } finally {
        inFlight = false;
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [paymentSession, showSuccessfulInvoice]);

  // Always show the top when opening new game page
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {}
    if (typeof document !== "undefined") {
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
  }, [slug]);

  useEffect(() => {
    if (!isLoading && data) {
      try {
        window.scrollTo(0, 0);
      } catch {}
      if (typeof document !== "undefined") {
        if (document.documentElement) document.documentElement.scrollTop = 0;
        if (document.body) document.body.scrollTop = 0;
      }
    }
  }, [isLoading, data]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-violet mx-auto mb-4" />
        <p className="text-brand-muted text-sm">កំពុងផ្ទុកទិន្នន័យហ្គេម...</p>
      </div>
    );
  }

  if (error || !data || !data.game) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-brand-surface rounded-2xl border border-brand-border text-center">
        <AlertCircle className="w-12 h-12 text-brand-danger mx-auto mb-3" />
        <h3 className="font-heading font-semibold text-lg text-brand-text">រកមិនឃើញហ្គេមនេះទេ</h3>
        <p className="text-xs text-brand-muted mt-1 mb-6">ហ្គេមដែលអ្នកស្វែងរកមិនមានក្នុងប្រព័ន្ធឡើយ។</p>
        <button
          onClick={() => navigate("/")}
          className="bg-brand-violet hover:bg-[#7D67C7] text-white px-5 py-2 rounded-button text-sm font-semibold transition-all"
        >
          ត្រឡប់ទៅទំព័រដើម
        </button>
      </div>
    );
  }

  const game = data?.game || {};
  const products = data?.products || [];

  const handleFieldChange = (key, value) => {
    verificationSequenceRef.current += 1;
    setIsValidatingPlayer(false);
    setPlayerFields((prev) => ({ ...prev, [key]: value }));
    setVerifiedPlayerName(null);
    setPlayerCheckError(null);
    setPackageAlertMessage(null);
  };

  const handleValidatePlayer = async () => {
    const missing = (game.fields || []).find((f) => f.isRequired && !playerFields[f.fieldKey]?.trim());
    if (missing) {
      setPlayerCheckError(`សូមបញ្ចូល ${missing.fieldLabel} របស់អ្នក!`);
      return;
    }

    const sequence = ++verificationSequenceRef.current;
    setIsValidatingPlayer(true);
    setVerifiedPlayerName(null);
    setPlayerCheckError(null);

    try {
      const res = await checkPlayerId(game.slug, playerFields);
      if (sequence !== verificationSequenceRef.current) return;
      if (res.valid === true) {
        setPlayerCheckError(null);
        setSubmitError(null);
        setVerifiedPlayerName(res.playerName || "គណនីត្រឹមត្រូវ");
      } else {
        setPlayerCheckError(res.message || "មិនអាចពិនិត្យគណនីអ្នកលេងបានទេនៅពេលនេះ។ សូមព្យាយាមម្តងទៀត។");
      }
    } catch (err) {
      if (sequence !== verificationSequenceRef.current) return;
      setPlayerCheckError(err.message || "មិនអាចពិនិត្យគណនីអ្នកលេងបានទេនៅពេលនេះ។ សូមព្យាយាមម្តងទៀត។");
    } finally {
      if (sequence === verificationSequenceRef.current) setIsValidatingPlayer(false);
    }
  };

  const usesThreeCatalogs = ["free-fire", "free-fire-khsgmy", "pubg-mobile", "honor-of-kings", "hok", "delta-force", "blood-strike"].includes(game.slug);
  const packageGroups = usesThreeCatalogs
    ? [
        { id: "pass", title: "Pass", products: products.filter((product) => product.isPopular) },
        { id: "normal", title: "Normal", products: products.filter((product) => !product.isPopular && !product.isFeatured) },
        { id: "other", title: "Other", products: products.filter((product) => product.isFeatured) },
      ]
    : [
        { id: "best-selling", title: "Best Selling", products: products.filter((product) => product.isPopular) },
        { id: "normal", title: "Normal", products: products.filter((product) => !product.isPopular) },
      ];

  const handleSelectPackage = (product) => {
    setSelectedProduct(product);
    setPackageAlertMessage(null);
    setSubmitError(null);

    // Format package title nicely in Khmer matching user's template
    let displayName = product.name;
    if (product.name.toLowerCase().includes("weekly") && product.name.toLowerCase().includes("pass")) {
      displayName = "Weekly 💎 Pass X1";
    } else if (product.name.toLowerCase().includes("monthly") && product.name.toLowerCase().includes("pass")) {
      displayName = "Monthly 💎 Pass X1";
    } else if (product.name.toLowerCase().includes("pass")) {
      displayName = product.name.replace(/pass/i, "💎 Pass");
    } else if (!displayName.includes("💎")) {
      displayName = `${product.amount} 💎 ពេជ្រ`;
    }

    // Show top-right toast alert message matching user's screenshot: បានជ្រើសរើស: <displayName>
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setPackageToast({ id: ++toastSequenceRef.current, displayName });
    toastTimerRef.current = setTimeout(() => {
      setPackageToast(null);
    }, 4500);
  };

  const handleProceedToPayment = async () => {
    if (isSubmittingOrder) return;

    if (isValidatingPlayer || !verifiedPlayerName) {
      const message = isValidatingPlayer
        ? "Player verification is in progress. Please wait before payment."
        : playerCheckError
          ? "Player ID was not found or could not be verified. Please check your details and verify again before payment."
          : "Please verify your player ID successfully before payment.";
      setPlayerCheckError(message);
      setSubmitError(message);
      step1Ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // 1. SELECT PACKAGE ALERT: Check if package selected
    if (!selectedProduct) {
      setPackageAlertMessage("សូមជ្រើសរើសកញ្ចប់ដែលអ្នកចង់បញ្ចូលមុននឹងបន្តការទូទាត់!");
      if (step2Ref.current) {
        step2Ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // 2. USER ID ALERT: Check if User ID filled
    const missing = (game.fields || []).find((f) => f.isRequired && !playerFields[f.fieldKey]?.trim());
    if (missing) {
      setPlayerCheckError(`សូមបញ្ចូល ${missing.fieldLabel} របស់អ្នក!`);
      if (step1Ref.current) {
        step1Ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // 3. TERMS AND CONDITIONS CHECK
    if (!agreeTerms) {
      setSubmitError("សូមយល់ព្រមលើលក្ខខណ្ឌ និងកិច្ចព្រមព្រៀង (TERMS AND CONDITIONS) មុននឹងបន្តការទូទាត់!");
      return;
    }

    setIsSubmittingOrder(true);
    setSubmitError(null);
    setPaymentNotice(null);

    try {
      const orderRes = await createOrder({
        gameSlug: game.slug,
        productId: selectedProduct.id,
        playerData: playerFields,
      });

      const paymentRes = await initKhqrPayment(orderRes.publicOrderId);

      await openProviderCheckout(
        paymentRes.checkoutUrl,
        async () => {
          closeProviderCheckout();
          try {
            const status = await fetchOrderStatus(orderRes.publicOrderId);
            if (status.paymentStatus === "PAID" || ["PAID", "FULFILMENT_QUEUED", "PROCESSING", "DELIVERED"].includes(status.status)) {
              await showSuccessfulInvoice(orderRes.publicOrderId, status.status);
            }
          } catch {
            // The existing 3-second poll remains authoritative and will retry.
          }
        },
        () => setSubmitError("Unable to open secure payment. Please try again.")
      );
      setPaymentSession({ ...paymentRes, publicOrderId: orderRes.publicOrderId });

    } catch (err) {
      setSubmitError(err.message || "ការបញ្ជាទិញមានបញ្ហា។ សូមព្យាយាមម្តងទៀត!");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto space-y-5 sm:space-y-6 pb-28 lg:pb-12">
      <SuccessInvoiceModal
        order={successInvoice?.order}
        status={successInvoice?.status}
        onClose={() => {
          setSuccessInvoice(null);
          navigate("/");
        }}
      />

      <Link
        to="/"
        className="-mx-4 -mt-6 flex h-10 items-center gap-1.5 border-l-2 border-[#59aeca] bg-[#eaf8fc] px-2.5 font-kulen text-sm text-[#18233f] transition-colors hover:bg-[#dff3f9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet sm:mx-0 sm:mt-0 sm:rounded-xl"
        aria-label="ត្រឡប់ក្រោយទៅទំព័រដើម"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>ត្រឡប់ក្រោយ</span>
      </Link>

      {/* SELECT PACKAGE ALERT BANNER */}
      {packageAlertMessage && (
        <div className="animate-in slide-in-from-top-3 duration-200 p-4 rounded-2xl bg-brand-violet/10 border-2 border-brand-violet text-brand-violet flex items-center justify-between shadow-lg font-kulen">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-violet text-white flex items-center justify-center flex-shrink-0 shadow-sm animate-bounce">
              <Gem className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-sm">មិនទាន់បានជ្រើសរើសកញ្ចប់!</h4>
              <p className="text-xs font-medium opacity-90">{packageAlertMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setPackageAlertMessage(null)}
            className="p-1.5 rounded-lg hover:bg-brand-violet/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Top-Right Selected Package Toast Alert (Solid Brand Violet, No Gradient) */}
      {packageToast && (
        <div key={packageToast.id} role="status" aria-live="polite" className="fixed top-16 sm:top-20 right-3 sm:right-6 max-w-[calc(100vw-1.5rem)] z-[9999] animate-popup-bounce-in">
          <div className="relative overflow-hidden bg-brand-violet text-white px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 backdrop-blur-md animate-popup-glow">
            {/* White Circle with Violet Check Icon (Animated Pop) */}
            <div className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white text-brand-violet flex items-center justify-center flex-shrink-0 shadow-sm font-bold text-xs animate-check-pop">
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
            </div>
            <span className="relative z-10 font-kulen font-bold text-xs sm:text-sm tracking-wide flex items-center gap-1.5 drop-shadow-xs">
              <span>បានជ្រើសរើស:</span>
              <span className="font-extrabold">{packageToast.displayName}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                clearTimeout(toastTimerRef.current);
                setPackageToast(null);
              }}
              className="relative z-10 text-white/80 hover:text-white transition-all ml-2 p-1 hover:bg-white/20 rounded-full hover:scale-110 active:scale-95 cursor-pointer"
              aria-label="បិទ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* TOP GAME BANNER (Fits Yellow Border: Full-width Edge-to-Edge on Mobile) */}
      <div className="-mx-4 sm:mx-0 mb-6 relative overflow-hidden rounded-none sm:rounded-2xl lg:rounded-3xl shadow-card border-b sm:border border-brand-border bg-black group">
        <div className="relative w-full h-[190px] sm:h-[260px] md:h-[320px] lg:h-[360px] overflow-hidden">
          <img
            src={game.bannerUrl || game.logoUrl || "/placeholder.png"}
            alt={game.name || "Game Banner"}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
          />
          {/* Subtle gradient overlay for readability and depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

          {/* Game Title, Logo & Badges Overlaid at Bottom Left of Banner */}
          <div className="absolute bottom-3 left-4 right-4 sm:bottom-5 sm:left-6 sm:right-6 flex items-center gap-3.5 z-10">
            <img
              src={game.logoUrl || "/placeholder.png"}
              alt={game.name}
              className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-xl sm:rounded-2xl border-2 border-white/80 shadow-lg object-cover bg-white flex-shrink-0"
            />
            <div className="text-white drop-shadow-md">
              <h1 className="font-heading font-extrabold text-lg sm:text-2xl lg:text-3xl text-white tracking-wide">
                {game.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="bg-brand-violet text-white text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
                  {game.category || "Game"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2-COLUMN LAYOUT MATCHING LISATOPUP FREE FIRE (https://lisatopup.com/game/free-fire-khsgmy) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: ការបញ្ជាទិញ (Order Summary) */}
        <div className="order-last lg:order-first lg:col-span-4 space-y-4">
          <div className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-card border border-brand-border bg-white lg:sticky lg:top-20 transition-all">
            {/* Header Ribbon: Solid Brand Violet */}
            <div className="bg-brand-violet text-white px-5 py-3.5 font-kulen font-bold text-sm sm:text-base flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5" />
                <span>ការបញ្ជាទិញ</span>
              </div>
              <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-medium tracking-wide">
                Order Summary
              </span>
            </div>

            <div className="p-5 space-y-4 text-xs sm:text-sm">
              {/* Game Item Details */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#FAF8FD] border border-brand-border/60">
                <img
                  src={game.logoUrl || "/placeholder.png"}
                  alt={game.name}
                  className="w-12 h-12 rounded-xl object-cover border border-white shadow-xs bg-white flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="font-heading font-bold text-sm text-brand-text truncate leading-tight">
                    {game.name}
                  </h4>
                  <p className="text-[11px] text-brand-muted font-medium mt-0.5">
                    {game.category || "Official Game Top-Up"}
                  </p>
                </div>
              </div>

              {/* Player Account Summary */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-brand-surface border border-brand-border/60">
                <div className="text-[11px] font-bold text-brand-muted uppercase tracking-wider font-kulen">
                  ព័ត៌មានគណនី (Account)
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-brand-muted">User ID:</span>
                  <span className="font-mono font-bold text-brand-text">
                    {playerFields.userId || playerFields.playerId || "—"}
                  </span>
                </div>
                {(playerFields.zoneId || playerFields.serverId) && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-brand-muted">Zone ID:</span>
                    <span className="font-mono font-bold text-brand-text">
                      {playerFields.zoneId || playerFields.serverId}
                    </span>
                  </div>
                )}
                <div className="pt-1.5 border-t border-brand-border/40 flex items-center justify-between text-xs">
                  <span className="text-brand-muted">ឈ្មោះក្នុងហ្គេម:</span>
                  {verifiedPlayerName ? (
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {verifiedPlayerName}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">មិនទាន់ពិនិត្យ</span>
                  )}
                </div>
              </div>

              {/* Selected Package Summary */}
              <div className="space-y-1.5 p-3 rounded-2xl bg-brand-surface border border-brand-border/60">
                <div className="text-[11px] font-bold text-brand-muted uppercase tracking-wider font-kulen">
                  កញ្ចប់បានជ្រើសរើស (Package)
                </div>
                {selectedProduct ? (
                  <div className="pt-1 space-y-1">
                    <div className="flex items-center justify-between font-bold text-xs sm:text-sm text-brand-text">
                      <span className="flex items-center gap-1.5">
                        <span>💎</span>
                        <span>{selectedProduct.name}</span>
                      </span>
                      <span className="text-brand-rose font-extrabold">
                        ${Number(selectedProduct.finalPriceUsd ?? selectedProduct.priceUsd ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs text-brand-muted/70 italic border border-dashed border-brand-border rounded-xl">
                    សូមជ្រើសរើសកញ្ចប់នៅជំហានទី ២
                  </div>
                )}
              </div>

              {/* Payment Method Matching User's ABA KHQR Design */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#EEF6FC] border-2 border-[#1E75A0] shadow-xs">
                <div className="flex items-center gap-3">
                  <img
                    src="/aba-khqr.svg"
                    alt="ABA KHQR"
                    className="w-10 h-10 rounded-xl object-contain shadow-xs flex-shrink-0 bg-white"
                  />
                  <div>
                    <h4 className="font-heading font-bold text-sm text-[#005E7B] leading-tight">
                      ABA KHQR
                    </h4>
                    <p className="text-[11px] text-[#2E79A6] font-medium leading-tight mt-0.5">
                      Scan to pay with any banking app
                    </p>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full bg-[#005E7B] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>

              {/* Total Price Breakdown */}
              <div className="pt-2 border-t border-brand-border space-y-1">
                <div className="flex items-center justify-between text-xs text-brand-muted font-kulen">
                  <span>តម្លៃសរុប (Total)</span>
                  <span className="text-[11px] text-gray-400">គិតជាដុល្លារ ($)</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <div className="font-heading font-black text-2xl text-brand-violet">
                    ${selectedProduct ? Number(selectedProduct.finalPriceUsd ?? selectedProduct.priceUsd ?? 0).toFixed(2) : "0.00"}
                  </div>
                </div>
              </div>

              {/* Terms & Conditions agreement checkbox */}
              <div className="flex items-start gap-2 pt-1 font-kulen text-xs">
                <input
                  type="checkbox"
                  id="terms-checkbox-summary"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-0.5 rounded text-brand-violet focus:ring-brand-violet w-4 h-4 accent-brand-violet cursor-pointer flex-shrink-0"
                />
                <div className="text-gray-600 text-[11px] leading-relaxed select-none">
                  <label htmlFor="terms-checkbox-summary" className="cursor-pointer font-medium">
                    ខ្ញុំយល់ព្រមតាម{" "}
                  </label>
                  <button
                    type="button"
                    id="open-terms-btn"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsTermsOpen(true);
                    }}
                    className="text-brand-violet hover:text-[#7D67C7] underline font-bold transition-colors cursor-pointer inline"
                  >
                    TERMS AND CONDITIONS (លក្ខខណ្ឌ និងកិច្ចព្រមព្រៀង)
                  </button>
                </div>
              </div>

              {/* Error if checkout fails */}
              {submitError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2 font-kulen">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {paymentNotice && (
                <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-xs text-brand-violet font-kulen">
                  <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />
                  <span>{paymentNotice}</span>
                </div>
              )}

              {/* Checkout Button */}
              <button
                type="button"
                onClick={handleProceedToPayment}
                disabled={isSubmittingOrder}
                className="hidden w-full items-center justify-center gap-2 rounded-xl bg-brand-violet px-4 py-3.5 font-kulen text-sm font-bold text-white shadow-md transition-all hover:bg-[#7D67C7] hover:shadow-lg active:scale-98 lg:flex cursor-pointer"
              >
                {isSubmittingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>កំពុងដំណើរការ...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>បង់ប្រាក់ឥឡូវនេះ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 3 Pink Ribbon Steps (LisaTopup Layout) */}
        <div className="lg:col-span-8 space-y-5">
          {/* STEP 1: បញ្ចូល អាយឌី (Enter ID) */}
          <div
            ref={step1Ref}
            className="rounded-2xl sm:rounded-3xl overflow-hidden shadow-card border border-brand-border bg-white"
          >
            {/* Solid Brand Violet Top Header Ribbon (No Gradient) */}
            <div className="bg-brand-violet text-white px-5 py-3 font-kulen font-bold text-sm sm:text-base flex items-center gap-2.5 shadow-sm">
              <UserCheck className="w-5 h-5" />
              <span>បញ្ចូល អាយឌី</span>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {/* Valorant Server Selector (Cambodia Server vs Singapore Server) */}
              {game.slug.includes("valorant") && (
                <div className="space-y-1.5 pb-2">
                  <label className="block text-xs font-kulen font-bold text-brand-text">
                    ជ្រើសរើស Server (Select Server):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/game/valorant")}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        game.slug === "valorant" || game.slug === "valorant-cambodia"
                          ? "bg-brand-violet text-white border-brand-violet shadow-sm"
                          : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      <span className="text-sm">🇰🇭</span>
                      <span>Server Cambodia</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/game/valorant-sg")}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        game.slug === "valorant-sg"
                          ? "bg-brand-violet text-white border-brand-violet shadow-sm"
                          : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
                      }`}
                    >
                      <span className="text-sm">🇸🇬</span>
                      <span>Server Singapore (SG)</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                {(game.fields || []).map((field, idx) => (
                  <div
                    key={field.id || idx}
                    className={
                      (game.fields || []).length === 2
                        ? idx === 0
                          ? "sm:col-span-5"
                          : "sm:col-span-4"
                        : "sm:col-span-8"
                    }
                  >
                    <input
                      type={field.fieldType === "number" ? "number" : "text"}
                      value={playerFields[field.fieldKey] || ""}
                      onChange={(e) => handleFieldChange(field.fieldKey, e.target.value)}
                      placeholder={field.placeholder || "ឧ: 12345678"}
                      className="w-full px-4 py-3 rounded-xl text-sm bg-brand-surface border border-brand-border focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/20 font-medium tracking-wide"
                    />
                  </div>
                ))}

                {/* Solid Brand Violet "ពិនិត្យ ឈ្មោះ" Check Name Button */}
                <div className="sm:col-span-4">
                  <button
                    type="button"
                    onClick={handleValidatePlayer}
                    disabled={isValidatingPlayer}
                    className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-kulen font-bold bg-brand-violet hover:bg-[#7D67C7] text-white shadow-soft hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isValidatingPlayer ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>ពិនិត្យ ឈ្មោះ</span>
                  </button>
                </div>
              </div>

              {/* Verified Username / Error Pill */}
              {verifiedPlayerName && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-green-700 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span>
                    អ្នកប្រើប្រាស់៖ <strong className="text-gray-900 text-sm">{verifiedPlayerName}</strong>
                  </span>
                </div>
              )}

              {playerCheckError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-red-600 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{playerCheckError}</span>
                </div>
              )}
            </div>
          </div>

          {/* STEP 2: ជ្រើសរើសកញ្ចប់ ពេជ្រ (Select Package) */}
          <div
            ref={step2Ref}
            className={`rounded-2xl sm:rounded-3xl overflow-hidden shadow-card border bg-white transition-all ${
              packageAlertMessage ? "border-brand-violet ring-2 ring-brand-violet/40" : "border-brand-border"
            }`}
          >
            {/* Solid Brand Violet Top Header Ribbon */}
            <div className="bg-brand-violet text-white px-5 py-3 font-kulen font-bold text-sm sm:text-base flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <Gem className="w-5 h-5" />
                <span>ជ្រើសរើសកញ្ចប់ ពេជ្រ</span>
              </div>
              <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-medium tracking-wide">
                Step 2
              </span>
            </div>

            <div className="p-3 sm:p-6 space-y-6">
              {packageGroups.map((group) => (
                <section key={group.id} aria-labelledby={`packages-${group.id}`}>
                  <h3
                    id={`packages-${group.id}`}
                    className="mb-3 border-b border-gray-100 pb-3 text-sm sm:text-base font-heading font-bold text-brand-violet"
                  >
                    {group.title}
                  </h3>
                  {group.products.length > 0 ? (
                    <div className="grid grid-cols-3 min-[560px]:grid-cols-4 xl:grid-cols-5 gap-1.5 sm:gap-3">
                      {group.products.map((prod) => (
                        <ProductCard
                          key={prod.id}
                          product={prod}
                          isSelected={selectedProduct?.id === prod.id}
                          onSelect={handleSelectPackage}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-brand-muted">No packages available in this category.</p>
                  )}
                </section>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Floating mobile checkout with space for device safe areas. */}
      <div className="mobile-checkout lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="mobile-checkout-panel mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-violet/10 text-brand-violet min-[360px]:flex">
              <Wallet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block font-kulen text-xs text-brand-muted">តម្លៃសរុប</span>
              <span aria-live="polite" aria-atomic="true" className="block text-2xl font-extrabold tracking-tight text-[#46315f] tabular-nums">
                {selectedProduct ? `$${Number(selectedProduct.finalPriceUsd ?? selectedProduct.priceUsd ?? 0).toFixed(2)}` : "$0.00"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleProceedToPayment}
            disabled={isSubmittingOrder}
            aria-busy={isSubmittingOrder}
            className="mobile-checkout-button flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-5 py-3 font-kulen text-sm text-white sm:px-8"
          >
            {isSubmittingOrder ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <CreditCard aria-hidden="true" className="h-4 w-4" />}
            <span>{isSubmittingOrder ? "កំពុងដំណើរការ..." : "បង់ ឥឡូវ"}</span>
            {!isSubmittingOrder && <ArrowRight aria-hidden="true" className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Terms & Conditions Modal */}
      <TermsModal
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
        onAgree={() => setAgreeTerms(true)}
      />
    </div>
  );
};
