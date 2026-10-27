import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { ScrollToTop } from "./components/ScrollToTop";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HomePage } from "./pages/HomePage";
import { GameDetailPage } from "./pages/GameDetailPage";
import { CheckOrderPage } from "./pages/CheckOrderPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminGate } from "./pages/AdminGate";
import { SupportPage } from "./pages/SupportPage";
import { PaymentReturnPage } from "./pages/PaymentReturnPage";
import { FloatingSupportButton } from "./components/FloatingSupportButton";
import { InstallPrompt } from "./components/InstallPrompt";
import { MotionEffects } from "./components/MotionEffects";
import { fetchSiteStatus } from "./services/api";
import { Wrench } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppFrame() {
  const { pathname } = useLocation();
  const adminRoute = pathname.startsWith("/admin");
  const paymentReturnRoute = pathname === "/payment-return";
  const existingOrderRoute = pathname === "/check-order";
  const minimalRoute = adminRoute || paymentReturnRoute;
  const maintenanceExempt = adminRoute || paymentReturnRoute || existingOrderRoute;
  const [maintenance, setMaintenance] = useState(false);
  const [statusChecked, setStatusChecked] = useState(maintenanceExempt);

  useEffect(() => {
    if (maintenanceExempt) {
      setStatusChecked(true);
      return undefined;
    }
    let active = true;
    async function refreshStatus() {
      try {
        const status = await fetchSiteStatus();
        if (active) setMaintenance(status.maintenance);
      } catch {
        if (active) setMaintenance(false);
      } finally {
        if (active) setStatusChecked(true);
      }
    }
    setStatusChecked(false);
    refreshStatus();
    const timer = window.setInterval(refreshStatus, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [maintenanceExempt]);

  if (!maintenanceExempt && (!statusChecked || maintenance)) {
    return <main className="maintenance-page">
      <div className="maintenance-card">
        <img src="/na-topup-icon-2026.png?v=20260924" alt="NA TOPUP" />
        {statusChecked ? <>
          <span className="maintenance-icon"><Wrench aria-hidden="true" /></span>
          <p className="maintenance-kicker">Scheduled maintenance</p>
          <h1>We’ll be back soon</h1>
          <p>NA TOPUP is temporarily unavailable while we make improvements. Please try again shortly.</p>
          <button type="button" onClick={() => window.location.reload()}>Check again</button>
        </> : <p className="maintenance-loading">Checking store availability…</p>}
      </div>
    </main>;
  }
  return (
    <>
      <ScrollToTop />
      <MotionEffects disabled={minimalRoute} />
      <div className="app-shell min-h-screen flex flex-col bg-transparent text-brand-text font-sans overflow-x-hidden">
          {!minimalRoute && <Header />}
          <main className={minimalRoute ? "flex-1 w-full min-w-0" : "app-main flex-1 min-w-0 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8"}>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/game/:slug" element={<GameDetailPage />} />
                <Route path="/check-order" element={<CheckOrderPage />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminGate><AdminDashboard /></AdminGate>} />
                <Route path="/admin/*" element={<AdminGate><AdminDashboard /></AdminGate>} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/payment-return" element={<PaymentReturnPage />} />
              </Routes>
            </ErrorBoundary>
          </main>
          {!minimalRoute && <Footer />}
          {!minimalRoute && <FloatingSupportButton />}
          {!minimalRoute && <InstallPrompt />}
        </div>
    </>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppFrame />
      </Router>
    </QueryClientProvider>
  );
}

export default App;
