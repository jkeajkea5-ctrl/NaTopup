import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ROUTE_CLASS = "page-route-enter";
const REVEAL_CLASS = "scroll-reveal";
const VISIBLE_CLASS = "is-visible";

export function MotionEffects({ disabled = false }) {
  const { pathname } = useLocation();

  useEffect(() => {
    if (disabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    const main = document.querySelector(".app-main");
    if (!main) return undefined;

    const animatedElements = new Set();
    let pageRoot = main.firstElementChild;

    if (pageRoot instanceof HTMLElement) {
      pageRoot.classList.remove(ROUTE_CLASS);
      void pageRoot.offsetWidth;
      pageRoot.classList.add(ROUTE_CLASS);
    }

    const intersectionObserver = "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add(VISIBLE_CLASS);
              intersectionObserver.unobserve(entry.target);
            });
          },
          { threshold: 0.08, rootMargin: "0px 0px -48px" },
        )
      : null;

    const registerSections = () => {
      pageRoot = main.firstElementChild;
      if (!(pageRoot instanceof HTMLElement)) return;

      Array.from(pageRoot.children).forEach((element, index) => {
        if (!(element instanceof HTMLElement) || animatedElements.has(element)) return;
        if (element.matches("[role='dialog'], [aria-modal='true'], .fixed")) return;
        if (window.getComputedStyle(element).position === "fixed") return;

        element.classList.add(REVEAL_CLASS);
        element.style.setProperty("--reveal-delay", `${Math.min(index, 4) * 55}ms`);
        animatedElements.add(element);

        if (intersectionObserver) intersectionObserver.observe(element);
        else element.classList.add(VISIBLE_CLASS);
      });
    };

    const frame = window.requestAnimationFrame(registerSections);
    const mutationObserver = new MutationObserver(registerSections);
    mutationObserver.observe(main, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      intersectionObserver?.disconnect();
      if (pageRoot instanceof HTMLElement) pageRoot.classList.remove(ROUTE_CLASS);
      animatedElements.forEach((element) => {
        element.classList.remove(REVEAL_CLASS, VISIBLE_CLASS);
        element.style.removeProperty("--reveal-delay");
      });
    };
  }, [disabled, pathname]);

  return null;
}

export default MotionEffects;
