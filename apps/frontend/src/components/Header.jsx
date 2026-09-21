import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { NavbarSearch } from "./NavbarSearch";
import {
  Gamepad2,
  Menu,
  X,
  Home,
  Send,
  Mail,
  ChevronRight,
} from "lucide-react";

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-200 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md shadow-soft border-b border-brand-border"
            : "bg-white/85 backdrop-blur-sm border-b border-brand-border/60"
        }`}
      >
        <div className="max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-3 md:flex-nowrap md:gap-x-6">
            {/* Left: Brand Logo */}
            <div className="flex h-20 shrink-0 items-center sm:h-24">
              {/* Animated Logo & Text */}
              <Link to="/" className="na-brand flex items-center gap-2.5 sm:gap-3 group select-none">
                {/* Logo Box with NA TOPUP Emblem (Transparent, No Background) */}
                <div className="na-brand-emblem relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 flex items-center justify-center">
                  <img
                    src="/na-topup-logo.png"
                    alt="NA TOPUP Logo"
                    className="w-full h-full object-contain animate-logo-box"
                  />
                </div>

                {/* Logo Text */}
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-[#30213f]">
                    NA
                  </span>
                  <span className="na-brand-word font-heading font-extrabold text-2xl sm:text-3xl tracking-tight">
                    TOPUP
                  </span>
                </div>
              </Link>
            </div>

            <NavbarSearch />

            {/* Right Action: Telegram Icon on Mobile / Full Button on Desktop + Responsive Hamburger Menu Button */}
            <div className="flex items-center gap-2 sm:gap-3">
              <a
                href="https://t.me/LukasTopupSupport"
                target="_blank"
                rel="noopener noreferrer"
                className="navbar-contact flex shrink-0 items-center justify-center gap-2 rounded-2xl p-2 md:px-4 md:py-2.5"
                title="ទំនាក់ទំនង Telegram"
                aria-label="ទំនាក់ទំនង Telegram"
              >
                <Send className="h-5 w-5" aria-hidden="true" />

                {/* Text: Hidden on mobile (icon only), shown on desktop */}
                <span className="hidden md:inline relative z-10 text-xs sm:text-sm font-kulen font-bold tracking-tight text-[#2489b6] pr-0.5 whitespace-nowrap">
                  ទាក់ទង Telegram
                </span>
              </a>

              {/* Responsive Hamburger Menu Button on Mobile */}
              <button
                type="button"
                onClick={() => setIsMenuOpen(true)}
                className="p-2 rounded-xl text-gray-700 hover:text-brand-violet hover:bg-brand-violet/10 transition-all active:scale-90 md:hidden cursor-pointer flex-shrink-0"
                aria-label="បើកម៉ឺនុយ"
                title="ម៉ឺនុយ"
              >
                <Menu className="w-6 h-6 stroke-[2.3]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* RESPONSIVE DRAWER BACKDROP (Dark blur overlay) */}
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden ${
          isMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* RESPONSIVE MENU DRAWER: SLIDE IN FROM RIGHT */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-[290px] sm:w-80 bg-white shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-out transform md:hidden ${
          isMenuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Mobile Navigation"
      >
        {/* Drawer Top Header & Navigation Links */}
        <div>
          {/* Header Inside Drawer */}
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-[#FBF9FD]">
            <Link
              to="/"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-2.5"
            >
              <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
                <img
                  src="/na-topup-logo.png"
                  alt="NA TOPUP"
                  className="w-full h-full object-contain filter drop-shadow-sm"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="font-heading font-extrabold text-lg text-gray-900">NA</span>
                <span className="font-heading font-extrabold text-lg text-brand-violet">TOPUP</span>
              </div>
            </Link>

            {/* Close X Button */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(false)}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 flex items-center justify-center transition-all cursor-pointer active:scale-90"
              aria-label="បិទម៉ឺនុយ"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links with Kulen Font */}
          <nav className="p-3 sm:p-4 space-y-1.5 font-kulen">
            <Link
              to="/"
              onClick={() => setIsMenuOpen(false)}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm transition-all ${
                location.pathname === "/"
                  ? "bg-brand-violet text-white shadow-sm font-bold"
                  : "text-gray-700 hover:bg-gray-50 hover:text-brand-violet font-medium"
              }`}
            >
              <div className="flex items-center gap-3">
                <Home className="w-4 h-4" />
                <span>ទំព័រដើម</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-70" />
            </Link>
          </nav>
        </div>

        {/* Drawer Bottom Action: Contacts & Follow Us (matching user screenshot) */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-[#FAF8FC] space-y-4 font-kulen">
          {/* Section 1: តាមដានយើង (Follow Us) */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-sm text-[#1C172B] tracking-wide">
              តាមដានយើង
            </h4>
            <div className="flex items-center gap-3">
              {/* Telegram Channel */}
              <a
                href="https://t.me/LukasTopupSupport"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-icon contact-icon--telegram"
                title="Telegram Channel"
                aria-label="Telegram Channel"
              >
                <Send className="w-4 h-4 -translate-x-0.5 translate-y-0.5" />
              </a>

              {/* Facebook Page */}
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-icon contact-icon--facebook"
                title="Facebook"
                aria-label="Facebook"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Section 2: ទាក់ទងមកយើង (Contact Us) */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-sm text-[#1C172B] tracking-wide">
              ទាក់ទងមកយើង
            </h4>
            <div className="flex items-center gap-3">
              {/* Telegram Support */}
              <a
                href="https://t.me/LukasTopupSupport"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-icon contact-icon--telegram"
                title="Telegram Support"
                aria-label="Telegram Support"
              >
                <Send className="w-4 h-4 -translate-x-0.5 translate-y-0.5" />
              </a>

              {/* Email Support */}
              <a
                href="mailto:support@lukastopup.com"
                className="contact-icon contact-icon--email"
                title="Email Support"
                aria-label="Email Support"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Slogan */}
          <div className="pt-2 text-center border-t border-gray-100">
            <p className="text-[11px] text-gray-500 font-medium">
              NA TOPUP — សេវាកម្មបញ្ចូលហ្គេមរហ័ស 24 ម៉ោង
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
