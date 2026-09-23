import React from "react";
import { useLocation } from "react-router-dom";
import { CONTACT_LINKS } from "../contactLinks";

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
      href={CONTACT_LINKS.telegram}
      target="_blank"
      rel="noopener noreferrer"
      className={`support-contact fixed ${bottomPosClass} right-3 sm:right-6 z-30 group flex flex-col items-center gap-2 rounded-[20px] sm:rounded-[22px] p-2.5 sm:p-3`}
      title="ត្រូវការជំនួយ ? ទាក់ទង Telegram 24/7"
      aria-label="ត្រូវការជំនួយ ? ទាក់ទង Telegram 24/7"
    >

      <span className="support-contact-label relative z-10 font-heading font-extrabold text-xs sm:text-sm tracking-wide whitespace-nowrap">
        ត្រូវការជំនួយ ?
      </span>
      <span className="support-contact-logo h-12 w-12" aria-hidden="true">
        <img src="/na-topup-brand-uppercase-2026.png" alt="" />
      </span>
    </a>
  );
};
