import React from "react";

export const TelegramBrandIcon = ({ className = "", bare = false }) => (
  <span className={`telegram-brand-icon ${className}`} aria-hidden="true">
    <svg viewBox="0 0 48 48" focusable="false">
      {!bare && <circle cx="24" cy="24" r="24" fill="#229ED9" />}
      <path
        fill={bare ? "#229ED9" : "#fff"}
        d="M34.64 13.64 10.8 22.83c-1.63.65-1.62 1.55-.3 1.95l6.12 1.91 2.34 7.16c.28.77.14 1.08.95 1.08.63 0 .91-.29 1.27-.64l3.06-2.98 6.36 4.7c1.17.65 2.02.31 2.31-1.09l4.18-19.7c.43-1.72-.65-2.5-2.45-1.58ZM18.9 26.25l13.78-8.69c.69-.42 1.32-.2.8.27L22.1 28.1l-.44 4.75-2.76-6.6Z"
      />
    </svg>
  </span>
);
