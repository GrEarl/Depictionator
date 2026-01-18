import { NextResponse } from "next/server";
import { toRedirectUrl, sanitizeRedirectPath } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { attachSessionCookie, createSession } from "@/lib/auth";
import { MOCK_USER, isDevelopmentMode } from "@/lib/mock-data";

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeRedirectPath(formData.get("next"));

  if (!email || password.length < 8) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Mock mode for development without DB
  if (isDevelopmentMode()) {
    // Just create a session for the mock user
    const session = await createSession(MOCK_USER.id);
    const response = NextResponse.redirect(toRedirectUrl(request, nextPath || "/"));
    attachSessionCookie(response, session.id, session.expiresAt);
    return response;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password)
    }
  });

  const session = await createSession(user.id);
  const response = NextResponse.redirect(toRedirectUrl(request, nextPath || "/"));
  attachSessionCookie(response, session.id, session.expiresAt);
  return response;
}

