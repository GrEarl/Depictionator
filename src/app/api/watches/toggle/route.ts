import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { requireApiSession, apiError, requireWorkspaceAccess } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const targetType = String(form.get("targetType") ?? "");
  const targetId = String(form.get("targetId") ?? "");

  if (!workspaceId || !targetType || !targetId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  const existing = await prisma.watch.findFirst({
    where: { workspaceId, userId: session.userId, targetType, targetId }
  });

  if (!existing) {
    await prisma.watch.create({
      data: {
        workspaceId,
        userId: session.userId,
        targetType,
        targetId,
        notifyInApp: true,
        notifyEmail: false
      }
    });
  } else {
    await prisma.watch.update({
      where: { id: existing.id },
      data: { notifyInApp: !existing.notifyInApp }
    });
  }

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "watch_toggle",
    targetType,
    targetId
  });

  return NextResponse.redirect(toRedirectUrl(request, request.headers.get("referer") ?? "/"));
}


