# Yard ERP

ERP for a construction-materials yard (M-sand, metal, GSP, dust, cement, bricks).
Single yard · India · no GST · web + mobile · roles: Super Admin / Admin / Employee.

## Modules
Purchases · Gate Pass & Loading Pass · Sales & Billing · Stock Monitoring ·
Accounts · Vendor & Customer Management · Inventory · Day-wise stock close ·
Analytical reports (Daily / Monthly / Yearly) · Payment follow-up reminders (in-app) ·
Transport & freight · Credit & ledgers · Offline mobile entry.

## Tech stack
| Part | Tech |
|------|------|
| Backend API | NestJS (TypeScript) + Prisma |
| Database | PostgreSQL |
| Web (admin) | React + Vite |
| Mobile (field) | React Native (Expo), offline-first |
| Auth | JWT + role-based access control |

## Repository layout
```
backend/    NestJS API + Prisma schema  (built first)
web/         React admin/super-admin app
mobile/      Expo employee app (offline sale/purchase/payment/passes)
docs/        architecture & specs
```

## Prerequisites (install these first)
1. **Node.js LTS v20+** — https://nodejs.org  (or `winget install OpenJS.NodeJS.LTS`)
2. **A PostgreSQL database** — pick one:
   - **Neon** (cloud, easiest): sign up at https://neon.tech, create a project, copy the connection string.
   - **Local Postgres**: `winget install PostgreSQL.PostgreSQL.16`, then create a `yarderp` database.
   - **Docker**: install Docker Desktop, then `docker run --name yarderp-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=yarderp -p 5432:5432 -d postgres:16`.

## Backend setup
```bash
cd backend
cp .env.example .env          # then paste your DATABASE_URL and set JWT secrets
npm install
npm run prisma:generate
npm run prisma:migrate        # creates all tables
npm run db:seed               # creates super admin + material catalog
npm run start:dev             # API on http://localhost:3000
```

> Default super admin login comes from `.env` (`SEED_ADMIN_PHONE` / `SEED_ADMIN_PASSWORD`). Change them.

## Status
- [x] Requirements finalized
- [x] Repo scaffold + full database schema (migrated to Neon)
- [x] Backend: auth + RBAC (JWT login, role guards) — tested live
- [x] Backend: master data (materials, customers, vendors, vehicles) — tested live
- [x] Backend: purchases + inventory IN — tested live
- [x] Backend: sales + billing + gate/loading passes + inventory OUT — tested live
- [x] Backend: payments + ledgers + credit/outstanding — tested live
- [x] Backend: offline idempotency (clientUuid) on sales/purchases/payments — tested live
- [x] Backend: day-close (per-material opening/in/out/closing, locked) — tested live
- [x] Backend: reports/analytics (daily, summary, material breakdown, day/month series) — tested live
- [x] Backend: in-app payment reminders + daily IST cron — tested live
- [x] **Backend feature-complete**
- [x] Web admin app (React + Vite): login, dashboard, sales, purchases, payments,
      stock, customers/vendors + ledgers, materials, day-close, reports, notifications — verified in browser
- [ ] Mobile app + offline sync

### Web app
```bash
cd web
cp .env.example .env    # optional; defaults to http://localhost:3000/api
npm install
npm run dev             # http://localhost:5173
```
Both servers are registered in `.claude/launch.json` (backend + web).

### Quick start (already set up)
```bash
cd backend
npm run start:dev     # API on http://localhost:3000/api
```
Login: POST `/api/auth/login` with `{ "phone": "9999999999", "password": "changeme123" }`.

See [docs/architecture.md](docs/architecture.md).
