import React, { useEffect, useRef, useState } from "react";
import { CalendarDays, Sparkles, Ticket, X } from "lucide-react";

const POPUP_SESSION_KEY = "na-topup-aspirants-5-premium-supply-seen";

export function AnnouncementPopup() {
  const closeButtonRef = useRef(null);
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return sessionStorage.getItem(POPUP_SESSION_KEY) !== "true";
    } catch {
      return true;
    }
  });

  const closePopup = () => {
    try {
      sessionStorage.setItem(POPUP_SESSION_KEY, "true");
    } catch {
      // The popup still closes when browser storage is unavailable.
    }
    setIsOpen(false);
  };

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
          aria-label="បិទសេចក្តីជូនដំណឹង"
        >
          <X aria-hidden="true" />
        </button>

        <div className="announcement-popup-image-wrap">
          <img
            src="/banners/aspirants-5-premium-supply.webp"
            alt="Aspirants 5.0 Premium Supply — Free Tickets"
            className="announcement-popup-image"
          />
        </div>

        <div className="announcement-popup-content">
          <span className="announcement-popup-label">
            <Sparkles aria-hidden="true" />
            ព្រឹត្តិការណ៍ពិសេស
          </span>

          <h2 id="announcement-popup-title">
            ព្រឹត្តិការណ៍ <strong>Aspirants 5.0 Premium Supply</strong> បានមកដល់ហើយ!
          </h2>
          <p id="announcement-popup-detail" className="announcement-popup-intro">
            កុំភ្លេចចូលរួមបំពេញបេសកកម្ម ដើម្បីទទួលបានសំបុត្រសម្រាប់បង្វិលយកស្គីនពិសេស!
          </p>

          <div className="announcement-popup-details">
            <section className="announcement-popup-detail-block">
              <h3><CalendarDays aria-hidden="true" /> កាលបរិច្ឆេទព្រឹត្តិការណ៍</h3>
              <p><Ticket aria-hidden="true" /> <strong>វគ្គទី 1៖</strong> ថ្ងៃទី 16–20 ខែតុលា ឆ្នាំ 2026 (រហូតដល់ 16 សន្លឹក)</p>
            </section>

          </div>

          <button type="button" className="announcement-popup-action" onClick={closePopup}>
            យល់ព្រម
          </button>
        </div>
      </section>
    </div>
  );
}
