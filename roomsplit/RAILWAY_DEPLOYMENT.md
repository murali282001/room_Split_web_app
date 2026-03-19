# Railway Deployment Guide — RoomSplit

## Architecture on Railway

```
Railway Project: RoomSplit
├── 🐘 PostgreSQL          (managed plugin)
├── 🔴 Redis               (managed plugin)
├── ⚡ backend             (FastAPI — roomsplit/backend)
├── 👷 celery-worker       (Celery worker — roomsplit/backend)
├── 🕐 celery-beat         (Celery scheduler — roomsplit/backend)
└── 🌐 frontend            (React + Nginx — roomsplit/frontend)
```

---

## Step 1 — Create Railway Account & Project

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click **New Project**
3. Choose **Empty project**
4. Name it `RoomSplit`

---

## Step 2 — Add PostgreSQL

1. In your Railway project, click **+ New** → **Database** → **Add PostgreSQL**
2. Railway will create the database and provide connection variables automatically
3. Note the variable name: `DATABASE_URL` (auto-set by Railway)

---

## Step 3 — Add Redis

1. Click **+ New** → **Database** → **Add Redis**
2. Railway will provide `REDIS_URL` automatically

---

## Step 4 — Deploy the Backend

1. Click **+ New** → **GitHub Repo**
2. Select your `room_Split_web_app` repository
3. Under **Root Directory**, set it to: `roomsplit/backend`
4. Railway will detect the `Dockerfile` and `railway.toml` automatically
5. Rename this service to `backend`

### Set Backend Environment Variables

In the backend service → **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `APP_ENV` | `production` |
| `SECRET_KEY` | *(generate with `openssl rand -hex 32`)* |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `DATABASE_URL_SYNC` | *(leave blank — auto-set by start.sh)* |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `CELERY_BROKER_URL` | `${{Redis.REDIS_URL}}` |
| `CELERY_RESULT_BACKEND` | `${{Redis.REDIS_URL}}` |
| `OTP_PROVIDER` | `twilio` *(or `console` for testing)* |
| `TWILIO_ACCOUNT_SID` | *(your Twilio SID)* |
| `TWILIO_AUTH_TOKEN` | *(your Twilio auth token)* |
| `TWILIO_FROM_NUMBER` | *(your Twilio phone number)* |
| `ALLOWED_ORIGINS` | *(set after frontend is deployed — see Step 6)* |
| `FRONTEND_URL` | *(set after frontend is deployed — see Step 6)* |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` |

> **How to use Railway variable references:**
> Type `${{Postgres.DATABASE_URL}}` exactly — Railway replaces this with the actual
> PostgreSQL URL at runtime. No copy-pasting of credentials needed.

6. Click **Deploy** — Railway will build the Docker image, run migrations, and start the server
7. Once deployed, copy the backend's **public URL** (e.g. `https://backend-production-xxxx.up.railway.app`)

---

## Step 5 — Deploy Celery Worker & Beat

These reuse the **same Docker image** as the backend but with different start commands.

### Celery Worker

1. Click **+ New** → **GitHub Repo** → same repository
2. Set **Root Directory** to: `roomsplit/backend`
3. Rename service to `celery-worker`
4. Go to **Settings** → **Deploy** → **Custom Start Command**, set:
   ```
   ./start_worker.sh
   ```
5. Add the **same environment variables** as the backend (copy them)

### Celery Beat

1. Click **+ New** → **GitHub Repo** → same repository
2. Set **Root Directory** to: `roomsplit/backend`
3. Rename service to `celery-beat`
4. Go to **Settings** → **Deploy** → **Custom Start Command**, set:
   ```
   ./start_beat.sh
   ```
5. Add the **same environment variables** as the backend

---

## Step 6 — Deploy the Frontend

1. Click **+ New** → **GitHub Repo** → same repository
2. Set **Root Directory** to: `roomsplit/frontend`
3. Railway will detect the `Dockerfile` and `railway.toml` automatically
4. Rename the service to `frontend`

### Set Frontend Environment Variable

In the frontend service → **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `BACKEND_URL` | `https://your-backend-url.up.railway.app` *(the backend public URL from Step 4)* |

> This variable is injected into the Nginx config at startup.
> It tells Nginx where to proxy `/api/` requests.

5. Click **Deploy**
6. Once deployed, copy the frontend's **public URL** (e.g. `https://frontend-production-xxxx.up.railway.app`)

---

## Step 7 — Update CORS on Backend

Now that you have the frontend URL, go back to the **backend** service → **Variables** and update:

| Variable | Value |
|----------|-------|
| `ALLOWED_ORIGINS` | `["https://your-frontend-url.up.railway.app"]` |
| `FRONTEND_URL` | `https://your-frontend-url.up.railway.app` |

Redeploy the backend after updating these values.

---

## Step 8 — Verify Deployment

Open your frontend URL in the browser. To verify each service:

```
✅ Frontend  →  https://your-frontend-url.up.railway.app
✅ Backend   →  https://your-backend-url.up.railway.app/health
✅ API Docs  →  (disabled in production — set APP_ENV=development to re-enable)
```

### Test the full flow:
1. Enter your phone number on the login page
2. If `OTP_PROVIDER=console`, check the **backend service logs** in Railway for the OTP code
3. Enter the OTP → you should be redirected to Profile Setup
4. Create a group and verify rent cycles work

---

## Environment Variable Reference (Complete)

### Backend / Celery Worker / Celery Beat

```env
APP_NAME=RoomSplit
APP_ENV=production
SECRET_KEY=<generate: openssl rand -hex 32>
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CELERY_BROKER_URL=${{Redis.REDIS_URL}}
CELERY_RESULT_BACKEND=${{Redis.REDIS_URL}}

OTP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<your sid>
TWILIO_AUTH_TOKEN=<your token>
TWILIO_FROM_NUMBER=<your number>

FRONTEND_URL=https://your-frontend-url.up.railway.app
ALLOWED_ORIGINS=["https://your-frontend-url.up.railway.app"]
```

### Frontend

```env
BACKEND_URL=https://your-backend-url.up.railway.app
```

---

## Auto-Deploy on Git Push

Railway automatically redeploys all services when you push to `main`.

```bash
git add .
git commit -m "your changes"
git push origin main
# → Railway detects the push and redeploys all services automatically
```

---

## Logs & Debugging

- View real-time logs for any service in the Railway dashboard → service → **Logs** tab
- If migrations fail, check the backend logs for Alembic errors
- If the frontend shows a blank page, check the browser console for API errors
- If OTP isn't working, temporarily set `OTP_PROVIDER=console` and check backend logs

---

## Cost Estimate (Railway)

| Plan | Free Credit | Enough for |
|------|------------|-----------|
| Hobby ($5/mo) | $5 credit/mo | All 6 services for demo/testing |
| Pro ($20/mo) | Unlimited | Production use |

> The free Hobby tier gives $5 of compute credit per month — enough to run all
> services at low traffic. PostgreSQL and Redis plugins count toward this credit.
