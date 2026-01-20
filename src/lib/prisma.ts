import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { isDevelopmentMode } from "@/lib/mock-data";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Mock Prisma client for development without DB
function createMockPrismaClient(): PrismaClient {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        // Return a mock model for any Prisma model access
        return new Proxy(
          {},
          {
            get(_modelTarget, method) {
              // Mock all Prisma methods to return empty results
              return async (...args: any[]) => {
                console.log(`[Mock Prisma] ${String(prop)}.${String(method)}()`);

                // Return appropriate mock data based on method
                if (method === 'findUnique' || method === 'findFirst') {
                  return null;
                }
                if (method === 'findMany') {
                  return [];
                }
                if (method === 'count') {
                  return 0;
                }
                if (method === 'create' || method === 'update' || method === 'upsert') {
                  return { id: 'mock-id', ...args[0]?.data };
                }
                if (method === 'delete' || method === 'deleteMany') {
                  return { count: 0 };
                }
                if (method === 'aggregate') {
                  return {};
                }

                return null;
              };
            }
          }
        );
      }
    }
  ) as unknown as PrismaClient;
}

// Build-time dummy client to avoid data collection crashes when DATABASE_URL is unset.
function createPrismaClient() {
  // Use mock client in dev mode when DB is disabled
  if (isDevelopmentMode()) {
    console.log('[Prisma] Using mock client (DEV_SKIP_DB=true)');
    return createMockPrismaClient();
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.includes("dummy")) {
    return new Proxy(
      {},
      {
        get() {
          throw new Error("Prisma client is not available during build time");
        }
      }
    ) as PrismaClient;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
