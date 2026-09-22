import React from "react";
import { useLocation } from "react-router-dom";

const TelegramLogo = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="currentColor"
      d="M21.9 2.3 2.7 9.7c-.9.35-.9 1.6.02 1.91l4.86 1.62 1.83 5.78c.27.86 1.35 1.12 1.99.49l2.71-2.68 4.98 3.66c.77.57 1.87.15 2.08-.79l3.11-15.99c.2-1.05-.8-1.79-1.78-1.41ZM9.2 13.06l9.4-6.02-7.88 7.48-.54 2.05-.98-3.51Z"
    />
  </svg>
);

export const FloatingSupportButton = () => {
  const { pathname } = useLocation();

  // Hide on admin page
  if (pathname.startsWith("/admin")) {
    return null;
  }

  // Adjust bottom offset on game detail page due to mobile bottom checkout bar
  const isGameDetailPage = pathname.startsWith("/game/");
  const bottomPosClass = isGameDetailPage
    ? "bottom-[calc(120px+env(safe-area-inset-bottom,0px))] lg:bottom-6"
    : "bottom-6";

  return (
    <a
      href="https://t.me/LukasTopupSupport"
      target="_blank"
      rel="noopener noreferrer"
      className={`support-contact fixed ${bottomPosClass} right-3 sm:right-6 z-30 group flex items-center gap-2.5 sm:gap-3 rounded-[20px] sm:rounded-[22px] p-2.5 sm:p-3`}
      title="ត្រូវការជំនួយ ? ទាក់ទង Telegram 24/7"
      aria-label="ត្រូវការជំនួយ ? ទាក់ទង Telegram 24/7"
    >

      <span className="support-contact-symbol flex h-11 w-11 items-center justify-center rounded-2xl">
        <TelegramLogo className="h-6 w-6" />
      </span>

      {/* Button Text */}
      <span className="relative z-10 hidden min-[430px]:inline font-heading font-extrabold text-xs sm:text-sm tracking-wide text-[#594274] whitespace-nowrap pr-1">
        ត្រូវការជំនួយ ?
      </span>
    </a>
  );
};
