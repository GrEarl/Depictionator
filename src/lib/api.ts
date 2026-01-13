import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

export async function requireApiSession() {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    throw new Error("UNAUTHORIZED");
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true }
  });

  if (!session || session.expiresAt <= new Date()) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}

export async function requireWorkspaceAccess(
  userId: string,
  workspaceId: string,
  role: Parameters<typeof requireWorkspaceRole>[2]
) {
  return requireWorkspaceRole(userId, workspaceId, role);
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
