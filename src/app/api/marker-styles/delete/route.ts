import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
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
  const styleId = String(form.get("styleId") ?? "");

  if (!workspaceId || !styleId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  await prisma.markerStyle.update({
    where: { id: styleId, workspaceId },
    data: { softDeletedAt: new Date() }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "delete",
    targetType: "marker_style",
    targetId: styleId
  });

  return NextResponse.redirect(toRedirectUrl(request, "/maps"));
}


