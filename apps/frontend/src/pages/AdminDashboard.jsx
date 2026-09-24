import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight, Boxes, ClipboardCheck, Copy, Gamepad2, Images, Link2, LogOut,
  Menu, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, Upload, UserPlus,
  Users, WalletCards, X,
} from "lucide-react";
import {
  fetchAdminDashboard, fetchAdminSettings, fetchAdminSuppliers, logoutAdmin, saveAdminDashboardMutation,
  updateAdminSecurity, uploadAdminImage,
} from "../services/api";
import "./AdminDashboard.css";

const tabs = [
  ["orders", "Orders", ClipboardCheck],
  ["profit", "Profit & Wallet", WalletCards],
  ["games", "Games", Gamepad2],
  ["packages", "Packages", Boxes],
  ["slides", "Slides", Images],
  ["users", "Users", Users],
  ["suppliers", "Suppliers", Settings],
  ["security", "Security", ShieldCheck],
];

const labels = {
  AWAITING_PAYMENT: "Awaiting payment", PAID: "Paid", PROCESSING: "Processing",
  DELIVERED: "Delivered", FAILED: "Failed", EXPIRED: "Expired", REVIEW_REQUIRED: "Review required",
};
const pageDescriptions = {
  orders: "Track purchases, payments, customers, and fulfilment",
  profit: "Live order totals and supplier API balances",
  games: "Manage storefront games, categories, and visibility",
  packages: "Control package pricing, images, and availability",
  slides: "Manage promotional banners shown on the storefront",
  users: "Review customer accounts and order activity",
  suppliers: "Configure supplier availability and routing priority",
  security: "Access control, trusted networks, and administrator accounts",
};
const money = (value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);

const packageCustomerPrice = (product) => {
  if (!product?.price) return Number.POSITIVE_INFINITY;
  const price = Number(product.price.sellingPrice) - Number(product.price.discount || 0);
  return Number.isFinite(price) ? price : Number.POSITIVE_INFINITY;
};

const threeCatalogGameSlugs = new Set([
  "free-fire", "free-fire-khsgmy", "pubg-mobile", "honor-of-kings", "hok",
  "delta-force", "blood-strike",
]);

const packageCatalog = (product) => {
  if (threeCatalogGameSlugs.has(product.game?.slug)) {
    if (product.isPopular) return { id: "pass", label: "Pass" };
    if (product.isFeatured) return { id: "other", label: "Other" };
    return { id: "normal", label: "Normal" };
  }
  return product.isPopular
    ? { id: "best-selling", label: "Best Selling" }
    : { id: "normal", label: "Normal" };
};

const comparePackagesSmallToLarge = (a, b) => {
  const gameOrder = Number(a.game?.sortOrder ?? Number.MAX_SAFE_INTEGER) - Number(b.game?.sortOrder ?? Number.MAX_SAFE_INTEGER);
  if (gameOrder) return gameOrder;
  const gameName = (a.game?.name || "").localeCompare(b.game?.name || "");
  if (gameName) return gameName;
  const price = packageCustomerPrice(a) - packageCustomerPrice(b);
  if (price) return price;
  const manualOrder = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  return manualOrder || (a.name || "").localeCompare(b.name || "", undefined, { numeric: true });
};

function Brand() {
  return <div className="admin-brand"><img src="/na-topup-icon-2026.png?v=20260924" alt="NA TOPUP" /><span><strong>NA TOPUP</strong><small>Admin Dashboard</small></span></div>;
}

function Empty({ children }) {
  return <div className="admin-empty" role="status">{children}</div>;
}

function Picture({ url, name }) {
  const [failed, setFailed] = useState(false);
  return url && !failed
    ? <img className="admin-thumb" src={url} alt="" loading="lazy" onError={() => setFailed(true)} />
    : <span className="admin-thumb admin-thumb-fallback">{name?.slice(0, 2)?.toUpperCase()}</span>;
}

async function optimizeUploadImage(file) {
  if (!file.type.startsWith("image/") || file.size <= 900 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); return file; }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
  return blob && blob.size < file.size ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }) : file;
}

function ImageUpload({ label, value, disabled, onChange }) {
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true); setError("");
    try { onChange((await uploadAdminImage(await optimizeUploadImage(file))).url); }
    catch (err) { setError(err.message); }
    finally { setUploading(false); }
  }
  return <div className="admin-upload">
    <strong>{label}</strong>
    {value && <img src={value} alt={`${label} preview`} />}
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />
    <button type="button" className="admin-btn secondary" disabled={disabled || uploading} onClick={() => input.current?.click()}>
      {uploading ? <RefreshCw className="spin" size={16} /> : <Upload size={16} />}{uploading ? "Uploading…" : "Upload image"}
    </button>
    <small>JPG, PNG, or WebP · Maximum 5 MB</small>
    {error && <p className="admin-alert error">{error}</p>}
  </div>;
}

function Editor({ editor, saving, error, onClose, onSave }) {
  const [form, setForm] = useState(editor.data);
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const field = (name, label, type = "text", required = true) => <label className="admin-field" key={name}>{label}<input type={type} required={required} value={form[name] ?? ""} min={type === "number" ? 0 : undefined} step={type === "number" ? (name === "sortOrder" || name === "priority" ? 1 : .01) : undefined} onChange={(e) => setForm({ ...form, [name]: type === "number" ? Number(e.target.value) : e.target.value })} /></label>;
  const toggle = (name, label) => <label className="admin-check" key={name}><input type="checkbox" checked={!!form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.checked })} />{label}</label>;
  if (editor.entity === "package") {
    const supplierCost = Number(form.supplierCost || 0);
    const importCost = typeof editor.importCost === "number" && Number.isFinite(editor.importCost) ? editor.importCost : null;
    const discount = Number(form.discount || 0);
    const customerPrice = Number(form.sellingPrice || 0) - discount;
    const profit = customerPrice - supplierCost;
    const minimumSellingPrice = Math.ceil((supplierCost + discount - 1e-9) * 100) / 100;
    const isBelowCost = profit < -Number.EPSILON;
    const isBelowImportCost = importCost !== null && supplierCost + 1e-9 < importCost;
    const usesThreeCatalogs = threeCatalogGameSlugs.has(editor.gameSlug);
    return <dialog ref={dialog} className="admin-dialog admin-package-dialog" onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }}>
      <form onSubmit={(e) => { e.preventDefault(); if (!isBelowCost) onSave({ entity: editor.entity, id: editor.id, data: form }); }}>
        <div className="admin-dialog-head"><h2>Edit Package</h2><button type="button" className="admin-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="admin-package-preview"><Picture url={form.iconUrl} name={form.name} /><span><strong>{form.name || "Package name"}</strong><small>{form.amount || "0"}</small></span></div>
        <fieldset disabled={saving} className="admin-package-fields">
          <label className="admin-field admin-package-wide">Package name<input required value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="admin-field">Amount (diamonds)<input required value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
          <label className="admin-field admin-package-wide">Storefront catalog<select value={form.category || "normal"} onChange={(e) => setForm({ ...form, category: e.target.value })}>{usesThreeCatalogs ? <><option value="pass">Pass</option><option value="normal">Normal</option><option value="other">Other</option></> : <><option value="pass">Best Selling</option><option value="normal">Normal</option></>}</select></label>
          <label className="admin-field admin-fixed-cost">Cost price (USD) <span>Fixed</span><input readOnly aria-readonly="true" type="number" step="0.001" value={form.supplierCost ?? 0} /><small className="admin-cost-reference">{importCost === null ? "Locked to the saved supplier cost" : `Locked to ${editor.importSupplier || "supplier"}: $${importCost.toFixed(3)}`}</small></label>
          <label className="admin-field admin-selling-field">Selling price (USD)<span><input required type="number" min={Math.max(0.01, minimumSellingPrice)} step="0.01" aria-invalid={isBelowCost} value={form.sellingPrice ?? 0} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} /><em className={profit >= 0 ? "positive" : "negative"}>Profit: {profit >= 0 ? "+" : "-"}${Math.abs(profit).toFixed(2)}</em></span></label>
          <label className="admin-field">Custom badge<input maxLength="40" value={form.customBadge ?? ""} placeholder="e.g., 50% Off" onChange={(e) => setForm({ ...form, customBadge: e.target.value })} /></label>
          <label className="admin-field">Display order (0 is first)<input required type="number" min="0" step="1" value={form.sortOrder ?? 0} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label>
          <div className="admin-package-wide">{toggle("isActive", "Active")}</div>
        </fieldset>
        {isBelowImportCost && <p className="admin-alert error">The saved cost is behind the supplier catalog. It will use the latest supplier cost when saved.</p>}
        {isBelowCost && <p className="admin-alert error">Customer price cannot be below cost. Set the selling price to at least ${minimumSellingPrice.toFixed(2)}.</p>}
        {error && <p className="admin-alert error">{error}</p>}
        <div className="admin-dialog-actions"><button type="button" className="admin-btn secondary" onClick={onClose}>Cancel</button><button className="admin-btn primary" disabled={saving || isBelowCost}>{saving ? "Saving…" : "Save Package"}</button></div>
      </form>
    </dialog>;
  }
  return <dialog ref={dialog} className="admin-dialog" onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }}>
    <form onSubmit={(e) => { e.preventDefault(); onSave({ entity: editor.entity, ...(editor.id ? { id: editor.id } : {}), data: form }); }}>
      <div className="admin-dialog-head"><div><small>NA TOPUP EDITOR</small><h2>{editor.title}</h2></div><button type="button" className="admin-icon-btn" onClick={onClose}><X size={19} /></button></div>
      {editor.entity === "game" && <div className="admin-upload-grid"><ImageUpload label="Game logo" value={form.logoUrl} disabled={saving} onChange={(logoUrl) => setForm({ ...form, logoUrl })} /><ImageUpload label="Detail banner" value={form.bannerUrl} disabled={saving} onChange={(bannerUrl) => setForm({ ...form, bannerUrl })} /></div>}
      {editor.entity === "slide" && <ImageUpload label="Slide banner" value={form.bannerUrl} disabled={saving} onChange={(bannerUrl) => setForm({ ...form, bannerUrl })} />}
      <fieldset disabled={saving} className="admin-fields">
        {editor.entity === "game" && <>{field("name", "Game name")}{field("category", "Category")}{field("logoUrl", "Logo URL")}{field("bannerUrl", "Banner URL", "text", false)}{field("sortOrder", "Display order", "number")}{toggle("isActive", "Active on storefront")}{toggle("isPopular", "Featured game")}</>}
        {editor.entity === "slide" && <>{field("title", "Slide title")}{field("bannerUrl", "Banner URL")}{field("targetUrl", "Target URL", "text", false)}{field("sortOrder", "Display order", "number")}{toggle("isActive", "Show on storefront")}</>}
        {editor.entity === "supplier" && <>{field("priority", "Supplier priority", "number")}{toggle("isEnabled", "Enable supplier")}</>}
      </fieldset>
      {error && <p className="admin-alert error">{error}</p>}
      <p className="admin-hint">Changes are validated by the server and saved in the audit log.</p>
      <div className="admin-dialog-actions"><button type="button" className="admin-btn secondary" onClick={onClose}>Cancel</button><button className="admin-btn primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
    </form>
  </dialog>;
}

function SecurityPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [invite, setInvite] = useState("");
  const [profileForm, setProfileForm] = useState({ username: "", email: "", currentPassword: "", newPassword: "" });
  const [adminForm, setAdminForm] = useState({ username: "", email: "", password: "", role: "ADMIN" });
  const [ipForm, setIpForm] = useState({ ipAddress: "", label: "" });
  async function refresh() {
    setLoading(true);
    try {
      const next = await fetchAdminSettings();
      setData(next);
      if (next.currentAdmin) setProfileForm({ username: next.currentAdmin.username, email: next.currentAdmin.email, currentPassword: "", newPassword: "" });
      setError("");
    }
    catch (err) { setData(null); setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);
  async function action(payload, success) {
    try { const result = await updateAdminSecurity(payload); setMessage(success); setError(""); await refresh(); return result; }
    catch (err) { setError(err.message); return null; }
  }
  async function addAdmin(e) { e.preventDefault(); if (await action({ action: "add-admin", ...adminForm }, "Administrator added.")) setAdminForm({ username: "", email: "", password: "", role: "ADMIN" }); }
  async function updateProfile(e) { e.preventDefault(); await action({ action: "update-profile", ...profileForm }, "Account details updated."); }
  async function addIp(e) { e.preventDefault(); if (await action({ action: "add-ip", ...ipForm }, "IP address approved.")) setIpForm({ ipAddress: "", label: "" }); }
  async function createInvite() { const result = await action({ action: "create-invite", expiresInMinutes: 30 }, "One-time invite created."); if (result?.url) setInvite(result.url); }
  return <div className="admin-security">
    {error && <p className="admin-alert error">{error}</p>}{message && <p className="admin-alert success">{message}</p>}
    <div className="admin-security-status"><span>{loading ? "Loading security settings…" : data ? "Security settings loaded" : "Security settings unavailable"}</span><button type="button" className="admin-btn secondary" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} />Retry</button></div>
    <div className="admin-form-grid">
      <form className="admin-card admin-form-card admin-profile-card" onSubmit={updateProfile}><Settings /><div><h3>My administrator account</h3><p>Change your username, email, or password. Confirm with your current password.</p></div><label className="admin-field">Username<input required value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} /></label><label className="admin-field">Email<input required type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} /></label><label className="admin-field">Current password<input required type="password" autoComplete="current-password" value={profileForm.currentPassword} onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })} /></label><label className="admin-field">New password <small>(leave blank to keep it)</small><input minLength={10} type="password" autoComplete="new-password" value={profileForm.newPassword} onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })} /></label><button className="admin-btn primary">Update my account</button></form>
      <form className="admin-card admin-form-card" onSubmit={addAdmin}><UserPlus /><div><h3>Add administrator</h3><p>Create an admin or operator account.</p></div><label className="admin-field">Username<input required value={adminForm.username} onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })} /></label><label className="admin-field">Email<input required type="email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} /></label><label className="admin-field">Temporary password<input required minLength={10} type="password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} /></label><select value={adminForm.role} onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}><option value="ADMIN">Admin</option><option value="OPERATOR">Operator</option></select><button className="admin-btn primary">Add account</button></form>
      <form className="admin-card admin-form-card" onSubmit={addIp}><ShieldCheck /><div><h3>Approve an IP</h3><p>Permit a trusted network to access admin pages.</p></div><label className="admin-field">IP address<input required value={ipForm.ipAddress} onChange={(e) => setIpForm({ ...ipForm, ipAddress: e.target.value })} /></label><label className="admin-field">Label<input value={ipForm.label} onChange={(e) => setIpForm({ ...ipForm, label: e.target.value })} /></label><button className="admin-btn primary">Approve IP</button></form>
    </div>
    <section className="admin-card admin-invite"><div><Link2 /><h3>One-time secret URL</h3><p>The first visitor is whitelisted and the link is consumed.</p></div><button className="admin-btn primary" onClick={createInvite}>Create 30-minute link</button>{invite && <div className="admin-copy"><input readOnly value={invite} /><button className="admin-icon-btn" onClick={() => navigator.clipboard?.writeText(invite)}><Copy size={17} /></button></div>}</section>
    <div className="admin-form-grid">
      <section className="admin-card"><h3>Admin accounts</h3><div className="admin-list">{data?.admins?.map((admin) => <div key={admin.id}><span><strong>{admin.username}</strong><small>{admin.email} · {admin.role}</small></span>{admin.role !== "SUPERADMIN" && <button onClick={() => action({ action: "toggle-admin", id: admin.id, isActive: !admin.isActive }, admin.isActive ? "Account disabled." : "Account enabled.")} className={admin.isActive ? "state-on" : "state-off"}>{admin.isActive ? "Active" : "Disabled"}</button>}</div>)}{!loading && data && !data.admins?.length && <Empty>No administrator accounts found.</Empty>}</div></section>
      <section className="admin-card"><h3>IP allowlist</h3><div className="admin-list">{data?.allowlist?.map((entry) => <div key={entry.id}><span><strong>{entry.ipAddress}</strong><small>{entry.label || "No label"}</small></span>{entry.locked ? <em>Environment</em> : entry.isActive && <button className="remove" onClick={() => action({ action: "remove-ip", id: entry.id }, "IP removed.")}>Remove</button>}</div>)}{!loading && data && !data.allowlist?.length && <Empty>No approved IP addresses found.</Empty>}</div></section>
    </div>
  </div>;
}

export const AdminDashboard = ({ adminSession }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("orders");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [packageCategory, setPackageCategory] = useState("ALL");
  const [packageGame, setPackageGame] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [liveBalances, setLiveBalances] = useState(null);
  const [profitLoading, setProfitLoading] = useState(false);
  const [profitError, setProfitError] = useState("");
  const [profitUpdatedAt, setProfitUpdatedAt] = useState("");
  const visibleTabs = adminSession?.role === "SUPERADMIN" ? tabs : tabs.filter(([id]) => id !== "security");

  const refresh = useCallback(async () => { setLoading(true); setError(""); try { setData(await fetchAdminDashboard()); } catch (err) { setError(err.message); } finally { setLoading(false); } }, []);
  const refreshProfit = useCallback(async () => {
    setProfitLoading(true); setProfitError("");
    const [dashboardResult, walletResult] = await Promise.allSettled([fetchAdminDashboard(), fetchAdminSuppliers()]);
    if (dashboardResult.status === "fulfilled") setData(dashboardResult.value);
    if (walletResult.status === "fulfilled") {
      setLiveBalances(walletResult.value.liveBalances || []);
      setProfitUpdatedAt(walletResult.value.updatedAt || new Date().toISOString());
    }
    const failures = [dashboardResult, walletResult]
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason?.message || "Live data request failed");
    if (failures.length) setProfitError(failures.join(" "));
    setProfitLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (activeTab !== "profit") return undefined;
    refreshProfit();
    const interval = window.setInterval(refreshProfit, 30000);
    return () => window.clearInterval(interval);
  }, [activeTab, refreshProfit]);
  function selectTab(id) { setActiveTab(id); setSearch(""); setMobileOpen(false); }
  function matches(item) { return JSON.stringify(item).toLowerCase().includes(search.trim().toLowerCase()); }
  function edit(entity, item) {
    const fields = { game: ["name", "category", "logoUrl", "bannerUrl", "sortOrder", "isActive", "isPopular"], package: ["name", "amount", "iconUrl", "customBadge", "category", "sortOrder", "isActive", "supplierCost", "sellingPrice", "discount"], slide: ["title", "bannerUrl", "targetUrl", "sortOrder", "isActive"], supplier: ["priority", "isEnabled"] };
    const source = entity === "package" ? { ...item, category: item.isPopular ? "pass" : item.isFeatured ? "other" : "normal", supplierCost: item.importCost ?? item.price?.supplierCost ?? 0, sellingPrice: item.price?.sellingPrice || 0, discount: item.price?.discount || 0 } : item;
    setSaveError(""); setEditor({ entity, id: item.id, title: `${item.id ? "Edit" : "Add"} ${entity}`, gameSlug: entity === "package" ? item.game?.slug : null, importCost: entity === "package" ? item.importCost : null, importSupplier: entity === "package" ? item.importSupplier : null, data: Object.fromEntries(fields[entity].map((name) => [name, source[name] ?? ""])) });
  }
  async function save(mutation) {
    if (mutation.entity === "package") {
      const cost = Number(mutation.data.supplierCost);
      const sellingPrice = Number(mutation.data.sellingPrice);
      const discount = Number(mutation.data.discount);
      if (![cost, sellingPrice, discount].every(Number.isFinite) || sellingPrice - discount + Number.EPSILON < cost) {
        setSaveError("Customer price cannot be below the cost price.");
        return;
      }
    }
    setSaving(true); setSaveError("");
    try { await saveAdminDashboardMutation(mutation); setEditor(null); await refresh(); setNotice("Changes saved to NA TOPUP."); }
    catch (err) { setSaveError(err.message); }
    finally { setSaving(false); }
  }
  async function signOut() { await logoutAdmin(); navigate("/admin/login", { replace: true }); }
  function exportOrders() {
    const rows = [["Order", "Created", "Game", "Package", "Player", "USD", "Status"], ...filteredOrders.map((o) => [o.publicOrderId, o.createdAt, o.game.name, o.product.name, o.playerName || o.playerId, o.total, o.status])];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv" })); const link = document.createElement("a"); link.href = url; link.download = "na-topup-orders.csv"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const filteredOrders = (data?.orders || []).filter(matches).filter((o) => status === "ALL" || o.status === status);
  const filtered = (items) => (items || []).filter(matches);
  const catalogOrder = ["best-selling", "pass", "normal", "other"];
  const packageCatalogs = [...new Map((data?.products || []).map((product) => {
    const catalog = packageCatalog(product);
    return [catalog.id, catalog];
  })).values()].sort((a, b) => catalogOrder.indexOf(a.id) - catalogOrder.indexOf(b.id));
  const packageGames = [...new Map((data?.products || [])
    .filter((product) => packageCategory === "ALL" || packageCatalog(product).id === packageCategory)
    .filter((product) => product.game?.id && product.game?.name)
    .map((product) => [product.game.id, product.game])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const filteredPackages = (data?.products || []).filter(matches)
    .filter((product) => packageCategory === "ALL" || packageCatalog(product).id === packageCategory)
    .filter((product) => packageGame === "ALL" || product.game?.id === packageGame)
    .sort(comparePackagesSmallToLarge);
  const filteredGames = filtered(data?.games);
  const filteredSlides = filtered(data?.slides);
  const filteredUsers = filtered(data?.users);
  const filteredSuppliers = filtered(data?.suppliers);
  const current = visibleTabs.find(([id]) => id === activeTab) || visibleTabs[0];
  const CurrentIcon = current[2];
  const metrics = data?.metrics || {};
  const nav = visibleTabs.map(([id, label, Icon]) => <button key={id} className={activeTab === id ? "active" : ""} onClick={() => selectTab(id)}><Icon size={17} /><span>{label}</span></button>);

  return <div className="admin-shell">
    <header className="admin-topbar"><div className="admin-topbar-inner"><button className="admin-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><Brand /><nav className="admin-desktop-tabs">{nav}</nav><button className="admin-icon-btn admin-logout" onClick={signOut} aria-label="Sign out"><LogOut size={18} /></button></div></header>
    {mobileOpen && <div className="admin-backdrop" onClick={(e) => e.target === e.currentTarget && setMobileOpen(false)}><aside className="admin-drawer"><div><Brand /><button className="admin-icon-btn" onClick={() => setMobileOpen(false)}><X /></button></div><nav>{nav}</nav></aside></div>}
    <main className="admin-page">
      <section className="admin-hero"><div><span className="admin-eyebrow"><i /> NA TOPUP OPERATIONS</span><h1><span>NA TOPUP</span></h1><p>{data ? `Last loaded ${new Date(data.updatedAt).toLocaleString()}` : "Loading your store records."}</p></div><div className="admin-actions"><a className="admin-btn secondary" href="/" target="_blank">View store <ArrowUpRight size={16} /></a><button className="admin-btn secondary" onClick={() => activeTab === "profit" ? refreshProfit() : refresh()} disabled={loading || profitLoading}><RefreshCw size={16} className={loading || profitLoading ? "spin" : ""} />{loading || profitLoading ? "Loading…" : "Refresh"}</button></div></section>
      <nav className="admin-mobile-tabs">{nav}</nav>
      {error && <p className="admin-alert error">{error}</p>}{notice && <p className="admin-alert success">{notice}</p>}
      {!data ? <Empty>{loading ? "Loading NA TOPUP records…" : "No data loaded."}</Empty> : <section className="admin-panel">
        <div className="admin-panel-head"><div className="admin-section-title"><span><CurrentIcon size={20} /></span><div><h2>{current[1]}</h2><p>{pageDescriptions[activeTab]}</p></div></div>{activeTab === "slides" && <button className="admin-btn primary" onClick={() => edit("slide", { title: "", bannerUrl: "", targetUrl: "", sortOrder: 0, isActive: false })}><Plus size={16} />Add slide</button>}</div>
        {activeTab !== "security" && activeTab !== "profit" && <div className="admin-toolbar"><label className="admin-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${current[1].toLowerCase()}…`} /></label>{activeTab === "orders" && <div className="admin-actions"><label className="admin-field">Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All statuses</option>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="admin-btn secondary" onClick={exportOrders}>Export CSV</button></div>}{activeTab === "packages" && <div className="admin-actions"><label className="admin-field">Catalog<select value={packageCategory} onChange={(e) => { setPackageCategory(e.target.value); setPackageGame("ALL"); }}><option value="ALL">All catalogs</option>{packageCatalogs.map((catalog) => <option value={catalog.id} key={catalog.id}>{catalog.label}</option>)}</select></label><label className="admin-field">Game<select value={packageGame} onChange={(e) => setPackageGame(e.target.value)}><option value="ALL">All games</option>{packageGames.map((game) => <option value={game.id} key={game.id}>{game.name}</option>)}</select></label></div>}</div>}
        {activeTab === "orders" && <div className="admin-orders-view">
          <div className="admin-summary admin-order-summary">
            <article><ClipboardCheck /><span><small>Total orders</small><strong>{data.orderCount}</strong><em>{data.orders.length} recent records loaded</em></span></article>
            <article><WalletCards /><span><small>Paid revenue</small><strong>{money(metrics.revenue)}</strong><em>{metrics.paidOrders || 0} paid or processing</em></span></article>
            <article><Boxes /><span><small>Delivered</small><strong>{metrics.completed}</strong><em>{data.orderCount ? ((metrics.completed / data.orderCount) * 100).toFixed(1) : 0}% completion rate</em></span></article>
          </div>
          <div className="admin-orders-meta"><p><strong>{filteredOrders.length}</strong> orders match your current search and status filter.</p><span>Newest first</span></div>
          <div className="admin-table admin-orders-table">
            <div className="admin-order-table-head" aria-hidden="true"><span>Order</span><span>Game & package</span><span>Customer</span><span>Payment</span><span>Status</span></div>
            {filteredOrders.map((order) => <article className="admin-order-row" key={order.id}>
              <div className="admin-order-identity"><span className="admin-order-icon"><ClipboardCheck size={17} /></span><span><small>Order ID</small><strong>{order.publicOrderId}</strong><em>{new Date(order.createdAt).toLocaleString()}</em></span></div>
              <div className="admin-order-product"><Picture url={order.product.iconUrl || order.game.logoUrl} name={order.game.name} /><span><small>Game & package</small><strong>{order.game.name}</strong><em>{order.product.name}</em></span></div>
              <div className="admin-order-customer"><small>Customer</small><strong>{order.playerName || "Player account"}</strong><em>{order.playerId}</em></div>
              <div className="admin-order-payment"><small>Payment</small><strong>{money(order.total)}</strong><em className={`admin-payment-state ${(order.payment?.status || "unpaid").toLowerCase()}`}>{order.payment?.status || "No payment"}</em></div>
              <div className="admin-order-status"><small>Status</small><b className={`admin-status ${order.status.toLowerCase()}`}>{labels[order.status] || order.status}</b></div>
            </article>)}
            {!filteredOrders.length && <Empty>No orders match your current filters.</Empty>}
          </div>
        </div>}
        {activeTab === "profit" && <>{profitError && <p className="admin-alert error">{profitError}</p>}<div className="admin-summary"><article><WalletCards /><span><small>Revenue</small><strong>{money(metrics.revenue)}</strong><em>Paid orders</em></span></article><article><Boxes /><span><small>Supplier costs</small><strong>{money(metrics.cost)}</strong><em>Order cost snapshots</em></span></article><article><WalletCards /><span><small>Gross profit</small><strong>{money((metrics.revenue || 0) - (metrics.cost || 0))}</strong><em>{metrics.revenue ? (((metrics.revenue - metrics.cost) / metrics.revenue) * 100).toFixed(1) : 0}% margin</em></span></article></div><p className="admin-hint inset">Automatically refreshes every 30 seconds{profitUpdatedAt ? ` · Supplier wallets checked ${new Date(profitUpdatedAt).toLocaleTimeString()}` : ""}.</p><div className="admin-card-grid">{liveBalances?.map((wallet) => <article className="admin-card admin-wallet-card" key={wallet.supplier}><div className="admin-card-title"><WalletCards /><div><h3>{wallet.supplier}</h3><p>{wallet.accountName || "Supplier account"}</p></div></div><strong className="admin-amount">{wallet.isHealthy ? `${Number(wallet.balance).toFixed(2)} ${wallet.currency}` : "Unavailable"}</strong><div className="admin-tags"><span className={wallet.isHealthy ? "wallet-online" : "wallet-offline"}>{wallet.isHealthy ? "Live" : "Connection failed"}</span></div><p>{wallet.isHealthy ? `Checked ${new Date(wallet.lastChecked).toLocaleString()}` : wallet.errorMessage || "Could not retrieve the live balance."}</p></article>)}{liveBalances && !liveBalances.length && <Empty>No supplier wallets are configured.</Empty>}{!liveBalances && <Empty>{profitLoading ? "Loading live supplier balances…" : "Live balances have not loaded."}</Empty>}</div></>}
        {activeTab === "games" && <div className="admin-collection-view"><div className="admin-collection-meta"><p><strong>{filteredGames.length}</strong> of {data.games.length} games</p><span>Storefront catalogue</span></div><div className="admin-card-grid">{filteredGames.map((game) => <article className="admin-card admin-entity-card" key={game.id}><div className="admin-card-title"><Picture url={game.logoUrl} name={game.name} /><div><small>Game</small><h3>{game.name}</h3><p>{game.category || "Uncategorized"}</p></div></div><div className="admin-tags"><span className={game.isActive ? "tag-active" : "tag-hidden"}>{game.isActive ? "Active" : "Hidden"}</span>{game.isPopular && <span className="tag-featured">Featured</span>}<span>Order {game.sortOrder}</span></div><div className="admin-card-footer"><p>{game.isActive ? "Visible on the storefront" : "Not visible to customers"}</p><button className="admin-btn secondary" onClick={() => edit("game", game)}><Pencil size={15} />Edit</button></div></article>)}{!filteredGames.length && <Empty>No games match your search.</Empty>}</div></div>}
        {activeTab === "packages" && <div className="admin-collection-view"><div className="admin-collection-meta"><p><strong>{filteredPackages.length}</strong> of {data.products.length} packages</p><span>{packageCategory === "ALL" ? "All storefront catalogs" : packageCatalogs.find((catalog) => catalog.id === packageCategory)?.label} · Smallest to largest</span></div><div className="admin-card-grid admin-package-grid">{filteredPackages.map((product) => <article className="admin-card admin-entity-card admin-package-card" key={product.id}><div className="admin-card-title"><Picture url={product.iconUrl || product.game.logoUrl} name={product.game.name} /><div><small>{packageCatalog(product).label}</small><h3>{product.name}</h3><p>{product.game.name}</p></div></div><div className="admin-price-block"><span>Customer price</span><strong>{product.price ? money(product.price.sellingPrice - product.price.discount) : "No price"}</strong><small>{product.price ? `Fixed cost ${money(product.importCost ?? product.price.supplierCost)} · Discount ${money(product.price.discount)}` : "Pricing record unavailable"}</small></div><div className="admin-tags"><span className={product.isActive ? "tag-active" : "tag-hidden"}>{product.isActive ? "Active" : "Hidden"}</span><span className={["best-selling", "pass"].includes(packageCatalog(product).id) ? "tag-featured" : ""}>{packageCatalog(product).label}</span>{product.customBadge && <span>{product.customBadge}</span>}</div><div className="admin-card-footer"><p>Order {product.sortOrder}</p><button className="admin-btn secondary" disabled={!product.price} onClick={() => edit("package", product)}><Pencil size={15} />Edit</button></div></article>)}{!filteredPackages.length && <Empty>No packages match this catalog, game, and search.</Empty>}</div></div>}
        {activeTab === "slides" && <div className="admin-collection-view"><div className="admin-collection-meta"><p><strong>{filteredSlides.length}</strong> of {data.slides.length} slides</p><span>Homepage promotions</span></div><div className="admin-card-grid admin-slide-grid">{filteredSlides.map((slide) => <article className="admin-card admin-entity-card admin-slide-card" key={slide.id}><div className="admin-banner-wrap">{slide.bannerUrl ? <img className="admin-banner" src={slide.bannerUrl} alt="" /> : <span><Images size={22} />No banner image</span>}</div><div><small>Promotion</small><h3>{slide.title}</h3></div><div className="admin-tags"><span className={slide.isActive ? "tag-active" : "tag-hidden"}>{slide.isActive ? "Active" : "Hidden"}</span><span>Order {slide.sortOrder}</span></div><div className="admin-card-footer"><p>{slide.targetUrl || "No target link"}</p><button className="admin-btn secondary" onClick={() => edit("slide", slide)}><Pencil size={15} />Edit</button></div></article>)}{!filteredSlides.length && <Empty>No slides match your search.</Empty>}</div></div>}
        {activeTab === "users" && <div className="admin-collection-view"><div className="admin-collection-meta"><p><strong>{filteredUsers.length}</strong> of {data.users.length} recent users</p><span>Newest first</span></div><div className="admin-card-grid">{filteredUsers.map((user) => <article className="admin-card admin-entity-card admin-user-card" key={user.id}><div className="admin-card-title"><span className="admin-user-avatar">{(user.name || user.email || "U").slice(0, 2).toUpperCase()}</span><div><small>Customer</small><h3>{user.name || "Unnamed user"}</h3><p>{user.email || "No email address"}</p></div></div><div className="admin-user-stat"><strong>{user._count.orders}</strong><span>Total orders</span></div><div className="admin-card-footer"><p>Joined {new Date(user.createdAt).toLocaleDateString()}</p><span className="admin-readonly-label">Read only</span></div></article>)}{!filteredUsers.length && <Empty>No users match your search.</Empty>}</div></div>}
        {activeTab === "suppliers" && <div className="admin-collection-view"><div className="admin-collection-meta"><p><strong>{filteredSuppliers.length}</strong> of {data.suppliers.length} suppliers</p><span>Routing configuration</span></div><div className="admin-card-grid">{filteredSuppliers.map((supplier) => <article className="admin-card admin-entity-card admin-supplier-card" key={supplier.id}><div className="admin-card-title"><span className="admin-supplier-icon"><Boxes size={21} /></span><div><small>{supplier.code}</small><h3>{supplier.name}</h3><p>Fulfilment provider</p></div></div><div className="admin-tags"><span className={supplier.isEnabled ? "tag-active" : "tag-hidden"}>{supplier.isEnabled ? "Enabled" : "Disabled"}</span><span>Priority {supplier.priority}</span></div><div className="admin-health-row"><span>Stored health</span><strong>{supplier.healthStatus || "Unknown"}</strong></div><div className="admin-card-footer"><p>{supplier.lastChecked ? `Checked ${new Date(supplier.lastChecked).toLocaleString()}` : "Not checked yet"}</p><button className="admin-btn secondary" onClick={() => edit("supplier", supplier)}><Pencil size={15} />Configure</button></div></article>)}{!filteredSuppliers.length && <Empty>No suppliers match your search.</Empty>}</div></div>}
        {activeTab === "security" && <SecurityPanel />}
      </section>}
    </main>
    {editor && <Editor editor={editor} saving={saving} error={saveError} onClose={() => setEditor(null)} onSave={save} />}
  </div>;
};
