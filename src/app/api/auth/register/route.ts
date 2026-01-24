import { NextResponse } from "next/server";
import { toRedirectUrl, sanitizeRedirectPath } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { attachSessionCookie, createSession } from "@/lib/auth";
import { MOCK_USER, isDevelopmentMode } from "@/lib/mock-data";
import {
  checkAuthRateLimit,
  recordAuthAttempt,
  getRateLimitHeaders
} from "@/lib/rate-limit";

// Password constraints
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const nextPath = sanitizeRedirectPath(formData.get("next"));

  // Check rate limit for registration attempts (by IP only, since email may not exist yet)
  const rateLimit = checkAuthRateLimit(request);
  if (!rateLimit.allowed) {
    const headers = getRateLimitHeaders(rateLimit);
    return NextResponse.json(
      {
        error: `Too many registration attempts. Please try again in ${rateLimit.retryAfter} seconds.`,
        retryAfter: rateLimit.retryAfter
      },
      { status: 429, headers }
    );
  }

  // Validate email
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Validate password length (min and max)
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Password must be at most ${MAX_PASSWORD_LENGTH} characters` },
      { status: 400 }
    );
  }

  // Mock mode for development without DB
  if (isDevelopmentMode()) {
    // Just create a session for the mock user
    recordAuthAttempt(request, email, true);
    const session = await createSession(MOCK_USER.id);
    const response = NextResponse.redirect(toRedirectUrl(request, nextPath || "/"));
    attachSessionCookie(response, session.id, session.expiresAt);
    return response;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Record as failed attempt to prevent email enumeration attacks
    recordAuthAttempt(request, email, false);
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      passwordHash: await hashPassword(password)
    }
  });

  // Record successful registration
  recordAuthAttempt(request, email, true);

  const session = await createSession(user.id);
  const response = NextResponse.redirect(toRedirectUrl(request, nextPath || "/"));
  attachSessionCookie(response, session.id, session.expiresAt);
  return response;
}
