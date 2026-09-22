import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Receipt,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { fetchOrderDetail, fetchOrderStatus } from "../services/api";
import { OrderTimeline } from "../components/OrderTimeline";
import { SuccessInvoiceModal } from "../components/SuccessInvoiceModal";

export const CheckOrderPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialOrderId = searchParams.get("orderId") || "";

  const [orderCode, setOrderCode] = useState(initialOrderId);
  const [isLoading, setIsLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [error, setError] = useState(null);

  const getKhmerStatus = (status, defaultText) => {
    switch (status) {
      case "AWAITING_PAYMENT":
        return "រង់ចាំការទូទាត់ប្រាក់";
      case "PAYMENT_VERIFYING":
        return "កំពុងផ្ទៀងផ្ទាត់ការទូទាត់...";
      case "PAID":
      case "FULFILMENT_QUEUED":
        return "បានទទួលការទូទាត់ជោគជ័យ";
      case "PROCESSING":
        return "កំពុងដំណើរការបញ្ចូលពេជ្រ";
      case "DELIVERED":
        return "ជោគជ័យរួចរាល់";
      case "FAILED":
        return "ការបញ្ជាទិញបរាជ័យ";
      case "EXPIRED":
        return "ផុតកំណត់ការទូទាត់";
      case "REVIEW_REQUIRED":
        return "ក្រុមការងារកំពុងត្រួតពិនិត្យ";
      case "REFUNDED":
        return "បានសងប្រាក់វិញ";
      case "CANCELLED":
        return "បានបោះបង់";
      default:
        return defaultText || "កំពុងដំណើរការ";
    }
  };

  const mapTimelineTitle = (title) => {
    switch (title) {
      case "Order Created":
        return "បានបង្កើតការបញ្ជាទិញ";
      case "Payment Received":
        return "បានទទួលការទូទាត់ប្រាក់";
      case "Processing Delivery":
        return "កំពុងដំណើរការបញ្ចូលពេជ្រ";
      case "Delivered to Account":
        return "បានបញ្ចូលជោគជ័យទៅក្នុងគណនី";
      default:
        return title;
    }
  };

  const loadOrder = async (codeToSearch) => {
    if (!codeToSearch || !codeToSearch.trim()) return;
    const cleanCode = codeToSearch.trim().toUpperCase();

    setIsLoading(true);
    setError(null);

    try {
      const [detail, status] = await Promise.all([
        fetchOrderDetail(cleanCode),
        fetchOrderStatus(cleanCode),
      ]);
      setOrderData(detail);
      setStatusData(status);
      setSearchParams({ orderId: cleanCode });
    } catch (err) {
      setError(err.message || "រកមិនឃើញការបញ្ជាទិញនេះទេ។ សូមពិនិត្យមើលលេខកូដបញ្ជាទិញរបស់អ្នកឡើងវិញ!");
      setOrderData(null);
      setStatusData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrderId) {
      loadOrder(initialOrderId);
    }
  }, [initialOrderId]);

  // Auto-refresh order status while in non-terminal state
  useEffect(() => {
    if (!orderData || !statusData || statusData.isTerminal) return;

    const interval = setInterval(async () => {
      try {
        const updatedStatus = await fetchOrderStatus(orderData.publicOrderId);
        setStatusData(updatedStatus);
      } catch {
        // Retry
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [orderData, statusData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    loadOrder(orderCode);
  };

  const localizedTimeline = statusData?.timeline?.map((item) => ({
    ...item,
    title: mapTimelineTitle(item.title),
  }));
  const liveStatus = statusData?.status || orderData?.status;
  const paymentConfirmed =
    statusData?.paymentStatus === "PAID" ||
    ["PAID", "FULFILMENT_QUEUED", "PROCESSING", "DELIVERED"].includes(liveStatus);

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10 space-y-8">
      <SuccessInvoiceModal
        order={paymentConfirmed ? orderData : null}
        status={liveStatus}
        onClose={() => navigate("/")}
      />

      {/* Page Heading */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-violet/10 text-brand-violet text-xs font-semibold">
          <Receipt className="w-3.5 h-3.5" />
          <span>តាមដានស្ថានភាពផ្ទាល់</span>
        </div>
        <h1 className="font-heading font-bold text-2xl sm:text-3xl text-brand-text">
          ពិនិត្យស្ថានភាពការបញ្ជាទិញ
        </h1>
        <p className="text-xs sm:text-sm text-brand-muted max-w-md mx-auto">
          សូមបញ្ចូលលេខកូដបញ្ជាទិញរបស់អ្នក (ឧ. <span className="font-mono font-semibold text-brand-text">TP-XXXXXXXX</span>) ដើម្បីតាមដានការទូទាត់ និងការបញ្ចូលពេជ្រជាក់ស្តែង។
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSubmit} className="relative max-w-xl mx-auto flex flex-col min-[430px]:flex-row min-[430px]:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            placeholder="បញ្ចូលលេខកូដបញ្ជាទិញ (ឧ. TP-8K9F2A1M)"
            className="w-full pl-10 pr-4 py-3 rounded-button text-sm bg-brand-surface border border-brand-border focus:border-brand-violet focus:outline-none focus:ring-2 focus:ring-brand-violet/20 font-mono tracking-wide"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !orderCode.trim()}
          className="gradient-button w-full min-[430px]:w-auto justify-center text-white px-6 py-3 rounded-button font-semibold text-sm shadow-soft hover:opacity-95 active:scale-98 transition-all flex items-center gap-2"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "ស្វែងរក"}
        </button>
      </form>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-brand-danger/10 border border-brand-danger/20 rounded-2xl flex items-center gap-3 text-brand-danger text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Order Status Display Card */}
      {orderData && statusData && (
        <div className="bg-brand-surface rounded-2xl sm:rounded-3xl border border-brand-border p-6 sm:p-8 shadow-card space-y-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-brand-border gap-4">
            <div>
              <span className="text-[11px] text-brand-muted uppercase tracking-wider block">
                លេខកូដបញ្ជាទិញ
              </span>
              <h2 className="font-heading font-extrabold text-2xl text-brand-text font-mono">
                {orderData.publicOrderId}
              </h2>
            </div>

            {/* Customer Friendly Status Pill */}
            <div className="flex items-center gap-2">
              <span
                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                  liveStatus === "DELIVERED"
                    ? "bg-brand-success/15 text-brand-success"
                    : liveStatus === "PROCESSING" || liveStatus === "PAID" || liveStatus === "FULFILMENT_QUEUED"
                    ? "bg-brand-blue/15 text-brand-blue"
                    : liveStatus === "FAILED" || liveStatus === "EXPIRED"
                    ? "bg-brand-danger/15 text-brand-danger"
                    : "bg-brand-warning/15 text-brand-warning"
                }`}
              >
                {liveStatus === "DELIVERED" ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                <span>{getKhmerStatus(liveStatus, statusData.customerStatusText)}</span>
              </span>

              <button
                onClick={() => loadOrder(orderData.publicOrderId)}
                title="ផ្ទុកឡើងវិញ"
                className="p-2 rounded-lg bg-brand-bg hover:bg-brand-violet/10 text-brand-violet transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Visual Step Timeline */}
          <div className="bg-brand-bg/60 p-5 rounded-2xl border border-brand-border/70">
            <h3 className="font-heading font-semibold text-xs uppercase text-brand-muted tracking-wider mb-2">
              ដំណើរការនៃការដឹកជញ្ជូន
            </h3>
            <OrderTimeline timeline={localizedTimeline || statusData.timeline} status={liveStatus} />
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-brand-bg border border-brand-border space-y-1.5">
              <span className="text-brand-muted block">ហ្គេម & កញ្ចប់</span>
              <span className="font-semibold text-sm text-brand-text block">
                {orderData.game.name}
              </span>
              <span className="text-brand-violet font-medium block">
                {orderData.product.name} ({orderData.product.amount})
              </span>
            </div>

            <div className="p-4 rounded-xl bg-brand-bg border border-brand-border space-y-1.5">
              <span className="text-brand-muted block">គណនីហ្គេម</span>
              <span className="font-semibold text-sm text-brand-text block font-mono">
                ID: {orderData.playerId} {orderData.serverId ? `(Server: ${orderData.serverId})` : ""}
              </span>
              {orderData.playerName && (
                <span className="text-brand-success font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {orderData.playerName}
                </span>
              )}
            </div>

            <div className="p-4 rounded-xl bg-brand-bg border border-brand-border space-y-1.5">
              <span className="text-brand-muted block">ចំនួនទឹកប្រាក់ទូទាត់ (KHQR)</span>
              <span className="font-heading font-extrabold text-base text-brand-rose block">
                ${orderData.total.toFixed(2)} USD
              </span>
            </div>

            <div className="p-4 rounded-xl bg-brand-bg border border-brand-border space-y-1.5">
              <span className="text-brand-muted block">កាលបរិច្ឆេទ</span>
              <span className="text-brand-text block">
                បានបង្កើត៖ {new Date(orderData.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {orderData.paidAt && (
                <span className="text-brand-success block">
                  បានបង់ប្រាក់៖ {new Date(orderData.paidAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>

          <div className="pt-2 text-center text-xs text-brand-muted">
            ត្រូវការជំនួយលើការបញ្ជាទិញនេះមែនទេ? ទាក់ទងសេវាអតិថិជន 24/7 តាម Telegram ៖{" "}
            <a
              href="https://t.me/LukasTopupSupport"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-violet font-semibold hover:underline"
            >
              @LukasTopupSupport
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
