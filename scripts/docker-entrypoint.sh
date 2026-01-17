#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is not set. Exiting."
  exit 1
fi

# pgvector拡張を有効化
echo "Enabling pgvector extension..."
npx prisma db execute --stdin <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
SQL

# 新規DBの場合はprisma db pushを使用（マイグレーション履歴の問題を回避）
echo "Running prisma db push..."
npx prisma db push --accept-data-loss

exec "$@"
