# Architecture

## Overview
One backend API serves both the web admin app and the mobile field app.
PostgreSQL is the single source of truth. Mobile works offline and syncs.

```
  Web (React)  ─┐
                ├─► NestJS REST API ─► PostgreSQL (Prisma)
  Mobile (Expo)─┘        │
                         └─► in-app notifications, day-close jobs
```

## Roles & access (RBAC)
| Capability | Super Admin | Admin | Employee |
|---|---|---|---|
| Manage users | ✓ | – | – |
| Master data (materials, rates, customers, vendors, vehicles) | ✓ | ✓ | view |
| Create sale / purchase / payment | ✓ | ✓ | ✓ |
| Gate pass / loading pass | ✓ | ✓ | ✓ |
| Cancel / edit confirmed txns | ✓ | ✓ | – |
| Day close | ✓ | ✓ | – |
| Reports & analytics | ✓ | ✓ | limited |
| Ledgers / outstanding | ✓ | ✓ | – |

## Core flows
- **Purchase** → confirm → `StockMovement` IN → `Material.currentStock` up → vendor `LedgerEntry` (credit) → optional `Payment` OUT.
- **Sale** → confirm → `StockMovement` OUT → stock down → bill number → customer `LedgerEntry` (debit) → `Payment` IN (cash/upi) or CREDIT → optional Gate/Loading pass.
- **Payment** → adjusts party ledger + running balance.
- **Day close** → per material: opening = prev closing, in/out summed from movements, closing locked into `DayClose` (unique per date+material).
- **Payment reminder** → scheduled scan of customer outstanding vs due → `Notification` (in-app).

## Offline sync (mobile)
Offline-capable entities: **sale, purchase, payment, gate pass, loading pass**.
- Each carries a client-generated `clientUuid` (unique) → server upserts on it, so replays never duplicate.
- Mobile queues writes locally (SQLite/WatermelonDB); on reconnect it pushes the queue and pulls master-data/ref updates.
- Stock and ledger balances are recomputed authoritatively on the server at sync time (client shows optimistic values).
- Conflict rule: server is authoritative for balances; client entries are append-only facts.

## Money & quantities
- Amounts: `Decimal(14,2)` in ₹. Quantities: `Decimal(14,3)` (cft can be fractional).
- No GST/tax fields (per requirement). Freight and discount are line-level on the txn.

## Build order
1. Auth + RBAC  2. Master data  3. Purchases + inventory  4. Sales + billing + passes
5. Payments + ledgers  6. Day close + reports  7. Web app  8. Mobile + offline sync.
