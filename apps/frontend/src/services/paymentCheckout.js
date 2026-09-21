export function closeProviderCheckout(provider = window.KhqrPayway) {
  // The provider owns DOM outside React. Close it without reloading the page.
  provider?.closeCheckoutByContinueUrl?.();
}
