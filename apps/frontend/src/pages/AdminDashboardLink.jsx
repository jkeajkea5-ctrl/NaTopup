import React from "react";

export const AdminDashboardLink = () => (
  <section className="mx-auto max-w-lg rounded-3xl border border-brand-border bg-white p-8 text-center shadow-card">
    <h1 className="font-heading text-2xl text-brand-text">NA TOPUP Admin</h1>
    <p className="my-4 text-sm text-brand-muted">Sign in from an approved network to open the secured dashboard.</p>
    <a className="inline-flex rounded-xl bg-brand-violet px-5 py-3 font-semibold text-white" href="/admin/login">Admin sign in</a>
  </section>
);
