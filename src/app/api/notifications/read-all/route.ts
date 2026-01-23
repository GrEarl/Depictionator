import { NextResponse } from "next/server";
import { requireApiSession, apiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "").trim();

  const where: Record<string, any> = {
    userId: session.userId,
    readAt: null
  };

  if (workspaceId) where.workspaceId = workspaceId;

  await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() }
  });

  return NextResponse.redirect(new URL("/notifications", request.url));
}
