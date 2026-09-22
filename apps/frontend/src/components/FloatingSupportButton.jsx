import React from "react";
import { useLocation } from "react-router-dom";
import { TelegramBrandIcon } from "./TelegramBrandIcon";

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

      <TelegramBrandIcon className="h-11 w-11" />

      {/* Button Text */}
      <span className="relative z-10 hidden min-[430px]:inline font-heading font-extrabold text-xs sm:text-sm tracking-wide text-[#594274] whitespace-nowrap pr-1">
        ត្រូវការជំនួយ ?
      </span>
    </a>
  );
};
