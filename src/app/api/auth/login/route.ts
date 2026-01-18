import { NextResponse } from "next/server";
import { toRedirectUrl, sanitizeRedirectPath } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { attachSessionCookie, createSession } from "@/lib/auth";
import { MOCK_USER, isDevelopmentMode } from "@/lib/mock-data";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeRedirectPath(formData.get("next"));

  if (!email || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  // Mock mode for development without DB
  if (isDevelopmentMode()) {
    // Accept any email/password in dev mode
    const session = await createSession(MOCK_USER.id);
    const response = NextResponse.redirect(toRedirectUrl(request, nextPath || "/"));
    attachSessionCookie(response, session.id, session.expiresAt);
    return response;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const session = await createSession(user.id);
  const response = NextResponse.redirect(toRedirectUrl(request, nextPath || "/"));
  attachSessionCookie(response, session.id, session.expiresAt);
  return response;
}

