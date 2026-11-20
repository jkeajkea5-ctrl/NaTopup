# Lukas Game Top-Up Platform

Monorepo for the Lukas Cambodia game top-up platform.

## Structure

- `apps/frontend` — Vite/React storefront and admin UI
- `apps/backend` — Next.js API, Prisma, payments, suppliers, and scheduled jobs
- `packages/shared` — shared TypeScript types, schemas, and pricing logic
- `tests` — unit and integration tests

## Local development

1. Copy `.env.example` to `.env` and replace placeholder values as needed.
2. Install dependencies with `npm install`.
3. Generate Prisma client with `npm run prisma:generate`.
4. Start both applications with `npm run dev`.

The frontend runs on `http://localhost:5173`; the backend runs on `http://localhost:3001`.

## Admin security

Admin pages and admin APIs require both a signed login session and an approved IP address. Set `AUTH_SECRET` (32+ random characters), `ADMIN_INITIAL_PASSWORD`, `ADMIN_ALLOWED_IPS` (comma-separated IPv4/IPv6 addresses), and `ADMIN_DASHBOARD_ORIGIN` in `apps/backend/.env` before seeding. The seeded `admin` account is the `SUPERADMIN`; use the configured initial password and change it before production.

From the dashboard’s Security tab, the SUPERADMIN can add admin/operator accounts, manage the IP allowlist, and create a one-time 30-minute invite link. Opening that link adds the visitor’s observed IP to the allowlist and sends them to the login page. Visitors from other IPs are redirected to the storefront, and their admin API requests are rejected.

## Useful commands

- `npm test` — run the root test suite
- `npm run build` — build shared, backend, and frontend packages
- `npm run prisma:seed` — seed local development data

Never commit `.env`, payment credentials, supplier API keys, database files, generated build output, or catalogue backups.

## Before an event

Run `npm test` and `npm run build`. The test command covers checkout, pricing,
payment callbacks, and backend regression tests without making real purchases.

The deployed backend needs a private `CRON_SECRET`, matching the scheduler's
bearer token, and a public HTTPS `BACKEND_URL` for bank callbacks. Cron endpoints
reject requests when the secret is missing. Confirm the every-minute recovery
job succeeds in the hosting logs; local environment checks do not verify hosted
settings. Set `FRONTEND_URL` to the public storefront for payment returns.

Check supplier funds against the expected event sales and keep a paid test
receipt that confirms delivery to the intended Mobile Legends account before
opening event traffic. A dismissed or expired QR can still settle: the original
payment reference stays intact and provider-confirmed funds remain recoverable.
Use a new checkout to change payment providers or replace an expired session.
