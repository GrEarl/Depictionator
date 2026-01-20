#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Exiting."
  exit 1
fi

echo "Enabling pgvector extension..."
npx prisma db execute --config /app/prisma.config.ts --stdin <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
SQL

echo "Running prisma db push..."
npx prisma db push --config /app/prisma.config.ts --accept-data-loss

exec "$@"
