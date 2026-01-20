#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Exiting."
  exit 1
fi

echo "Enabling pgvector extension..."
npx prisma db execute --stdin <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
SQL

echo "Running prisma db push..."
npx prisma db push --accept-data-loss

exec "$@"