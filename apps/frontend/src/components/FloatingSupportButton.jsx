import React from "react";
import { useLocation } from "react-router-dom";
import { CONTACT_LINKS } from "../contactLinks";

export const FloatingSupportButton = () => {
  const { pathname } = useLocation();

  // Keep fixed controls away from admin screens and the checkout security
  // widget. Support remains available in the header and footer.
  if (pathname.startsWith("/admin") || pathname.startsWith("/game/")) {
    return null;
  }

  return (
    <a
      href={CONTACT_LINKS.telegram}
      target="_blank"
      rel="noopener noreferrer"
      className="support-contact fixed bottom-6 right-3 sm:right-6 z-30 group flex flex-col items-center gap-2 rounded-[20px] sm:rounded-[22px] p-2.5 sm:p-3"
      title="ត្រូវការជំនួយ ? ទាក់ទង Telegram 24/7"
      aria-label="ត្រូវការជំនួយ ? ទាក់ទង Telegram 24/7"
    >

      <span className="support-contact-label relative z-10 font-heading font-extrabold text-xs sm:text-sm tracking-wide whitespace-nowrap">
        ត្រូវការជំនួយ ?
      </span>
      <span className="support-contact-logo h-12 w-12" aria-hidden="true">
        <img src="/na-topup-brand-uppercase-2026.png?v=20260924" alt="" />
      </span>
    </a>
  );
};
