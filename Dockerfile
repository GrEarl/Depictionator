# syntax=docker/dockerfile:1
FROM node:20-alpine AS deps
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN PUPPETEER_SKIP_DOWNLOAD=1 PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1 npm ci

FROM node:20-alpine AS builder
ENV PUPPETEER_SKIP_DOWNLOAD=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=1
# ビルドタイムにはダミーのDATABASE_URLを設定（実際の接続は不要）
ENV DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy?schema=public"
# Prisma v7のengine typeをbinaryに設定（ビルド時のPrisma初期化エラーを回避）
ENV PRISMA_CLIENT_ENGINE_TYPE=binary
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_EXECUTABLE_PATH=/usr/lib/chromium/chromium

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && ln -sf /usr/lib/chromium/chromium /usr/bin/chromium-browser \
    && ln -sf /usr/lib/chromium/chromium /usr/bin/chromium

# Standaloneモードの出力をコピー
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
# Prisma CLIとクライアントを明示的にコピー
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
# prisma.config.tsはコピーしない（standaloneではprisma/configモジュールがない）
COPY scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
