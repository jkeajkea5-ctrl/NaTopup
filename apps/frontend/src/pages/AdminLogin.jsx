import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, LockKeyhole, Mail } from "lucide-react";
import { fetchAdminSession, loginAdmin, redeemAdminInvite } from "../services/api";
import "./AdminDashboard.css";

export const AdminLogin = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const invite = params.get("invite");
    (async () => {
      let inviteError = "";
      try {
        if (invite) {
          try {
            const redeemed = await redeemAdminInvite(invite);
            window.history.replaceState({}, "", "/admin/login");
            if (active) { setMessageType("success"); setMessage(`This network (${redeemed.ip}) is now approved. You can sign in.`); }
          } catch (error) {
            inviteError = error.message || "This approval link is invalid or expired.";
          }
        }
        const session = await fetchAdminSession();
        if (!active) return;
        if (!session.allowed) { navigate("/", { replace: true }); return; }
        if (session.authenticated) navigate("/admin", { replace: true });
        else if (inviteError) { setMessageType("error"); setMessage(inviteError); }
      } catch {
        if (active) navigate("/", { replace: true });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [navigate, params]);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setMessageType("error");
    try {
      await loginAdmin(username, password);
      navigate("/admin", { replace: true });
    } catch (error) {
      setMessage(error.message || "Sign in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="admin-login-page"><Loader2 className="spin" /></div>;
  return (
    <main className="admin-login-page">
      <form onSubmit={submit} className="admin-login-card">
        <section className="admin-login-form-panel">
          <img className="admin-login-logo" src="/na-topup-brand-uppercase-2026.png" alt="NA TOPUP" />
          <div className="admin-login-heading"><h1>Welcome Back</h1><p>Sign in to access the NA TOPUP admin dashboard</p></div>
          <label className="admin-login-field"><span>Username or Email</span><div><Mail size={20} /><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="admin or admin@example.com" required /></div></label>
          <label className="admin-login-field"><span>Password</span><div><LockKeyhole size={20} /><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="••••••••" required /></div></label>
          {message && <p className={`admin-alert ${messageType}`}>{message}</p>}
          <button disabled={submitting} className="admin-login-submit">{submitting ? "Signing In…" : "Sign In"}</button>
        </section>
      </form>
    </main>
  );
};
