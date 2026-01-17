#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Exiting."
  exit 1
fi

if [ -d "/app/prisma/migrations" ] && [ "$(ls -A /app/prisma/migrations 2>/dev/null)" ]; then
  echo "Running prisma migrate deploy..."
  node /app/node_modules/prisma/build/index.js migrate deploy
else
  echo "No migrations found. Running prisma db push..."
  node /app/node_modules/prisma/build/index.js db push
fi

exec "$@"
