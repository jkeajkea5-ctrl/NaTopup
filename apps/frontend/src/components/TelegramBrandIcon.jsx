import React from "react";

export const TelegramBrandIcon = ({ className = "" }) => (
  <span className={`telegram-brand-icon ${className}`} aria-hidden="true">
    <span className="telegram-brand-disc">
      <svg viewBox="0 0 48 48" focusable="false">
        <path d="M35.6 13.2 11.8 22.4c-1.6.6-1.6 1.6-.3 2l6.1 1.9 2.3 7c.3 1 .2 1.4 1.2 1.4.8 0 1.2-.4 1.7-.8l3-2.9 6.2 4.6c1.1.6 2 .3 2.3-1.1l4-18.8c.4-1.7-.6-2.9-2.7-2.5Zm-15.8 12.7 11.9-7.5c.6-.4 1.2-.2.7.3l-9.8 8.9-.4 4.1-2.4-5.8Z" />
      </svg>
    </span>
  </span>
);
