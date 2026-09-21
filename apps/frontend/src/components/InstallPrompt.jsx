import React, { useState, useEffect } from "react";
import { X, Share, PlusSquare } from "lucide-react";

export const InstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // Check if user previously dismissed in this session
    const dismissed = sessionStorage.getItem("install_prompt_dismissed");
    if (dismissed) return;

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Check if already in standalone / installed PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      return; // Already installed
    }

    // Handle standard PWA install prompt (Chrome, Edge, Android, etc.)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // For iOS or browsers where beforeinstallprompt doesn't fire, show prompt after a short delay
    const timer = setTimeout(() => {
      if (!isStandalone && !dismissed) {
        setIsVisible(true);
      }
    }, 1200);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Trigger native browser install prompt
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsVisible(false);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      // Show iOS instruction popup
      setShowIosGuide(true);
    } else {
      // General fallback guide
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem("install_prompt_dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Floating Install Banner matching clone design */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-[420px] transition-all duration-300 animate-in fade-in slide-in-from-bottom-5">
        <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-100/90 p-3 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 backdrop-blur-md">
          {/* Left: App Logo */}
          <div className="w-12 h-12 rounded-xl overflow-hidden shadow-xs flex-shrink-0 bg-black/5 border border-amber-400/60 p-0.5">
            <img
              src="/na-topup-logo.png"
              alt="NA TOPUP App Logo"
              className="w-full h-full object-cover rounded-lg"
            />
          </div>

          {/* Middle: Title & Subtitle */}
          <div className="min-w-0 flex-1 pr-1">
            <h4 className="font-heading font-extrabold text-sm sm:text-base text-gray-900 tracking-tight leading-snug">
              Install NA TOPUP
            </h4>
            <p className="text-[11px] sm:text-xs text-gray-500 font-medium leading-tight mt-0.5">
              Add to your home screen for faster access.
            </p>
          </div>

          {/* Right: Install Pill Button & Close Button */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-4 py-2 rounded-xl bg-[#FF2A85] hover:bg-[#e01e71] text-white font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer select-none"
            >
              Install
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              aria-label="Close Install Prompt"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS / Fallback Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-100 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-xs border border-amber-400/60 bg-black/5 p-0.5">
                  <img src="/na-topup-logo.png" alt="NA TOPUP" className="w-full h-full object-cover rounded-lg" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-gray-900">
                    ដំឡើង NA TOPUP
                  </h3>
                  <p className="text-[11px] text-gray-500 font-medium">លើទូរស័ព្ទដៃ (Mobile Phone)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded-full bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-gray-700 bg-[#F9F7FC] p-3.5 rounded-xl border border-purple-100/60">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-violet text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  1
                </span>
                <p>
                  ចុចលើប៊ូតុងចែករំលែក <strong>Share</strong> (<Share className="w-3.5 h-3.5 inline text-blue-500 mx-0.5" />) នៅផ្នែកខាងក្រោមនៃ Browser។
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-violet text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  2
                </span>
                <p>
                  រំកិលចុះក្រោម រួចជ្រើសរើសយក <strong>Add to Home Screen</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-purple-600 mx-0.5" /> <strong>បន្ថែមទៅអេក្រង់ដើម</strong>)។
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-brand-violet text-white font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                  3
                </span>
                <p>
                  ចុច <strong>Add (បន្ថែម)</strong> នៅជ្រុងខាងលើស្ដាំ ជាការស្រេច!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="w-full py-2.5 rounded-xl bg-brand-violet text-white font-bold text-xs shadow-md active:scale-95 transition-all"
            >
              យល់ព្រម (OK)
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallPrompt;
