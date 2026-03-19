# RoomSplit 🏠

> Smart rent splitting and expense management for roommates — built for India, powered by UPI.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [How It Works](#how-it-works)
- [Roles & Permissions](#roles--permissions)
- [Architecture Decisions](#architecture-decisions)
- [Roadmap](#roadmap)

---

## Overview

RoomSplit is a full-stack web application that helps roommates manage shared rent and expenses. An admin creates a group, invites roommates, sets up monthly rent cycles, and collects payments via UPI. Members receive notifications, can view their payment history, and track shared expenses — all in one place.

---

## Features

### Authentication
- Phone number + OTP login (no passwords)
- JWT access tokens (in-memory) + refresh tokens (hashed in DB)
- Profile setup on first login

### Groups
- Create a group with configurable rent cycle (monthly or custom)
- Invite members via a shareable invite code (expires in 7 days)
- One user can be in multiple groups simultaneously
- Soft delete — group data is preserved for audit

### Rent Cycles
- Admin creates a cycle per period (e.g. "January 2025") with a total amount and due date
- On activation, rent is split equally across all active members
- Each member gets a Payment record and a push notification
- Cycle states: `draft → active → closed`

### UPI Payments
- Auto-generated UPI deep link and QR code per payment
- Member marks payment as paid by entering their UTR (transaction reference)
- Admin confirms or rejects; optional auto-confirm mode
- Payment states: `pending → marked_paid → confirmed / rejected`

### Wallet & Ledger
- Group wallet tracks collected rent balance (stored in paise, never floats)
- Full ledger showing all credit/debit transactions per member
- Withdrawal requests with admin approval flow

### Expenses
- Members log shared expenses (groceries, utilities, etc.)
- Equal split across members with approval workflow
- Separate from rent — tracked independently

### Notifications
- In-app notification drawer with unread count
- Triggered for: rent due, payment confirmed/rejected, rent reminders (1 day before due)
- Celery background tasks for daily reminders and overdue payment expiry

### Audit Log
- Tamper-resistant audit trail for all critical actions
- PostgreSQL-level RULE blocks UPDATE/DELETE on audit rows
- Viewable by admin/co-admin

### Analytics
- Group-level rent collection progress
- Per-member payment summaries
- Expense breakdowns

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12, FastAPI 0.115, SQLAlchemy 2.0 (async) |
| **Frontend** | React 18, TypeScript 5.7, Vite 6 |
| **Database** | PostgreSQL 16 |
| **Cache / Queue** | Redis 7 |
| **Background Tasks** | Celery 5.4 (worker + beat) |
| **Auth** | JWT (python-jose), OTP via Twilio (console in dev) |
| **UPI / QR** | qrcode + Pillow |
| **UI Components** | Radix UI primitives, Tailwind CSS 3 |
| **State Management** | Zustand (auth), TanStack Query v5 (server state) |
| **Forms** | React Hook Form + Zod |
| **Charts** | Recharts |
| **Reverse Proxy** | Nginx |
| **Containerisation** | Docker Compose |

---

## Project Structure

```
roomsplit/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Settings (pydantic-settings)
│   │   ├── database.py          # Async SQLAlchemy session
│   │   ├── dependencies.py      # get_current_active_user
│   │   ├── models/              # SQLAlchemy ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── routers/             # FastAPI route handlers
│   │   ├── services/            # Business logic layer
│   │   ├── tasks/               # Celery tasks (reminders, expiry)
│   │   ├── middleware/          # Rate limiter
│   │   └── utils/               # Currency, security, exceptions
│   ├── alembic/                 # Database migrations
│   ├── scripts/                 # Dev seed data
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/                 # TanStack Query hooks + Axios calls
│   │   ├── components/          # Reusable UI components
│   │   ├── hooks/               # usePermission, useToast
│   │   ├── pages/               # Route-level page components
│   │   ├── store/               # Zustand auth store
│   │   ├── types/               # TypeScript interfaces
│   │   └── utils/               # Date, currency, cn helpers
│   ├── package.json
│   └── vite.config.ts
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── nginx/nginx.conf
├── docker-compose.yml
└── .env.example
```

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Git

### 1. Clone the repository

```bash
git clone https://github.com/your-username/roomsplit.git
cd roomsplit
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values (see Environment Variables below)
```

### 3. Start all services

```bash
docker-compose up --build
```

This starts:
- **PostgreSQL** on port `5432`
- **Redis** on port `6379`
- **Backend API** on port `8000` (auto-runs migrations on start)
- **Celery Worker** (background tasks)
- **Celery Beat** (scheduled tasks)
- **Frontend** on port `5173`
- **Nginx** reverse proxy on port `8080`

### 4. Open the app

```
http://localhost:8080
```

API docs (Swagger): `http://localhost:8000/docs`

### Running without Docker (development)

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**Celery (optional):**
```bash
celery -A app.tasks.celery_app worker --loglevel=info
celery -A app.tasks.celery_app beat --loglevel=info
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
# App
APP_ENV=development
APP_NAME=RoomSplit
SECRET_KEY=your-secret-key-min-32-chars
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080

# Database
DATABASE_URL=postgresql+asyncpg://roomsplit:roomsplit@postgres:5432/roomsplit
POSTGRES_USER=roomsplit
POSTGRES_PASSWORD=roomsplit
POSTGRES_DB=roomsplit

# Redis / Celery
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/1

# OTP (use 'console' in dev — prints OTP to stdout)
OTP_PROVIDER=console
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# JWT
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
```

---

## API Reference

All endpoints are prefixed with `/api/v1`. Full interactive docs at `/docs`.

| Module | Endpoints |
|--------|-----------|
| **Auth** | `POST /auth/request-otp`, `POST /auth/verify-otp`, `POST /auth/refresh`, `POST /auth/logout` |
| **Groups** | `GET/POST /groups`, `GET/PUT/DELETE /groups/{id}`, `POST /groups/join`, `POST /groups/{id}/invite` |
| **Members** | `GET /groups/{id}/members`, `DELETE /groups/{id}/members/{uid}`, `POST /groups/{id}/members/{uid}/role` |
| **Roles** | `GET/POST /groups/{id}/roles`, `PUT/DELETE /groups/{id}/roles/{rid}` |
| **Rent Cycles** | `GET/POST /groups/{id}/cycles`, `GET/PUT /groups/{id}/cycles/{cid}`, `POST /groups/{id}/cycles/{cid}/activate`, `POST /groups/{id}/cycles/{cid}/close` |
| **Payments** | `GET /groups/{id}/payments`, `POST /payments/{id}/mark-paid`, `POST /payments/{id}/confirm`, `POST /payments/{id}/reject`, `GET /payments/{id}/upi-link` |
| **Wallet** | `GET /groups/{id}/wallet`, `GET /groups/{id}/ledger` |
| **Withdrawals** | `GET/POST /groups/{id}/withdrawals`, `POST /withdrawals/{id}/approve`, `POST /withdrawals/{id}/reject` |
| **Expenses** | `GET/POST /groups/{id}/expenses`, `DELETE /groups/{id}/expenses/{eid}` |
| **Notifications** | `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all` |
| **Analytics** | `GET /groups/{id}/analytics/summary`, `GET /groups/{id}/analytics/members` |
| **Audit** | `GET /groups/{id}/audit-logs` |

---

## How It Works

### Payment Flow

```
Admin creates Rent Cycle (draft)
        ↓
Admin activates cycle
        ↓ (auto)
System splits total equally → creates Payment per member
Member receives notification "Rent Due"
        ↓
Member pays via UPI (scans QR / uses deep link)
Member marks payment as paid + enters UTR number
        ↓
Admin confirms → Payment = confirmed
  (or auto-confirm if group setting is ON)
        ↓
Wallet balance updated, ledger entry created
```

### Token Flow

```
Login → access token (JWT, 30 min, stored in memory)
      + refresh token (hashed SHA-256, 30 days, stored in DB)

On expiry → POST /auth/refresh with refresh token cookie
          → new access token issued
```

---

## Roles & Permissions

Each group has three built-in system roles:

| Permission | Admin | Co-Admin | Member |
|-----------|:-----:|:--------:|:------:|
| Edit group settings | ✅ | | |
| Delete group | ✅ | | |
| Create/activate rent cycles | ✅ | ✅ | |
| Confirm/reject payments | ✅ | ✅ | |
| Invite members | ✅ | ✅ | |
| Remove members | ✅ | | |
| Assign roles | ✅ | | |
| Manage custom roles | ✅ | | |
| Create expenses | ✅ | ✅ | ✅ |
| Approve expenses | ✅ | ✅ | |
| View audit logs | ✅ | ✅ | |
| View analytics | ✅ | ✅ | ✅ |
| Request withdrawals | ✅ | | |
| Approve withdrawals | ✅ | | |

Custom roles with any combination of the above permissions can also be created per group.

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| All money stored as `BigInteger` paise | Eliminates float precision bugs for INR amounts |
| Payment state machine with `VALID_TRANSITIONS` dict | Prevents illegal state jumps (e.g. confirmed → pending) |
| Wallet uses `SELECT FOR UPDATE` | Prevents race conditions on concurrent balance updates |
| Audit logs protected by PostgreSQL RULE | DB-level tamper resistance — even app bugs can't corrupt audit trail |
| Refresh tokens stored as SHA-256 hashes | Token theft doesn't expose the raw token |
| Access tokens in Zustand memory only | Never written to localStorage — mitigates XSS token theft |
| RBAC resolved at query time | Permissions are always current — no stale cached role data |

---

## Roadmap

### Phase 2 (In Progress)
- [ ] Custom rent splits (not just equal)
- [ ] Celery auto-creation of monthly cycles
- [ ] Analytics charts (Recharts)
- [ ] CSV export for ledger/payments
- [ ] Withdrawal flow UI polish
- [ ] Progressive Web App (PWA) support

### Phase 3 (Planned)
- [ ] AWS / Azure deployment guide
- [ ] Push notifications (FCM)
- [ ] Real Twilio OTP integration
- [ ] Multi-currency support

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
