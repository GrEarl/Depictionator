import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => null);
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  clearSessionCookie(response);
  return response;
}
