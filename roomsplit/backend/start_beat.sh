#!/bin/sh
set -e

# ── Database URL transformation ────────────────────────────────────────────
if [ -n "$DATABASE_URL" ]; then
  BASE_URL=$(echo "$DATABASE_URL" | sed 's|^postgresql+[a-z2]*://||; s|^postgresql://||')
  export DATABASE_URL="postgresql+asyncpg://${BASE_URL}"
  export DATABASE_URL_SYNC="postgresql+psycopg2://${BASE_URL}"
fi

echo "Starting Celery beat scheduler..."
exec celery -A app.tasks.celery_app beat --loglevel=info
