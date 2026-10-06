import React from "react";
import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { TelegramBrandIcon } from "./TelegramBrandIcon";
import { FacebookBrandIcon, TikTokBrandIcon } from "./SocialBrandIcons";
import { CONTACT_LINKS } from "../contactLinks";

function FooterLink({ href, label, variant, children }) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="site-footer-social"
      aria-label={label}
    >
      <span className={`site-footer-social-icon is-${variant}`}>{children}</span>
      <span>{label}</span>
    </a>
  );
}

function FooterDivider() {
  return <span className="site-footer-divider" aria-hidden="true"><i /></span>;
}

export const Footer = () => {
  return (
    <footer className="site-footer">
      <span className="site-footer-glow is-left" aria-hidden="true" />
      <span className="site-footer-glow is-right" aria-hidden="true" />

      <div className="site-footer-inner">
        <div className="site-footer-main">
          <div className="site-footer-brand">
            <Link to="/" aria-label="NA TOPUP home">
              <img src="/na-topup-brand-uppercase-2026.png?v=20260924" alt="NA TOPUP" />
            </Link>
            <div className="site-footer-wordmark" aria-label="NA TOPUP">
              <strong><span>NA</span> TOPUP</strong>
              <small><i />natopup.com<i /></small>
            </div>
          </div>

          <FooterDivider />

          <section className="site-footer-section" aria-labelledby="footer-follow-title">
            <h2 id="footer-follow-title">តាមដានយើង</h2>
            <div className="site-footer-heading-rule" aria-hidden="true"><i /></div>
            <div className="site-footer-links">
              <FooterLink href={CONTACT_LINKS.telegram} label="Telegram" variant="telegram"><TelegramBrandIcon bare /></FooterLink>
              <FooterLink href={CONTACT_LINKS.facebook} label="Facebook" variant="facebook"><FacebookBrandIcon /></FooterLink>
              <FooterLink href={CONTACT_LINKS.tiktok} label="TikTok" variant="tiktok"><TikTokBrandIcon /></FooterLink>
            </div>
          </section>

          <FooterDivider />

          <section className="site-footer-section site-footer-contact" aria-labelledby="footer-contact-title">
            <h2 id="footer-contact-title">ទាក់ទងមកយើង</h2>
            <div className="site-footer-heading-rule" aria-hidden="true"><i /></div>
            <div className="site-footer-links">
              <FooterLink href={CONTACT_LINKS.telegram} label="Telegram" variant="telegram"><TelegramBrandIcon bare /></FooterLink>
              <FooterLink href="mailto:support@lukastopup.com" label="Email" variant="email"><Mail /></FooterLink>
            </div>
          </section>
        </div>

        <div className="site-footer-ornament" aria-hidden="true"><span /></div>

        <div className="site-footer-bottom">
          <p>© 2026 <strong>NA TOPUP.</strong> All rights reserved.</p>
          <span className="site-footer-bottom-divider" aria-hidden="true" />
          <div className="site-footer-payment">
            <span>We accept:</span>
            <img src="/aba-khqr-badge.svg" alt="ABA KHQR" />
          </div>
          <span className="site-footer-bottom-divider" aria-hidden="true" />
          <p>Credit: <strong>Web Builder Service</strong></p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
