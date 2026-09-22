import React from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { TelegramBrandIcon } from "./TelegramBrandIcon";

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
                <span className="mt-2 text-[10px] font-semibold tracking-wide text-gray-500 sm:text-sm">
                  Cambodian Premier Game Top-Up
                </span>
              </div>
            </Link>

            <p className="mt-6 max-w-2xl text-center font-kulen text-sm font-semibold leading-7 text-gray-500 sm:mt-7 sm:text-base sm:leading-8">
              សេវាកម្មបញ្ចូលហ្គេមរហ័ស 24 ម៉ោង តាមរយៈប្រព័ន្ធ KHQR Bakong និងធនាគារក្នុងស្រុកទាំងអស់ដោយសុវត្ថិភាព។
            </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-md grid-cols-2 gap-6 border-t border-[#DFD3E6]/70 pt-7 text-center sm:mt-10">
          <div className="space-y-3 font-kulen">
            <h4 className="text-sm font-extrabold tracking-wide text-[#1C172B] sm:text-base">តាមដានយើង</h4>
            <div className="flex items-center justify-center gap-3">
              <a
                href="https://t.me/LukasTopupSupport"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-icon contact-icon--telegram"
                title="Telegram Channel"
                aria-label="Telegram Channel"
              >
                <TelegramBrandIcon className="h-8 w-8" />
              </a>

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

          <div className="space-y-3 font-kulen">
            <h4 className="text-sm font-extrabold tracking-wide text-[#1C172B] sm:text-base">ទាក់ទងមកយើង</h4>
            <div className="flex items-center justify-center gap-3">
              <a
                href="https://t.me/LukasTopupSupport"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-icon contact-icon--telegram"
                title="Telegram"
                aria-label="Telegram"
              >
                <TelegramBrandIcon className="h-8 w-8" />
              </a>

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
        </div>

        <div className="mt-8 border-t border-[#DFD3E6]/70 pt-6">
          <div className="flex flex-col items-center justify-center gap-3 text-center text-[11px] font-medium text-gray-500 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:text-xs">
            <div>
              © 2026 <strong className="text-gray-800 uppercase">NA TOPUP</strong>. All rights reserved.
            </div>

            <div className="flex items-center gap-2">
              <span className="text-gray-600 font-semibold text-xs">We accept:</span>
              <img
                src="/aba-khqr-badge.png"
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
