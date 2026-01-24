import { NextResponse } from "next/server";
import { toRedirectUrl, sanitizeRedirectPath } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { attachSessionCookie, createSession } from "@/lib/auth";
import { MOCK_USER, isDevelopmentMode } from "@/lib/mock-data";
import {
  checkAuthRateLimit,
  recordAuthAttempt,
  getRateLimitHeaders
} from "@/lib/rate-limit";

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeRedirectPath(formData.get("next"));

  if (!email || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  // Check rate limit before processing
  const rateLimit = checkAuthRateLimit(request, email);
  if (!rateLimit.allowed) {
    const headers = getRateLimitHeaders(rateLimit);
    return NextResponse.json(
      {
        error: `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
        retryAfter: rateLimit.retryAfter
      },
      { status: 429, headers }
    );
  }

  // Mock mode for development without DB
  if (isDevelopmentMode()) {
    // Accept any email/password in dev mode
    recordAuthAttempt(request, email, true);
    const session = await createSession(MOCK_USER.id);
    const response = NextResponse.redirect(toRedirectUrl(request, nextPath || "/"));
    attachSessionCookie(response, session.id, session.expiresAt);
    return response;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    recordAuthAttempt(request, email, false);
    const headers = getRateLimitHeaders(checkAuthRateLimit(request, email));
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401, headers }
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    recordAuthAttempt(request, email, false);
    const headers = getRateLimitHeaders(checkAuthRateLimit(request, email));
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401, headers }
    );
  }

  // Successful login - reset rate limit
  recordAuthAttempt(request, email, true);

  const session = await createSession(user.id);
  const response = NextResponse.redirect(toRedirectUrl(request, nextPath || "/"));
  attachSessionCookie(response, session.id, session.expiresAt);
  return response;
}
