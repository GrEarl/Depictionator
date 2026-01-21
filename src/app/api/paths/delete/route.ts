import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const pathId = String(form.get("pathId") ?? "");

  if (!workspaceId || !pathId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const path = await prisma.path.findFirst({
    where: { id: pathId, workspaceId, softDeletedAt: null }
  });
  if (!path) {
    return apiError("Path not found", 404);
  }

  const now = new Date();
  await prisma.path.update({
    where: { id: pathId, workspaceId },
    data: { softDeletedAt: now }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "delete",
    targetType: "path",
    targetId: pathId
  });

  await notifyWatchers({
    workspaceId,
    targetType: "map",
    targetId: path.mapId,
    type: "path_deleted",
    payload: { pathId, mapId: path.mapId }
  });

  if (path.relatedEventId) {
    await notifyWatchers({
      workspaceId,
      targetType: "event",
      targetId: path.relatedEventId,
      type: "path_deleted",
      payload: { pathId }
    });
  }

  return NextResponse.json({ ok: true });
}
