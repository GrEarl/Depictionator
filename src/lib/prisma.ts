import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Build-time dummy client to avoid data collection crashes when DATABASE_URL is unset.
function createPrismaClient() {
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

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
