# How to Deploy RoomSplit on Railway

## What you will deploy

| # | Service | What it does |
|---|---------|-------------|
| 1 | PostgreSQL | Database |
| 2 | Redis | Background job queue |
| 3 | Backend | The API server (FastAPI) |
| 4 | Celery Worker | Runs background jobs |
| 5 | Celery Beat | Runs scheduled jobs (daily reminders) |
| 6 | Frontend | The website (React) |

---

## STEP 1 — Create a Railway account

1. Go to **https://railway.app**
2. Click **Login** → **Login with GitHub**
3. Authorize Railway to access your GitHub

---

## STEP 2 — Create a new project

1. Click the **+ New Project** button
2. Select **Empty Project**
3. You will see an empty canvas — this is your project

---

## STEP 3 — Add PostgreSQL database

1. Click **+ Add a service** (or the **+** button on the canvas)
2. Select **Database**
3. Select **Add PostgreSQL**
4. A PostgreSQL box appears on the canvas ✅

---

## STEP 4 — Add Redis

1. Click **+** again
2. Select **Database**
3. Select **Add Redis**
4. A Redis box appears on the canvas ✅

---

## STEP 5 — Deploy the Backend (API server)

### 5a. Create the service
1. Click **+** on the canvas
2. Select **GitHub Repo**
3. Select **room_Split_web_app**
4. Click **Add service** — do NOT deploy yet

### 5b. Set the Root Directory ⬅ THIS IS IMPORTANT
1. Click on the new service card
2. Click the **Settings** tab
3. Scroll down to **Build** section
4. Find **Root Directory** → type exactly:
   ```
   roomsplit/backend
   ```
5. Press **Enter** to save

### 5c. Add environment variables
1. Click the **Variables** tab
2. Add these variables one by one (click **+ New Variable** for each):

```
APP_ENV                  =  production
SECRET_KEY               =  (copy the value below)
DATABASE_URL             =  ${{Postgres.DATABASE_URL}}
REDIS_URL                =  ${{Redis.REDIS_URL}}
CELERY_BROKER_URL        =  ${{Redis.REDIS_URL}}
CELERY_RESULT_BACKEND    =  ${{Redis.REDIS_URL}}
OTP_PROVIDER             =  console
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS   = 30
ALLOWED_ORIGINS          =  (leave blank for now — fill in Step 7)
FRONTEND_URL             =  (leave blank for now — fill in Step 7)
```

> **How to generate SECRET_KEY:**
> Go to https://generate-secret.vercel.app/64
> Copy the generated string and paste it as the value

> **What is ${{Postgres.DATABASE_URL}}?**
> Type it exactly like that — Railway will automatically replace it
> with your real database URL. You do NOT need to copy-paste the actual URL.

### 5d. Deploy
1. Click the **Deploy** button
2. Click **Logs** tab — wait for:
   ```
   ✓ Migrations complete
   ✓ Starting FastAPI server
   ```
3. Copy the backend URL shown at the top (looks like `https://xxx.up.railway.app`)

---

## STEP 6 — Deploy the Frontend (website)

### 6a. Create the service
1. Click **+** on the canvas
2. Select **GitHub Repo**
3. Select **room_Split_web_app** again
4. Click **Add service** — do NOT deploy yet

### 6b. Set the Root Directory ⬅ IMPORTANT
1. Click the new service card
2. Click **Settings** tab
3. Scroll to **Build** section
4. Find **Root Directory** → type exactly:
   ```
   roomsplit/frontend
   ```
5. Press **Enter** to save

### 6c. Add environment variable
1. Click the **Variables** tab
2. Add ONE variable:

```
BACKEND_URL  =  https://xxx.up.railway.app
```
> Replace `https://xxx.up.railway.app` with the backend URL you copied in Step 5d

### 6d. Deploy
1. Click **Deploy**
2. Wait for build to complete
3. Copy the frontend URL (looks like `https://yyy.up.railway.app`)

---

## STEP 7 — Update backend with frontend URL

Now that you have the frontend URL, go back to the **backend** service:

1. Click the backend service card
2. Click **Variables** tab
3. Update these two variables:

```
ALLOWED_ORIGINS  =  ["https://yyy.up.railway.app"]
FRONTEND_URL     =  https://yyy.up.railway.app
```
> Replace `https://yyy.up.railway.app` with your real frontend URL

4. Click **Deploy** to apply the changes

---

## STEP 8 — Deploy Celery Worker

1. Click **+** on the canvas
2. Select **GitHub Repo** → **room_Split_web_app**
3. Click **Add service**

### Set Root Directory
1. Click **Settings** tab
2. Set **Root Directory** to:
   ```
   roomsplit/backend
   ```

### Set Custom Start Command
1. Still in **Settings**, scroll to **Deploy** section
2. Find **Custom Start Command** → type:
   ```
   ./start_worker.sh
   ```

### Add Variables
1. Click **Variables** tab
2. Click **Shared Variables** or add the same variables as the backend:
```
APP_ENV               =  production
SECRET_KEY            =  (same value as backend)
DATABASE_URL          =  ${{Postgres.DATABASE_URL}}
REDIS_URL             =  ${{Redis.REDIS_URL}}
CELERY_BROKER_URL     =  ${{Redis.REDIS_URL}}
CELERY_RESULT_BACKEND =  ${{Redis.REDIS_URL}}
```

3. Click **Deploy**

---

## STEP 9 — Deploy Celery Beat

Repeat Step 8 but use this start command instead:
```
./start_beat.sh
```

---

## STEP 10 — Open your app

Go to your **frontend URL** in the browser.

**Test it works:**
1. Enter your phone number
2. Since `OTP_PROVIDER=console`, go to **backend service → Logs tab**
3. Look for a line like: `OTP for +91XXXXXXXXXX: 123456`
4. Enter that code on the website
5. You should reach the Profile Setup page ✅

---

## Something went wrong?

| Problem | Solution |
|---------|----------|
| Build fails with "Railpack" error | Root Directory not set — go to Settings → Build → Root Directory |
| App opens but API calls fail | BACKEND_URL in frontend is wrong or ALLOWED_ORIGINS not updated |
| Can't receive OTP | Check backend Logs tab — OTP is printed there when OTP_PROVIDER=console |
| Database errors | Check backend Logs — migrations may have failed |

---

## Summary of Root Directory settings

| Service | Root Directory | Start Command |
|---------|---------------|---------------|
| Backend | `roomsplit/backend` | (default — uses railway.toml) |
| Frontend | `roomsplit/frontend` | (default — uses railway.toml) |
| Celery Worker | `roomsplit/backend` | `./start_worker.sh` |
| Celery Beat | `roomsplit/backend` | `./start_beat.sh` |
