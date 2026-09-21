import { GameItem, PromotionItem, ProductItem, GameField, OrderStatusData, OrderDetailData } from "../types";

const API_BASE = "/api";

async function adminJson(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.error || json.error?.message || "Admin request failed");
  return json.data;
}

export function fetchAdminSession(): Promise<{ authenticated: boolean; allowed: boolean; ip: string; username?: string; role?: string }> {
  return adminJson("/admin/session");
}

export function loginAdmin(username: string, password: string) {
  return adminJson("/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
}

export function logoutAdmin() {
  return adminJson("/admin/session", { method: "DELETE" });
}

export function redeemAdminInvite(token: string) {
  return adminJson("/admin/invite/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
}

export function fetchAdminSettings() {
  return adminJson("/admin/settings");
}

export function updateAdminSecurity(data: Record<string, unknown>) {
  return adminJson("/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

export function fetchAdminDashboard() {
  return adminJson("/admin/dashboard");
}

export function saveAdminDashboardMutation(data: Record<string, unknown>) {
  return adminJson("/admin/dashboard", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
}

export async function fetchGames(): Promise<{ games: GameItem[]; promotions: PromotionItem[] }> {
  const res = await fetch(`${API_BASE}/games`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to load games");
  }
  return json.data;
}

export async function fetchGameDetail(slug: string): Promise<{
  game: GameItem & { fields: GameField[]; instructions?: string };
  products: ProductItem[];
}> {
  const res = await fetch(`${API_BASE}/games/${slug}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to load game details");
  }
  return json.data;
}

export async function checkPlayerId(
  gameSlug: string,
  fields: Record<string, string>
): Promise<{ valid: boolean; playerName?: string; message?: string }> {
  const res = await fetch(`${API_BASE}/player/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameSlug, fields }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Player check failed");
  }
  return json.data;
}

export async function createOrder(data: {
  gameSlug: string;
  productId: string;
  playerData: Record<string, string>;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<{
  publicOrderId: string;
  lookupToken: string;
  status: string;
  total: number;
  totalKhr: number;
  currency: string;
}> {
  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to create order");
  }
  return json.data;
}

export async function initKhqrPayment(publicOrderId: string): Promise<{
  paymentId: string;
  publicOrderId: string;
  qrString: string;
  qrImageUrl?: string;
  checkoutUrl?: string;
  md5: string;
  amount: number;
  currency: string;
  amountKhr: number;
  expiresAt: string;
  remainingSeconds: number;
  status: string;
}> {
  const res = await fetch(`${API_BASE}/orders/${publicOrderId}/payment`, {
    method: "POST",
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to generate KHQR");
  }
  return json.data;
}

export async function fetchOrderStatus(publicOrderId: string): Promise<OrderStatusData> {
  const res = await fetch(`${API_BASE}/orders/${publicOrderId}/status`, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to poll status");
  }
  return json.data;
}

export async function fetchOrderDetail(publicOrderId: string): Promise<OrderDetailData> {
  const res = await fetch(`${API_BASE}/orders/${publicOrderId}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to fetch order");
  }
  return json.data;
}

export async function fetchAdminOverview(): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/overview`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to load admin overview");
  }
  return json.data;
}

export async function fetchAdminOrders(query?: string, status?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  const res = await fetch(`${API_BASE}/admin/orders?${params.toString()}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to load orders");
  }
  return json.data;
}

export async function fetchAdminSuppliers(): Promise<any> {
  return adminJson("/admin/suppliers");
}

export async function updateAdminSupplier(id: string, isEnabled: boolean, priority?: number): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/suppliers`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, isEnabled, priority }),
  });
  const json = await res.json();
  return json.data;
}

export async function uploadAdminImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${API_BASE}/admin/uploads`, { method: "POST", body: form });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to upload image");
  }
  return json.data;
}

export async function updateAdminGame(id: string, data: {
  name: string;
  category: string;
  logoUrl: string;
  bannerUrl?: string;
  sortOrder: number;
  isActive: boolean;
  isPopular: boolean;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/admin/dashboard`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entity: "game", id, data }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || "Failed to update game");
  }
  return json.data;
}
