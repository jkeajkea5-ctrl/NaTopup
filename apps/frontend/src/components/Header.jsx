import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Mail, Menu, Phone, Send, X } from "lucide-react";
import { NavbarSearch } from "./NavbarSearch";

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.1 8.3V6.6c0-.8.5-1 1-1h2.6V1.2L14.1 1C10.5 1 8.8 3.2 8.8 6.2v2.1H6.3v5h2.5V23h5.3v-9.7h3.5l.6-5h-4.1Z" /></svg>
);
const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.8 2c.3 2.2 1.5 3.6 3.8 3.8v4a10 10 0 0 1-3.7-.9v7.2a7 7 0 1 1-6-6.9v4.1a3 3 0 1 0 2 2.8V2h3.9Z" /></svg>
);
const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" /></svg>
);

const RailLink = ({ href, label, className, children }) => (
  <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className={`mobile-rail-link ${className || ""}`} aria-label={label} title={label}>
    {children}
  </a>
);

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const closeButtonRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 15);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => setIsMenuOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    if (isMenuOpen) closeButtonRef.current?.focus();
    const handleKeyDown = (event) => event.key === "Escape" && setIsMenuOpen(false);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <>
      <header className={`sticky top-0 z-40 border-b transition-all duration-200 ${isScrolled ? "border-brand-border bg-white/95 shadow-soft backdrop-blur-md" : "border-brand-border/60 bg-white/85 backdrop-blur-sm"}`}>
        <div className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-x-2 sm:gap-x-4 lg:flex-nowrap lg:gap-x-6">
            <div className="flex h-[68px] shrink-0 items-center sm:h-20 lg:h-24">
              <Link to="/" className="na-brand group flex min-w-0 select-none items-center" aria-label="NA TOPUP home">
                <div className="na-brand-emblem relative flex h-16 w-16 shrink-0 items-center justify-center sm:h-[72px] sm:w-[72px] lg:h-[88px] lg:w-[88px]">
                  <img src="/na-topup-brand-2026.png" alt="NA TOPUP" className="h-full w-full object-contain animate-logo-box" />
                </div>
              </Link>
            </div>
            <NavbarSearch />
            <div className="flex items-center gap-2 sm:gap-3">
              <a href="https://t.me/LukasTopupSupport" target="_blank" rel="noopener noreferrer" className="navbar-contact flex shrink-0 items-center justify-center gap-2 rounded-2xl p-2 md:px-4 md:py-2.5" title="ទាក់ទង Telegram" aria-label="ទាក់ទង Telegram">
                <Send className="h-5 w-5" aria-hidden="true" />
                <span className="relative z-10 hidden whitespace-nowrap pr-0.5 font-kulen text-xs font-bold tracking-tight text-[#2489b6] lg:inline lg:text-sm">ទាក់ទង Telegram</span>
              </a>
              <button type="button" onClick={() => setIsMenuOpen(true)} className="shrink-0 cursor-pointer rounded-xl p-2 text-gray-700 transition-all hover:bg-brand-violet/10 hover:text-brand-violet active:scale-90 lg:hidden" aria-label="បើកម៉ឺនុយ" aria-expanded={isMenuOpen} aria-controls="mobile-navigation">
                <Menu className="h-6 w-6 stroke-[2.3]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <button type="button" className={`mobile-drawer-backdrop fixed inset-0 z-50 lg:hidden ${isMenuOpen ? "is-open" : ""}`} onClick={() => setIsMenuOpen(false)} aria-label="បិទម៉ឺនុយ" tabIndex={isMenuOpen ? 0 : -1} />

      <aside id="mobile-navigation" className={`mobile-nav-rail fixed inset-y-0 right-0 z-[51] lg:hidden ${isMenuOpen ? "is-open" : ""}`} aria-label="Mobile navigation" aria-hidden={!isMenuOpen}>
        <div className="mobile-nav-rail-scroll">
          <button ref={closeButtonRef} type="button" onClick={() => setIsMenuOpen(false)} className="mobile-rail-close" aria-label="បិទម៉ឺនុយ"><X /></button>
          <Link to="/" onClick={() => setIsMenuOpen(false)} className="mobile-rail-link mobile-rail-home" aria-label="ទំព័រដើម"><Home /></Link>

          <section className="mobile-rail-section" aria-labelledby="follow-us-title">
            <h2 id="follow-us-title">តាមដានយើង</h2>
            <div className="mobile-rail-icons">
              <RailLink href="https://facebook.com" label="Facebook" className="is-facebook"><FacebookIcon /></RailLink>
              <RailLink href="https://tiktok.com" label="TikTok" className="is-tiktok"><TikTokIcon /></RailLink>
              <RailLink href="https://youtube.com" label="YouTube" className="is-youtube"><YouTubeIcon /></RailLink>
              <RailLink href="https://t.me/LukasTopupSupport" label="Telegram" className="is-telegram"><Send /></RailLink>
            </div>
          </section>

          <section className="mobile-rail-section mobile-rail-contact" aria-labelledby="contact-us-title">
            <h2 id="contact-us-title">ទាក់ទងមកយើង</h2>
            <div className="mobile-rail-icons">
              <RailLink href="https://t.me/LukasTopupSupport" label="Telegram support" className="is-telegram"><Send /></RailLink>
              <RailLink href="/support" label="Contact support" className="is-phone"><Phone /></RailLink>
              <RailLink href="mailto:support@lukastopup.com" label="Email support" className="is-email"><Mail /></RailLink>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
};
