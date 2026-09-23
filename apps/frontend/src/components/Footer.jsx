import React from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { TelegramBrandIcon } from "./TelegramBrandIcon";
import { FacebookBrandIcon, TikTokBrandIcon } from "./SocialBrandIcons";
import { CONTACT_LINKS } from "../contactLinks";

export const Footer = () => {
  return (
    <footer className="bg-white/95 backdrop-blur-sm border-t border-[#DFD3E6] mt-16 sm:mt-24 text-brand-text">
      <div className="mx-auto max-w-[1100px] px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <Link to="/" className="group flex flex-col items-center justify-center" aria-label="NA TOPUP home">
              <div className="flex h-32 w-32 flex-shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-105 sm:h-40 sm:w-40">
                <img
                  src="/na-topup-brand-uppercase-2026.png"
                  alt="NA TOPUP Logo"
                  className="h-full w-full object-contain drop-shadow-md"
                />
              </div>
              <div className="flex min-w-0 flex-col items-center text-center">
                <span className="mt-2 flex items-center gap-1.5 font-heading text-2xl font-black tracking-tight sm:text-3xl" aria-label="NA TOPUP">
                  <span className="text-[#ffdf51]">NA</span>
                  <span className="na-brand-word">TOPUP</span>
                </span>
              </div>
            </Link>

        </div>

        <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-6 border-t border-[#DFD3E6]/70 pt-7 text-center sm:mt-10">
          <div className="space-y-3 font-kulen">
            <h4 className="text-sm font-extrabold tracking-wide text-[#1C172B] sm:text-base">តាមដានយើង</h4>
            <div className="flex items-center justify-center gap-3">
              <a
                href={CONTACT_LINKS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-icon contact-icon--telegram !border-0 !bg-transparent !shadow-none"
                title="Telegram Channel"
                aria-label="Telegram Channel"
              >
                <TelegramBrandIcon className="h-8 w-8" />
              </a>

              <a
                href={CONTACT_LINKS.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-icon contact-icon--facebook !border-0 !bg-transparent !shadow-none"
                title="Facebook"
                aria-label="Facebook"
              >
                <FacebookBrandIcon className="h-6 w-6" />
              </a>

              <a
                href={CONTACT_LINKS.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-icon contact-icon--tiktok !border-0 !bg-transparent !shadow-none"
                title="TikTok"
                aria-label="TikTok"
              >
                <TikTokBrandIcon className="h-6 w-6" />
              </a>
            </div>
          </div>

          <div className="space-y-3 font-kulen">
            <h4 className="text-sm font-extrabold tracking-wide text-[#1C172B] sm:text-base">ទាក់ទងមកយើង</h4>
            <div className="flex items-center justify-center gap-3">
              <a
                href={CONTACT_LINKS.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-icon contact-icon--telegram !border-0 !bg-transparent !shadow-none"
                title="Telegram"
                aria-label="Telegram"
              >
                <TelegramBrandIcon className="h-8 w-8" />
              </a>

              <a
                href="mailto:support@lukastopup.com"
                className="contact-icon contact-icon--email !border-0 !bg-transparent !shadow-none"
                title="Email Support"
                aria-label="Email Support"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-[#DFD3E6]/70 pt-6">
          <div className="flex flex-col items-center justify-center gap-3 text-center text-[11px] font-medium text-gray-500 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:text-xs">
            <div>
              © 2026 <strong className="text-gray-800 uppercase">NA TOPUP</strong>. All rights reserved.
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-600 font-semibold text-xs">We accept:</span>
              <img
                src="/aba-khqr-badge.svg"
                alt="ABA KHQR Badge"
                className="h-6 object-contain rounded-xs shadow-2xs"
              />
            </div>

            <div>
              Credit: <strong className="text-gray-800">Web Builder Service</strong>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
