#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Exiting."
  exit 1
fi

if [ -d "/app/prisma/migrations" ] && [ "$(ls -A /app/prisma/migrations 2>/dev/null)" ]; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy
else
  echo "No migrations found. Running prisma db push..."
  npx prisma db push
fi

exec "$@"
