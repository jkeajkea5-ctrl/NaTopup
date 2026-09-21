import React from "react";
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
  const minimalRoute = adminRoute || paymentReturnRoute;
  return (
    <>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col bg-transparent text-brand-text font-sans overflow-x-hidden">
          {!minimalRoute && <Header />}
          <main className={minimalRoute ? "flex-1 w-full" : "flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"}>
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
