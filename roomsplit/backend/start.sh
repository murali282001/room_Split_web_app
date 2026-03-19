#!/bin/sh
set -e

# ── Database URL transformation ────────────────────────────────────────────
# Railway PostgreSQL provides DATABASE_URL as postgresql://user:pass@host/db
# FastAPI (asyncpg) needs:  postgresql+asyncpg://...
# Alembic (psycopg2) needs: postgresql+psycopg2://...

if [ -n "$DATABASE_URL" ]; then
  BASE_URL=$(echo "$DATABASE_URL" | sed 's|^postgresql+[a-z2]*://||; s|^postgresql://||')
  export DATABASE_URL="postgresql+asyncpg://${BASE_URL}"
  export DATABASE_URL_SYNC="postgresql+psycopg2://${BASE_URL}"
  echo "✓ DATABASE_URL configured for asyncpg"
fi

# ── Run migrations ─────────────────────────────────────────────────────────
echo "Running Alembic migrations..."
alembic upgrade head
echo "✓ Migrations complete"

# ── Start server ───────────────────────────────────────────────────────────
echo "Starting FastAPI server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
