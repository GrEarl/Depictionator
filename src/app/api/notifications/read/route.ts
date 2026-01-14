import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { requireApiSession, apiError } from "@/lib/api";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const notificationId = String(form.get("notificationId") ?? "");

  if (!notificationId) {
    return apiError("Missing notificationId", 400);
  }

  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.userId },
    data: { readAt: new Date() }
  });

  return NextResponse.redirect(toRedirectUrl(request, request.headers.get("referer") ?? "/"));
}


