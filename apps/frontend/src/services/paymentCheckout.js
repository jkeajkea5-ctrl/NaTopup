const CLOSE_BUTTON_ID = "na-topup-khqr-close";

function removeProviderCloseButton() {
  document.getElementById(CLOSE_BUTTON_ID)?.remove();
}

export function showProviderCloseButton(onClose) {
  removeProviderCloseButton();

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const checkoutContainer = isMobile
    ? document.querySelector("#khqr_checkout_sheet .khqr_checkout_contents")
    : document.querySelector("#khqr-checkout .khqr-checkout-content");

  if (!checkoutContainer) return;

  const closeButton = document.createElement("button");
  closeButton.id = CLOSE_BUTTON_ID;
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Close QR payment");
  closeButton.setAttribute("title", "Close QR payment");
  closeButton.textContent = "\u00d7";
  Object.assign(closeButton.style, {
    position: "absolute",
    top: isMobile ? "-50px" : "12px",
    right: "12px",
    zIndex: "2147483647",
    width: "38px",
    height: "38px",
    padding: "0",
    border: "1px solid rgba(0, 0, 0, 0.12)",
    borderRadius: "9999px",
    background: "#ffffff",
    color: "#dc2626",
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
    fontFamily: "Arial, sans-serif",
    fontSize: "30px",
    fontWeight: "400",
    lineHeight: "34px",
    textAlign: "center",
    cursor: "pointer",
    pointerEvents: "auto",
    touchAction: "manipulation",
  });
  closeButton.addEventListener("pointerdown", (event) => event.stopPropagation());
  closeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeProviderCheckout();
    onClose?.();
  });
  checkoutContainer.appendChild(closeButton);
}

export function closeProviderCheckout(provider = window.KhqrPayway) {
  removeProviderCloseButton();

  // Ask the provider to close first, then clean up its DOM as a fallback.
  // Some mobile versions of the provider plugin do not consistently close
  // the bottom sheet when its public close method is called.
  try {
    provider?.closeCheckoutByContinueUrl?.();
  } finally {
    const mobileSheet = document.getElementById("khqr_checkout_sheet");
    const mobileApp = document.getElementById("khqr_checkout_app");
    const desktopCheckout = document.getElementById("khqr-checkout");

    if (mobileSheet) {
      mobileSheet.setAttribute("aria-hidden", "true");
      mobileSheet.style.display = "none";
    }
    if (mobileApp) {
      mobileApp.replaceChildren();
      mobileApp.className = "khqr_checkout_column";
    }
    if (desktopCheckout) {
      desktopCheckout.replaceChildren();
      desktopCheckout.className = "";
      desktopCheckout.style.display = "none";
    }
    document.body.style.overflowY = "visible";
  }
}
