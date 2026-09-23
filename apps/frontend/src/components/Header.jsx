import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Mail, Menu, Phone, X } from "lucide-react";
import { NavbarSearch } from "./NavbarSearch";
import { TelegramBrandIcon } from "./TelegramBrandIcon";
import { FacebookBrandIcon, TikTokBrandIcon, YouTubeBrandIcon } from "./SocialBrandIcons";
import { CONTACT_LINKS } from "../contactLinks";

const RailLink = ({ href, label, className, children }) => (
  <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} className={`mobile-rail-link hover:!bg-transparent ${className || ""}`} aria-label={label} title={label}>
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
              <Link to="/" className="na-brand group flex min-w-0 select-none items-center gap-1.5 sm:gap-2.5 lg:gap-3" aria-label="NA TOPUP home">
                <div className="na-brand-emblem relative flex h-16 w-16 shrink-0 items-center justify-center sm:h-[72px] sm:w-[72px] lg:h-[88px] lg:w-[88px]">
                  <img src="/na-topup-brand-uppercase-2026.png?v=20260924" alt="NA TOPUP" className="h-full w-full object-contain animate-logo-box" />
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5" aria-hidden="true">
                  <span className="font-heading text-lg font-black tracking-tight text-[#ffdf51] sm:text-2xl lg:text-3xl">NA</span>
                  <span className="na-brand-word font-heading text-lg font-black tracking-tight sm:text-2xl lg:text-3xl">TOPUP</span>
                </div>
              </Link>
            </div>
            <NavbarSearch />
            <div className="flex items-center gap-2 sm:gap-3">
              <a href={CONTACT_LINKS.telegram} target="_blank" rel="noopener noreferrer" className="navbar-contact flex shrink-0 items-center justify-center gap-2 p-1.5 md:px-2 md:py-2" title="ទាក់ទង Telegram" aria-label="ទាក់ទង Telegram">
                <TelegramBrandIcon className="h-10 w-10" />
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
              <RailLink href={CONTACT_LINKS.facebook} label="Facebook" className="is-facebook"><FacebookBrandIcon /></RailLink>
              <RailLink href={CONTACT_LINKS.tiktok} label="TikTok" className="is-tiktok"><TikTokBrandIcon /></RailLink>
              <RailLink href="https://youtube.com" label="YouTube" className="is-youtube"><YouTubeBrandIcon /></RailLink>
              <RailLink href={CONTACT_LINKS.telegram} label="Telegram" className="is-telegram"><TelegramBrandIcon className="h-9 w-9" /></RailLink>
            </div>
          </section>

          <section className="mobile-rail-section mobile-rail-contact" aria-labelledby="contact-us-title">
            <h2 id="contact-us-title">ទាក់ទងមកយើង</h2>
            <div className="mobile-rail-icons">
              <RailLink href={CONTACT_LINKS.telegram} label="Telegram support" className="is-telegram"><TelegramBrandIcon className="h-9 w-9" /></RailLink>
              <RailLink href="/support" label="Contact support" className="is-phone"><Phone /></RailLink>
              <RailLink href="mailto:support@lukastopup.com" label="Email support" className="is-email"><Mail /></RailLink>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
};
