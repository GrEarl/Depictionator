import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";

function parseBoolean(input: FormDataEntryValue | null) {
  if (input === null) return null;
  const normalized = String(input).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return null;
}

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const mapId = String(form.get("mapId") ?? "");
  const showPathOrder = parseBoolean(form.get("showPathOrder"));

  if (!workspaceId || !mapId || showPathOrder === null) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const map = await prisma.map.findFirst({
    where: { id: mapId, workspaceId, softDeletedAt: null }
  });

  if (!map) {
    return apiError("Map not found", 404);
  }

  await prisma.map.update({
    where: { id: mapId, workspaceId },
    data: { showPathOrder, updatedById: session.userId }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "map",
    targetId: mapId,
    meta: { showPathOrder }
  });

  await notifyWatchers({
    workspaceId,
    targetType: "map",
    targetId: mapId,
    type: "map_updated",
    payload: { mapId, showPathOrder }
  });

  return NextResponse.json({ ok: true, showPathOrder });
}
