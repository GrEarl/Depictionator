import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { NextResponse } from "next/server";
import { MOCK_SESSION, MOCK_USER, MOCK_WORKSPACE_MEMBER, isDevelopmentMode } from "@/lib/mock-data";

export const SESSION_COOKIE = "wl_session";
const SESSION_MAX_AGE_DAYS = Number(process.env.SESSION_MAX_AGE_DAYS ?? "14");

export const getCurrentSession = cache(async () => {
  // Mock mode for development without DB
  if (isDevelopmentMode()) {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    // In dev mode, any session cookie is valid
    if (sessionId) {
      return MOCK_SESSION;
    }
    return null;
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  return prisma.session.findFirst({
    where: {
      id: sessionId,
      expiresAt: { gt: new Date() }
    },
    include: { user: true, workspace: true }
  });
});

export const getCurrentUser = cache(async () => {
  const session = await getCurrentSession();
  return session?.user ?? null;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireWorkspaceMembership(slug: string) {
  // Mock mode for development
  if (isDevelopmentMode()) {
    const user = await requireUser();
    return MOCK_WORKSPACE_MEMBER;
  }

  const user = await requireUser();
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId: user.id,
      workspace: { slug }
    },
    include: { workspace: true }
  });

  if (!membership) redirect("/");
  return membership;
}

export async function createSession(userId: string, activeWorkspaceId?: string | null) {
  // Mock mode for development
  if (isDevelopmentMode()) {
    return {
      ...MOCK_SESSION,
      id: crypto.randomUUID(),
    };
  }

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      activeWorkspaceId: activeWorkspaceId ?? null,
      expiresAt
    }
  });

  return session;
}

export function attachSessionCookie(response: NextResponse, sessionId: string, expiresAt: Date) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    expires: expiresAt
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0)
  });
}
