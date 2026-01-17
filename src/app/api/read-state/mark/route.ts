import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { requireApiSession, apiError, requireWorkspaceAccess } from "@/lib/api";

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
  const lastReadRevisionId = String(form.get("lastReadRevisionId") ?? "");

  if (!workspaceId || !targetType || !targetId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "viewer");
  } catch {
    return apiError("Forbidden", 403);
  }

  await prisma.readState.upsert({
    where: {
      userId_workspaceId_targetType_targetId: {
        userId: session.userId,
        workspaceId,
        targetType,
        targetId
      }
    },
    update: {
      lastReadAt: new Date(),
      lastReadRevisionId: lastReadRevisionId || null
    },
    create: {
      userId: session.userId,
      workspaceId,
      targetType,
      targetId,
      lastReadAt: new Date(),
      lastReadRevisionId: lastReadRevisionId || null
    }
  });

  return NextResponse.redirect(toRedirectUrl(request, request.headers.get("referer") ?? "/"));
}


