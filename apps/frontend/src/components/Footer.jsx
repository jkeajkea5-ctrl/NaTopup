import React from "react";

export const Footer = () => {
  return (
    <footer className="site-footer site-footer-compact">
      <span className="site-footer-glow is-left" aria-hidden="true" />
      <span className="site-footer-glow is-right" aria-hidden="true" />

      <div className="site-footer-inner">
        <div className="site-footer-bottom">
          <p>© 2026 <strong>NA TOPUP.</strong> All rights reserved.</p>
          <span className="site-footer-bottom-divider" aria-hidden="true" />
          <div className="site-footer-payment">
            <span>We accept:</span>
            <span className="site-footer-payment-icons">
              <img src="/payments/aba.svg" alt="ABA" />
              <img src="/payments/khqr.svg" alt="KHQR" />
            </span>
          </div>
          <span className="site-footer-bottom-divider" aria-hidden="true" />
          <p>Credit: <strong>Web Builder Service</strong></p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
