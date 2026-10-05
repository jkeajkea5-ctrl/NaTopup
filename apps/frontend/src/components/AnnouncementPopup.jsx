import React, { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";

const POPUP_SESSION_KEY = "na-topup-pchum-ben-popup-seen";

export function AnnouncementPopup() {
  const closeButtonRef = useRef(null);
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return sessionStorage.getItem(POPUP_SESSION_KEY) !== "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActiveElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePopup();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus?.();
    };
  }, [isOpen]);

  const closePopup = () => {
    try {
      sessionStorage.setItem(POPUP_SESSION_KEY, "true");
    } catch {
      // The popup still closes when browser storage is unavailable.
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div
      className="announcement-popup-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePopup();
      }}
    >
      <section
        className="announcement-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-popup-title"
        aria-describedby="announcement-popup-detail"
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="announcement-popup-close"
          onClick={closePopup}
          aria-label="បិទសារជូនដំណឹង"
        >
          <X aria-hidden="true" />
        </button>

        <div className="announcement-popup-image-wrap">
          <img
            src="/banners/phchum-ben-popup.jpg"
            alt="NA TOPUP សូមអបអរសាទរពិធីបុណ្យភ្ជុំបិណ្ឌ"
            className="announcement-popup-image"
          />
        </div>

        <div className="announcement-popup-content">
          <span className="announcement-popup-label">
            <Sparkles aria-hidden="true" />
            សារជូនពរពី NA TOPUP
          </span>
          <h2 id="announcement-popup-title">
            អបអរសាទរពិធីបុណ្យភ្ជុំបិណ្ឌ ជាមួយ NA TOPUP
          </h2>
          <p id="announcement-popup-detail">
            ក្នុងឱកាសពិធីបុណ្យភ្ជុំបិណ្ឌនេះ <strong>NA TOPUP</strong> សូមជូនពរលោកអ្នក និងក្រុមគ្រួសារ
            ឲ្យពោរពេញដោយសេចក្តីសុខ សំណាងល្អ និងសុភមង្គល។ រីករាយ Top Up ហ្គេមបានយ៉ាងរហ័ស
            និងងាយស្រួលជាមួយយើង។
          </p>
          <button type="button" className="announcement-popup-action" onClick={closePopup}>
            ចាប់ផ្តើម Top Up
          </button>
        </div>
      </section>
    </div>
  );
}
