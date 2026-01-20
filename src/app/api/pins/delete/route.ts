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
  const pinId = String(form.get("pinId") ?? "");

  if (!workspaceId || !pinId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const pin = await prisma.pin.findFirst({
    where: { id: pinId, workspaceId, softDeletedAt: null }
  });
  if (!pin) {
    return apiError("Pin not found", 404);
  }

  const now = new Date();
  await prisma.pin.update({
    where: { id: pinId, workspaceId },
    data: { softDeletedAt: now }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "delete",
    targetType: "pin",
    targetId: pinId
  });

  await notifyWatchers({
    workspaceId,
    targetType: "map",
    targetId: pin.mapId,
    type: "pin_deleted",
    payload: { pinId, mapId: pin.mapId }
  });

  if (pin.entityId) {
    await notifyWatchers({
      workspaceId,
      targetType: "entity",
      targetId: pin.entityId,
      type: "pin_deleted",
      payload: { pinId }
    });
  }

  return NextResponse.json({ ok: true });
}
