import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import vm from "node:vm";
import { build } from "esbuild";
import React from "react";
import TestRenderer, { act } from "react-test-renderer";

// Render the actual checkout page with network and browser dependencies replaced.
const fixtures = {
  game: { slug: "test-game", name: "Test Game", fields: [
    { fieldKey: "userId", fieldLabel: "Player ID", isRequired: true },
  ] },
  products: [
    { id: "product-1", name: "100 Diamonds", priceUsd: 1 },
    { id: "product-2", name: "200 Diamonds", priceUsd: 2 },
  ],
};
let api;
let paymentOptions;
const mocks = {
  api: Object.fromEntries([
    "checkPlayerId", "createOrder", "fetchGameDetail", "fetchPaymentOptions",
    "initKhqrPayment", "cancelOrder", "fetchOrderDetail", "fetchOrderStatus",
  ].map((name) => [name, (...args) => api[name](...args)])),
  router: { useParams: () => ({ slug: fixtures.game.slug }), useNavigate: () => () => {}, Link: "a" },
  query: { useQuery: ({ queryKey }) => ({
    data: queryKey[0] === "gameDetail" ? fixtures : paymentOptions,
    isLoading: false,
  }) },
  provider: { closeProviderCheckout() {}, isMobilePaymentDevice: () => false,
    openAbaMobileApp() {}, showProviderCloseButton() {} },
  product: { ProductCard: (props) => React.createElement("test-product", props) },
  invoice: { SuccessInvoiceModal: (props) => React.createElement("test-invoice", props) },
  terms: { TermsModal: () => null },
};
const modules = new Map([
  ["../services/api", "api"], ["react-router-dom", "router"],
  ["@tanstack/react-query", "query"], ["../services/paymentCheckout", "provider"],
  ["../components/ProductCard", "product"], ["../components/SuccessInvoiceModal", "invoice"],
  ["../components/TermsModal", "terms"],
]);
const bundled = await build({
  entryPoints: ["apps/frontend/src/pages/GameDetailPage.jsx"], bundle: true,
  write: false, format: "cjs", platform: "node", external: ["react"],
  plugins: [{ name: "checkout-test-dependencies", setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path }) => modules.has(path)
      ? { path: modules.get(path), namespace: "checkout-mock" } : undefined);
    builder.onLoad({ filter: /.*/, namespace: "checkout-mock" }, ({ path }) => ({
      contents: `module.exports = checkoutMocks[${JSON.stringify(path)}];`,
    }));
  } }],
});
const pageModule = { exports: {} };
vm.runInThisContext(`(function(require, module, exports, checkoutMocks) {${bundled.outputFiles[0].text}\n})`)(
  createRequire(import.meta.url), pageModule, pageModule.exports, mocks,
);
const { GameDetailPage } = pageModule.exports;

async function mountCheckout(t, provider = "KHQRPAY_ABA_V2") {
  paymentOptions = [{ id: provider }];
  t.mock.timers.enable({ apis: ["setInterval", "setTimeout", "Date"] });
  const globals = ["window", "document"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  globalThis.window = {
    location: { origin: "https://shop.test" },
    localStorage: { getItem: () => null, setItem() {} },
    addEventListener() {}, removeEventListener() {}, scrollTo() {}, confirm: () => true,
    setInterval: (...args) => setInterval(...args), clearInterval: (...args) => clearInterval(...args),
    setTimeout: (...args) => setTimeout(...args), clearTimeout: (...args) => clearTimeout(...args),
  };
  globalThis.document = {
    documentElement: {}, body: {},
  };
  const orders = new Map();
  api = {
    checkPlayerId: async () => ({ valid: true, playerName: "Player" }),
    createOrder: t.mock.fn(async (data, requestId) => {
      if (!orders.has(requestId)) orders.set(requestId, {
        publicOrderId: `order-${orders.size + 1}`, lookupToken: "lookup-token", status: "AWAITING_PAYMENT",
      });
      return orders.get(requestId);
    }),
    initKhqrPayment: t.mock.fn(async () => ({
      paymentId: "payment-1", expiresAt: new Date(Date.now() + 600_000).toISOString(), amount: 1,
      checkoutUrl: "https://anajakpay.com/checkout/test",
    })),
    cancelOrder: t.mock.fn(async () => ({ status: "CANCELLED" })),
    fetchOrderStatus: t.mock.fn(async () => ({ status: "AWAITING_PAYMENT" })),
    fetchOrderDetail: t.mock.fn(async (id) => ({ publicOrderId: id })),
  };
  let renderer;
  await act(async () => { renderer = TestRenderer.create(React.createElement(GameDetailPage)); });
  t.after(async () => {
    await act(async () => renderer.unmount());
    for (const [name, original] of globals) {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    }
  });
  const root = renderer.root;
  await act(async () => {
    root.findAllByType("input").find((input) => input.props.type === "text")
      .props.onChange({ target: { value: "123456" } });
    root.findAllByType("test-product")[0].props.onSelect(fixtures.products[0]);
  });
  await act(async () => {
    await root.findAllByType("button").find((button) =>
      button.props.onClick?.name === "handleValidatePlayer").props.onClick();
  });
  return {
    root, orders,
    pay: async () => act(async () => {
      await root.findAllByType("button").find((button) =>
        button.props.className?.includes("mobile-checkout-button")).props.onClick();
    }),
    close: async () => act(async () => {
      root.findByProps({ "aria-label": "Close payment" }).props.onClick();
    }),
    poll: async () => act(async () => { t.mock.timers.tick(3000); }),
  };
}

test("a paid checkout allows a new order without signing out", async (t) => {
  const checkout = await mountCheckout(t);
  await checkout.pay();
  api.fetchOrderStatus = async () => ({ paymentStatus: "PAID", status: "PAID" });
  await checkout.poll();
  assert.equal(checkout.root.findByType("test-invoice").props.order.publicOrderId, "order-1");
  await checkout.pay();
  assert.equal(api.createOrder.mock.calls.length, 2);
  assert.notEqual(api.createOrder.mock.calls[0].arguments[1], api.createOrder.mock.calls[1].arguments[1]);
});

test("cancelling and reselecting the same package creates a fresh QR order", async (t) => {
  const checkout = await mountCheckout(t);
  await checkout.pay();
  await checkout.close();
  await act(async () => {
    checkout.root.findAllByType("test-product")[0].props.onSelect(fixtures.products[0]);
  });
  await checkout.pay();
  assert.notEqual(api.createOrder.mock.calls[0].arguments[1], api.createOrder.mock.calls[1].arguments[1]);
  assert.equal(checkout.orders.size, 2);
  assert.equal(checkout.root.findAllByProps({ "aria-label": "ABA KHQR payment" }).length, 1);
});

test("cancelling package checkouts creates a fresh order each time", async (t) => {
  const checkout = await mountCheckout(t);
  await checkout.pay();
  await checkout.close();
  await act(async () => {
    checkout.root.findAllByType("test-product")[1].props.onSelect(fixtures.products[1]);
  });
  await checkout.pay();
  await checkout.close();
  await act(async () => {
    checkout.root.findAllByType("test-product")[0].props.onSelect(fixtures.products[0]);
  });
  await checkout.pay();
  const requestIds = api.createOrder.mock.calls.map((call) => call.arguments[1]);
  assert.notEqual(requestIds[0], requestIds[1]);
  assert.notEqual(requestIds[0], requestIds[2]);
  assert.equal(checkout.orders.size, 3);
});

test("an open QR cannot submit a duplicate checkout", async (t) => {
  const checkout = await mountCheckout(t);
  await checkout.pay();
  await checkout.pay();
  assert.equal(api.createOrder.mock.calls.length, 1);
});

test("receipt loading failure still releases the paid checkout", async (t) => {
  const checkout = await mountCheckout(t);
  await checkout.pay();
  api.fetchOrderStatus = async () => ({ paymentStatus: "PAID", status: "PAID" });
  api.fetchOrderDetail = async () => { throw new Error("Receipt unavailable"); };
  await checkout.poll();
  await checkout.pay();
  assert.equal(checkout.orders.size, 2);
});

for (const status of ["EXPIRED", "FAILED", "CANCELLED"]) {
  test(`${status} checkout allows a new order`, async (t) => {
    const checkout = await mountCheckout(t);
    await checkout.pay();
    api.fetchOrderStatus = async () => ({ status, isTerminal: true });
    await checkout.poll();
    await checkout.pay();
    assert.equal(checkout.orders.size, 2);
  });
}

test("local QR expiry releases the checkout even if the server still reports pending", async (t) => {
  const checkout = await mountCheckout(t);
  await checkout.pay();
  await act(async () => { t.mock.timers.tick(600_000); });
  await checkout.pay();
  assert.equal(checkout.orders.size, 2);
});

test("a dismissed QR paid in the background is not initialized again", async (t) => {
  const checkout = await mountCheckout(t);
  await checkout.pay();
  await checkout.close();
  checkout.orders.values().next().value.status = "PAID";
  await checkout.pay();
  assert.deepEqual(api.initKhqrPayment.mock.calls.map((call) => call.arguments[0]), ["order-1", "order-2"]);
});

test("payment generation failure retries the same order", async (t) => {
  const checkout = await mountCheckout(t);
  const init = api.initKhqrPayment;
  api.initKhqrPayment = async () => { throw new Error("Temporary payment error"); };
  await checkout.pay();
  api.initKhqrPayment = init;
  await checkout.pay();
  assert.equal(checkout.orders.size, 1);
});

test("a hosted checkout error can be retried without signing out", async (t) => {
  const checkout = await mountCheckout(t, "ANJAKPAY");
  let callbacks;
  window.KhqrPayway = { openCheckout: (options) => { callbacks = options; } };
  await checkout.pay();
  await act(async () => { callbacks.onError(); });
  await checkout.pay();
  assert.equal(api.initKhqrPayment.mock.calls.length, 2);
  assert.equal(checkout.orders.size, 1);
});
