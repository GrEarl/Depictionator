import { NextResponse } from "next/server";
import { toRedirectUrl } from "@/lib/redirect";
import { prisma } from "@/lib/db";
import { requireApiSession, requireWorkspaceAccess, apiError } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { notifyWatchers } from "@/lib/notifications";
import { parseOptionalInt, parseOptionalString } from "@/lib/forms";

export async function POST(request: Request) {
  let session;
  try {
    session = await requireApiSession();
  } catch {
    return apiError("Unauthorized", 401);
  }

  const form = await request.formData();
  const workspaceId = String(form.get("workspaceId") ?? "");
  const layerId = String(form.get("layerId") ?? "");

  if (!workspaceId || !layerId) {
    return apiError("Missing fields", 400);
  }

  try {
    await requireWorkspaceAccess(session.userId, workspaceId, "editor");
  } catch {
    return apiError("Forbidden", 403);
  }

  const layer = await prisma.mapLayer.findFirst({
    where: { id: layerId, workspaceId }
  });
  if (!layer) {
    return apiError("Layer not found", 404);
  }

  const data: Record<string, unknown> = {};
  const name = parseOptionalString(form.get("name"));
  if (name !== null) data.name = name;
  const description = parseOptionalString(form.get("description"));
  if (description !== null) data.description = description;
  const color = parseOptionalString(form.get("color"));
  if (color !== null) data.color = color;
  const sortIndex = parseOptionalInt(form.get("sortIndex"));
  if (sortIndex !== null) data.sortIndex = sortIndex;
  const isDefaultRaw = parseOptionalString(form.get("isDefault"));
  if (isDefaultRaw !== null) {
    const normalized = isDefaultRaw.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      data.isDefault = true;
    } else if (["false", "0", "no", "off"].includes(normalized)) {
      data.isDefault = false;
    } else {
      return apiError("Invalid isDefault", 400);
    }
  }

  await prisma.mapLayer.update({ where: { id: layerId, workspaceId }, data });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "update",
    targetType: "map_layer",
    targetId: layerId,
    meta: { mapId: layer.mapId }
  });

  await notifyWatchers({
    workspaceId,
    targetType: "map",
    targetId: layer.mapId,
    type: "map_layer_updated",
    payload: { mapLayerId: layerId, mapId: layer.mapId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/maps"));
}
