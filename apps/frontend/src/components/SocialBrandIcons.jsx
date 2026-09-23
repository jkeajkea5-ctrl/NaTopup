import React from "react";

const BrandSvg = ({ children, className = "", viewBox = "0 0 24 24" }) => (
  <svg
    className={className}
    viewBox={viewBox}
    fill="currentColor"
    focusable="false"
    aria-hidden="true"
  >
    {children}
  </svg>
);

export const FacebookBrandIcon = ({ className = "" }) => (
  <BrandSvg className={className}>
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.02 10.125 11.927v-8.385H7.078v-3.542h3.047V9.37c0-3.018 1.792-4.687 4.533-4.687 1.312 0 2.686.236 2.686.236v2.969H15.83c-1.491 0-1.956.93-1.956 1.884v2.301h3.328l-.532 3.542h-2.796V24C19.612 23.093 24 18.099 24 12.073Z" />
  </BrandSvg>
);

export const TikTokBrandIcon = ({ className = "" }) => (
  <BrandSvg className={className}>
    <path d="M16.6 5.82a5.53 5.53 0 0 1-1.38-3.63h-3.7v14.86a3.12 3.12 0 1 1-2.14-2.96v-3.77a6.82 6.82 0 1 0 5.84 6.73V9.51a9.2 9.2 0 0 0 5.38 1.72V7.55a5.56 5.56 0 0 1-4-1.73Z" />
  </BrandSvg>
);

export const YouTubeBrandIcon = ({ className = "" }) => (
  <BrandSvg className={className}>
    <path d="M23.5 6.2a3.02 3.02 0 0 0-2.13-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.37.51A3.02 3.02 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.13 2.14c1.87.51 9.37.51 9.37.51s7.5 0 9.37-.51a3.02 3.02 0 0 0 2.13-2.14A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8ZM9.6 15.64V8.36L15.86 12 9.6 15.64Z" />
  </BrandSvg>
);
