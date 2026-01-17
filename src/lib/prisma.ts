import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ビルド時（page data collection時）にはダミーのPrismaクライアントを返す
function createPrismaClient() {
  // ビルド時にはPrismaClientを初期化しない（DATABASE_URLがダミーの場合）
  if (process.env.DATABASE_URL?.includes('dummy')) {
    // ダミーのプロキシを返す（ビルド時のエラーを回避）
    return new Proxy({}, {
      get() {
        throw new Error('Prisma client is not available during build time');
      }
    }) as unknown as PrismaClient;
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
