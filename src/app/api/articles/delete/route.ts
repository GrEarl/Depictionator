import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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
  const entityId = String(form.get("entityId") ?? "");

  if (!workspaceId || !entityId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  await prisma.entity.update({
    where: { id: entityId, workspaceId },
    data: { softDeletedAt: new Date(), updatedById: session.userId }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "delete",
    targetType: "entity",
    targetId: entityId
  });

  return NextResponse.redirect(new URL("/articles", request.url));
}
