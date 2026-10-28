import React, { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  CreditCard,
  Download,
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
import { checkPlayerId, createOrder, fetchGameDetail, fetchPaymentOptions, initKhqrPayment, fetchOrderDetail, fetchOrderStatus } from "../services/api";
import { ProductCard } from "../components/ProductCard";
import { SuccessInvoiceModal } from "../components/SuccessInvoiceModal";
import { TermsModal } from "../components/TermsModal";
import {
  closeProviderCheckout,
  isMobilePaymentDevice,
  openAbaMobileApp,
  showProviderCloseButton,
} from "../services/paymentCheckout";

const SAVED_PLAYER_FIELDS_KEY = "na-topup:saved-player-fields:v1";

function getPaymentAbaDeepLink(session) {
  // Use ABA Mobile's native QR scheme first. On iOS Safari this produces the
  // system confirmation "Open this page in ABA Mobile?" shown by the user.
  if (session?.qrString) {
    return `abamobilebank://ababank.com?type=payway&qrcode=${encodeURIComponent(session.qrString)}`;
  }
  return session?.abaDeepLink || null;
}

async function createBrandedPaymentQrDataUrl(qrString, width) {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, qrString, { errorCorrectionLevel: "H", margin: 4, width });

  try {
    const emblem = new Image();
    await new Promise((resolve, reject) => {
      emblem.onload = resolve;
      emblem.onerror = reject;
      emblem.src = "/khqr-center-emblem.svg";
    });
    const size = Math.round(canvas.width * 0.16);
    const offset = Math.round((canvas.width - size) / 2);
    canvas.getContext("2d").drawImage(emblem, offset, offset, size, size);
  } catch {
    // Keep the payment QR usable if the decorative emblem cannot load.
  }

  return canvas.toDataURL("image/png");
}

function createCheckoutRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function getSavedPlayerFields(gameSlug, fields) {
  if (!gameSlug || typeof window === "undefined") return {};

  try {
    const savedByGame = JSON.parse(window.localStorage.getItem(SAVED_PLAYER_FIELDS_KEY) || "{}");
    const savedFields = savedByGame?.[gameSlug];
    if (!savedFields || typeof savedFields !== "object" || Array.isArray(savedFields)) return {};

    return (fields || []).reduce((restored, field) => {
      const value = savedFields[field.fieldKey];
      if (typeof value === "string" && value.length > 0) restored[field.fieldKey] = value;
      return restored;
    }, {});
  } catch {
    return {};
  }
}

function savePlayerFields(gameSlug, fields, playerFields) {
  if (!gameSlug || typeof window === "undefined") return;

  const valuesToSave = (fields || []).reduce((saved, field) => {
    const value = playerFields[field.fieldKey];
    if (typeof value === "string" && value.trim().length > 0) saved[field.fieldKey] = value.trim();
    return saved;
  }, {});

  if (Object.keys(valuesToSave).length === 0) return;

  try {
    const existing = JSON.parse(window.localStorage.getItem(SAVED_PLAYER_FIELDS_KEY) || "{}");
    const savedByGame = existing && typeof existing === "object" && !Array.isArray(existing) ? existing : {};
    savedByGame[gameSlug] = valuesToSave;
    window.localStorage.setItem(SAVED_PLAYER_FIELDS_KEY, JSON.stringify(savedByGame));
  } catch {
    // Private browsing or a full storage quota should not block checkout.
  }
}

let khqrPluginPromise;

async function openProviderCheckout(checkoutUrl, onSuccess, onError, onClose) {
  if (!checkoutUrl) throw new Error("Payment checkout is unavailable. Please try again.");
  // KHQR PAY v2 provides its own secure hosted KHQR card. It is not compatible
  // with AnajakPay's browser plugin, so leave this page for that checkout.
  if (new URL(checkoutUrl, window.location.origin).hostname === "khqrpay.site") {
    window.location.assign(checkoutUrl);
    return;
  }
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
  showProviderCloseButton(onClose);
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
  const restoredPlayerSlugRef = useRef(null);
  const autoOpenedAbaPaymentRef = useRef(null);
  const checkoutRequestIdRef = useRef(null);

  // Dynamic player fields state
  const [playerFields, setPlayerFields] = useState({});
  const [isValidatingPlayer, setIsValidatingPlayer] = useState(false);
  const [verifiedPlayerName, setVerifiedPlayerName] = useState(null);
  const [playerCheckError, setPlayerCheckError] = useState(null);

  // Selected package
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState("KHQRPAY_ABA_V2");

  // Top-right toast alert when package selected (Matching LisaTopup screenshot)
  const [packageToast, setPackageToast] = useState(null);

  // Alert State (Explicit requirement: "select package alert")
  const [packageAlertMessage, setPackageAlertMessage] = useState(null);

  // Checkout submission
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [paymentErrorPopup, setPaymentErrorPopup] = useState(null);
  const [paymentNotice, setPaymentNotice] = useState(null);
  const [paymentSession, setPaymentSession] = useState(null);
  const [paymentSecondsLeft, setPaymentSecondsLeft] = useState(0);
  const [paymentQrDataUrl, setPaymentQrDataUrl] = useState("");
  const [isDownloadingQr, setIsDownloadingQr] = useState(false);
  const [qrDownloadError, setQrDownloadError] = useState("");
  const [successInvoice, setSuccessInvoice] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["gameDetail", slug],
    queryFn: () => fetchGameDetail(slug || ""),
    enabled: !!slug,
  });
  const { data: paymentOptions = [], isLoading: paymentOptionsLoading, error: paymentOptionsError } = useQuery({
    queryKey: ["paymentOptions"],
    queryFn: fetchPaymentOptions,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (paymentOptionsLoading) return;
    if (!paymentOptions.some((option) => option.id === paymentProvider)) {
      setPaymentProvider(paymentOptions[0]?.id || "");
    }
  }, [paymentOptions, paymentOptionsLoading, paymentProvider]);

  useEffect(() => {
    restoredPlayerSlugRef.current = null;
    setPackageToast(null);
    setPlayerFields({});
    setVerifiedPlayerName(null);
    setPlayerCheckError(null);
    setIsValidatingPlayer(false);
    setSelectedProduct(null);
    setPaymentErrorPopup(null);
    setPaymentNotice(null);
    setPaymentSession(null);
    setSuccessInvoice(null);
    checkoutRequestIdRef.current = null;
    return () => {
      clearTimeout(toastTimerRef.current);
      verificationSequenceRef.current += 1;
    };
  }, [slug]);

  useEffect(() => {
    const loadedGame = data?.game;
    if (!loadedGame?.slug || loadedGame.slug !== slug || restoredPlayerSlugRef.current === loadedGame.slug) return;
    restoredPlayerSlugRef.current = loadedGame.slug;
    setPlayerFields(getSavedPlayerFields(loadedGame.slug, loadedGame.fields));
  }, [data?.game, slug]);

  const showSuccessfulInvoice = useCallback(async (publicOrderId, status, lookupToken) => {
    closeProviderCheckout();
    try {
      const order = await fetchOrderDetail(publicOrderId, lookupToken);
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
        const status = await fetchOrderStatus(paymentSession.publicOrderId, paymentSession.lookupToken);
        if (status.paymentStatus === "PAID" ||
            ["PAID", "FULFILMENT_QUEUED", "PROCESSING", "DELIVERED"].includes(status.status)) {
          await showSuccessfulInvoice(paymentSession.publicOrderId, status.status, paymentSession.lookupToken);
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
        const status = await fetchOrderStatus(paymentSession.publicOrderId, paymentSession.lookupToken);
        if (cancelled) return;
        if (status.paymentStatus === "PAID" ||
            ["PAID", "FULFILMENT_QUEUED", "PROCESSING", "DELIVERED"].includes(status.status)) {
          clearInterval(timer);
          await showSuccessfulInvoice(paymentSession.publicOrderId, status.status, paymentSession.lookupToken);
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

  useEffect(() => {
    if (!paymentSession?.expiresAt) return;
    const update = () => setPaymentSecondsLeft(Math.max(0, Math.ceil((new Date(paymentSession.expiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [paymentSession]);

  useEffect(() => {
    let cancelled = false;
    setPaymentQrDataUrl("");
    if (!paymentSession?.qrString) return undefined;
    createBrandedPaymentQrDataUrl(paymentSession.qrString, 660)
      .then((url) => { if (!cancelled) setPaymentQrDataUrl(url); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [paymentSession?.qrString]);

  useEffect(() => {
    const abaAppDeepLink = getPaymentAbaDeepLink(paymentSession);
    if (!abaAppDeepLink || !isMobilePaymentDevice()) return;
    const sessionKey = `${paymentSession.paymentId || paymentSession.publicOrderId}:${abaAppDeepLink}`;
    if (autoOpenedAbaPaymentRef.current === sessionKey) return;
    autoOpenedAbaPaymentRef.current = sessionKey;

    // Let the QR modal render before handing off to ABA Mobile. It stays open
    // when the customer returns, so status polling and manual fallback remain.
    const timer = window.setTimeout(() => openAbaMobileApp(abaAppDeepLink), 250);
    return () => window.clearTimeout(timer);
  }, [paymentSession?.abaDeepLink, paymentSession?.paymentId, paymentSession?.publicOrderId, paymentSession?.qrString]);

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
    checkoutRequestIdRef.current = null;
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

  const usesThreeCatalogs = ["free-fire", "free-fire-khsgmy", "free-fire-kh", "pubg-mobile", "honor-of-kings", "hok", "delta-force", "blood-strike"].includes(game.slug);
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
    checkoutRequestIdRef.current = null;
    setSelectedProduct(product);
    setPackageAlertMessage(null);
    setSubmitError(null);

    // Match the confirmation text to the package name visible on the card.
    // Some legacy package names contain the purchase-limit label appended in Khmer;
    // the card renders that separately, so the toast should omit it as well.
    const displayName = product.name.replace(/[\u1780-\u17ff].*$/u, "").trim() || product.name;

    // Show top-right toast alert message matching user's screenshot: បានជ្រើសរើស: <displayName>
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setPackageToast({
      id: ++toastSequenceRef.current,
      displayName,
      iconUrl: product.iconUrl || game.logoUrl || "/placeholder.png",
    });
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
      setPackageAlertMessage("Please select a package name.");
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

    if (!paymentProvider) {
      setSubmitError("No ABA payment method is currently available. Please try again later.");
      return;
    }

    setIsSubmittingOrder(true);
    setSubmitError(null);
    setPaymentErrorPopup(null);
    setPaymentNotice(null);

    const showPaymentError = (message) => {
      setSubmitError(message);
      setPaymentErrorPopup(message);
    };

    try {
      if (!checkoutRequestIdRef.current) checkoutRequestIdRef.current = createCheckoutRequestId();
      const orderRes = await createOrder({
        gameSlug: game.slug,
        productId: selectedProduct.id,
        playerData: playerFields,
      }, checkoutRequestIdRef.current);

      let paymentRes;
      try {
        paymentRes = await initKhqrPayment(orderRes.publicOrderId, paymentProvider, orderRes.lookupToken);
      } catch (err) {
        showPaymentError(err.message || "Unable to generate the payment QR code. Please try again.");
        throw err;
      }

      if (paymentProvider === "KHQRPAY_ABA_V2") {
        // Display the KHQR PAY QR immediately in our checkout popup. The
        // modal polls the order status while the customer pays.
        setPaymentSession({ ...paymentRes, publicOrderId: orderRes.publicOrderId, lookupToken: orderRes.lookupToken });
      } else {
        try {
          await openProviderCheckout(
          paymentRes.checkoutUrl,
          async () => {
            closeProviderCheckout();
            try {
              const status = await fetchOrderStatus(orderRes.publicOrderId, orderRes.lookupToken);
              if (status.paymentStatus === "PAID" || ["PAID", "FULFILMENT_QUEUED", "PROCESSING", "DELIVERED"].includes(status.status)) {
                await showSuccessfulInvoice(orderRes.publicOrderId, status.status, orderRes.lookupToken);
              }
            } catch {
              // The existing 3-second poll remains authoritative and will retry.
            }
          },
          () => showPaymentError("Unable to open secure payment. Please try again."),
          () => {
            setPaymentSession(null);
            setPaymentNotice(null);
          }
          );
        } catch (err) {
          showPaymentError(err.message || "Unable to open secure payment. Please try again.");
          throw err;
        }
        setPaymentSession({ ...paymentRes, publicOrderId: orderRes.publicOrderId, lookupToken: orderRes.lookupToken });
      }
      savePlayerFields(game.slug, game.fields, playerFields);

    } catch (err) {
      setSubmitError(err.message || "ការបញ្ជាទិញមានបញ្ហា។ សូមព្យាយាមម្តងទៀត!");
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleDownloadPaymentQr = async () => {
    if (!paymentSession?.qrString || isDownloadingQr) return;
    setIsDownloadingQr(true);
    setQrDownloadError("");
    try {
      const dataUrl = await createBrandedPaymentQrDataUrl(paymentSession.qrString, 800);
      const fileName = `KHQR_${paymentSession.publicOrderId}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      if (isAppleMobile && typeof navigator.share === "function") {
        const file = new File([blob], fileName, { type: "image/png" });
        if (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: fileName });
          return;
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (error?.name !== "AbortError") setQrDownloadError("Could not save the QR. Please try again.");
    } finally {
      setIsDownloadingQr(false);
    }
  };

  const handleClosePaymentQr = () => {
    if (!window.confirm("Are you sure you want to close?")) return;
    setPaymentSession(null);
    setPaymentNotice(null);
  };

  return (
    <div className="game-detail-page w-full min-w-0 max-w-6xl mx-auto space-y-5 sm:space-y-6 pb-28 lg:pb-12">
      <SuccessInvoiceModal
        order={successInvoice?.order}
        status={successInvoice?.status}
        onClose={() => {
          setSuccessInvoice(null);
          navigate("/");
        }}
      />
      {!!paymentSession && paymentProvider === "KHQRPAY_ABA_V2" && (
        <div className="khqr-payway-overlay" role="presentation" onClick={(event) => {
          if (event.target.closest(".khqr-payway-dialog")) return;
          handleClosePaymentQr();
        }}>
          <div className="khqr-payway-shell">
            <div className="khqr-payway-brand" aria-hidden="true">ABA&apos; <strong>PAYWAY</strong></div>
            <section role="dialog" aria-modal="true" aria-label="ABA KHQR payment" className="khqr-payway-dialog" onClick={(event) => {
              if (event.target === event.currentTarget) handleClosePaymentQr();
            }}>
              <header className="khqr-payway-heading">
                <h2>ABA KHQR</h2>
                <span className="khqr-payway-mobile-handle" aria-hidden="true" />
                <span className="khqr-payway-mobile-mark" aria-hidden="true">KHQR</span>
                <span className="khqr-payway-countdown" aria-live="off">
                  <Loader2 size={25} aria-hidden="true" />
                  {String(Math.floor(paymentSecondsLeft / 60)).padStart(2, "0")}:{String(paymentSecondsLeft % 60).padStart(2, "0")}
                </span>
                <button type="button" onClick={handleClosePaymentQr} aria-label="Close payment" className="khqr-payway-close"><X size={22} strokeWidth={1.7} /></button>
              </header>
              <div className="khqr-payway-ticket">
                <div className="khqr-payway-ticket-header"><span>KHQR</span></div>
                <div className="khqr-payway-ticket-body">
                  <div className="khqr-payway-summary">
                    <div className="khqr-payway-summary-text">
                      <div className="khqr-payway-merchant">{paymentSession.merchantName || "NA TOPUP"}</div>
                      <div className="khqr-payway-amount">{Number(paymentSession.amount || 0).toFixed(2)} <span>USD</span></div>
                    </div>
                    <span className="khqr-payway-mobile-countdown" aria-live="off">
                      <Loader2 size={25} aria-hidden="true" />
                      {String(Math.floor(paymentSecondsLeft / 60)).padStart(2, "0")}:{String(paymentSecondsLeft % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="khqr-payway-perforation" aria-hidden="true" />
                  <div className="khqr-payway-qr">
                    {(paymentQrDataUrl || paymentSession.qrImageUrl) ? <img src={paymentQrDataUrl || paymentSession.qrImageUrl} onError={(event) => { if (paymentSession.qrImageUrl && event.currentTarget.src !== paymentSession.qrImageUrl) event.currentTarget.src = paymentSession.qrImageUrl; }} alt="ABA KHQR payment QR code" /> : <span>Loading payment QR…</span>}
                  </div>
                  <div className="khqr-payway-mobile-actions">
                    <strong>Scan to Pay</strong>
                    <span>or</span>
                    <button type="button" onClick={handleDownloadPaymentQr} disabled={isDownloadingQr}>
                      <Download size={19} aria-hidden="true" /> {isDownloadingQr ? "Preparing QR…" : "Download QR"}
                    </button>
                    <p>and upload to Mobile Banking app<br /> supporting KHQR</p>
                    {qrDownloadError && <p className="khqr-payway-download-error" role="alert">{qrDownloadError}</p>}
                  </div>
                </div>
              </div>
              <p className="khqr-payway-instruction">Scan with ABA Mobile, or other Mobile Banking App supporting KHQR</p>
            </section>
          </div>
        </div>
      )}

      {paymentErrorPopup && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation">
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="payment-error-title"
            aria-describedby="payment-error-message"
            className="w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 text-center shadow-2xl"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertCircle className="h-8 w-8" aria-hidden="true" />
            </div>
            <h2 id="payment-error-title" className="font-heading text-xl font-bold text-slate-900">Payment error</h2>
            <p id="payment-error-message" className="mt-2 break-words text-sm text-slate-600">{paymentErrorPopup}</p>
            <button
              type="button"
              onClick={() => setPaymentErrorPopup(null)}
              className="mt-6 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-red-700"
            >
              Try again
            </button>
          </section>
        </div>
      )}

      <Link
        to="/"
        className="game-detail-back -mx-4 -mt-6 flex h-10 items-center gap-1.5 border-l-2 px-2.5 font-kulen text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet sm:mx-0 sm:mt-0 sm:rounded-xl"
        aria-label="ត្រឡប់ក្រោយទៅទំព័រដើម"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>ត្រឡប់ក្រោយ</span>
      </Link>

      {/* SELECT PACKAGE ALERT BANNER */}
      {packageAlertMessage && (
        <div className="game-detail-alert animate-in slide-in-from-top-3 duration-200 p-4 rounded-2xl border-2 flex items-center justify-between shadow-lg font-kulen">
          <div className="flex items-center gap-3">
            <div className="game-detail-alert-icon w-9 h-9 rounded-xl text-white flex items-center justify-center flex-shrink-0 shadow-sm animate-bounce">
              <Gem className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-sm">មិនទាន់បានជ្រើសរើសកញ្ចប់!</h4>
              <p className="text-xs font-medium opacity-90">{packageAlertMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setPackageAlertMessage(null)}
            className="p-1.5 rounded-lg hover:bg-white/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Top-Right Selected Package Toast Alert (Solid Brand Violet, No Gradient) */}
      {packageToast && (
        <div key={packageToast.id} role="status" aria-live="polite" className="fixed top-16 sm:top-20 right-3 sm:right-6 max-w-[calc(100vw-1.5rem)] z-[9999] animate-popup-bounce-in">
          <div className="game-detail-toast relative overflow-hidden text-white px-4 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 backdrop-blur-md animate-popup-glow">
            {/* White Circle with Violet Check Icon (Animated Pop) */}
            <div className="relative z-10 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white text-brand-violet flex items-center justify-center flex-shrink-0 shadow-sm font-bold text-xs animate-check-pop">
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
            </div>
            <img
              src={packageToast.iconUrl}
              alt=""
              className="relative z-10 h-9 w-9 shrink-0 rounded-lg bg-white/15 object-contain p-0.5 drop-shadow-md sm:h-11 sm:w-11 sm:rounded-xl"
            />
            <span className="relative z-10 min-w-0 flex-1 font-kulen text-xs font-bold leading-tight tracking-wide drop-shadow-xs sm:text-sm">
              <span className="block text-[9px] font-normal text-white/80 sm:text-[11px]">បានជ្រើសរើស</span>
              <span className="mt-0.5 block break-words font-extrabold">{packageToast.displayName}</span>
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

      {/* Game banner follows the same responsive frame and artwork ratio as the home banner. */}
      <div className="game-detail-hero group relative w-full overflow-hidden rounded-2xl border border-[#A2AB73]/35 bg-[#FFF3CC] shadow-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow sm:rounded-3xl">
        <div className="relative z-10 aspect-[1500/767] w-full overflow-hidden rounded-[inherit] bg-brand-surface">
          <img
            src={game.bannerUrl || game.logoUrl || "/placeholder.png"}
            alt={game.name || "Game Banner"}
            className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.015]"
          />
          {/* Subtle gradient overlay for readability and depth */}
          <div className="game-detail-hero-overlay absolute inset-0 pointer-events-none" />

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
                <span className="game-detail-category text-white text-[11px] sm:text-xs font-bold px-2.5 py-0.5 rounded-full shadow-xs">
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
          <div className="game-detail-card rounded-2xl sm:rounded-3xl overflow-hidden shadow-card border bg-white lg:sticky lg:top-20 transition-all">
            {/* Header Ribbon: Solid Brand Violet */}
            <div className="game-detail-card-header text-white px-5 py-3.5 font-kulen font-bold text-sm sm:text-base flex items-center justify-between shadow-sm">
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
              <div className="game-detail-soft-panel flex items-center gap-3 p-3 rounded-2xl border">
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
              <div className="game-detail-soft-panel space-y-1.5 p-3 rounded-2xl border">
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
              <div className="game-detail-soft-panel space-y-1.5 p-3 rounded-2xl border">
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

              {/* Choose the payment provider before creating the payment. */}
              <div className="space-y-2">
              {paymentOptions.map((option) => (
                <button type="button" key={option.id} onClick={() => setPaymentProvider(option.id)} className={`game-detail-payment flex w-full items-center justify-between p-3.5 rounded-2xl border-2 shadow-xs ${paymentProvider === option.id ? "ring-2 ring-brand-violet" : "opacity-75"}`}>
                  <div className="flex items-center gap-3">
                    <img src="/aba-khqr.svg" alt="ABA KHQR" className="w-10 h-10 rounded-xl object-contain shadow-xs flex-shrink-0 bg-white" />
                    <div className="text-left">
                      <h4 className="font-heading font-bold text-sm text-[#005E7B] leading-tight">{option.displayName}</h4>
                      <p className="mt-0.5 text-[11px] font-medium leading-tight text-[#2E79A6]">Scan to pay with any banking app</p>
                    </div>
                  </div>
                  {paymentProvider === option.id && <div className="w-5 h-5 rounded-full bg-[#005E7B] text-white flex items-center justify-center shadow-xs flex-shrink-0"><Check className="w-3.5 h-3.5 stroke-[3]" /></div>}
                </button>
              ))}
              {paymentOptionsLoading && <div className="rounded-xl border border-brand-border bg-white p-3 text-xs text-brand-muted">Loading ABA payment options…</div>}
              {!paymentOptionsLoading && !paymentOptions.length && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">{paymentOptionsError?.message || "No ABA payment method is currently active."}</div>}
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
                disabled={isSubmittingOrder || !paymentProvider}
                className="game-detail-primary-button hidden w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-kulen text-sm font-bold text-white shadow-md transition-all hover:shadow-lg active:scale-98 lg:flex cursor-pointer"
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
            className="game-detail-card rounded-2xl sm:rounded-3xl overflow-hidden shadow-card border bg-white"
          >
            {/* Solid Brand Violet Top Header Ribbon (No Gradient) */}
            <div className="game-detail-card-header text-white px-5 py-3 font-kulen font-bold text-sm sm:text-base flex items-center gap-2.5 shadow-sm">
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
                      className="game-detail-input w-full px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 font-medium tracking-wide"
                    />
                  </div>
                ))}

                {/* Solid Brand Violet "ពិនិត្យ ឈ្មោះ" Check Name Button */}
                <div className="sm:col-span-4">
                  <button
                    type="button"
                    onClick={handleValidatePlayer}
                    disabled={isValidatingPlayer}
                    className="game-detail-primary-button w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-kulen font-bold text-white shadow-soft hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
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
            className={`game-detail-card rounded-2xl sm:rounded-3xl overflow-hidden shadow-card border bg-white transition-all ${
              packageAlertMessage ? "border-brand-violet ring-2 ring-brand-violet/40" : "border-brand-border"
            }`}
          >
            {/* Solid Brand Violet Top Header Ribbon */}
            <div className="game-detail-card-header text-white px-5 py-3 font-kulen font-bold text-sm sm:text-base flex items-center justify-between shadow-sm">
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
                    className="game-detail-group-title mb-3 border-b pb-3 text-sm sm:text-base font-heading font-bold"
                  >
                    {group.title}
                  </h3>
                  {group.products.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
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
            disabled={isSubmittingOrder || !paymentProvider}
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
