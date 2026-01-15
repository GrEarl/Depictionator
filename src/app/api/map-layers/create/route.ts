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
  const mapId = String(form.get("mapId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const description = parseOptionalString(form.get("description"));
  const color = parseOptionalString(form.get("color"));
  const sortIndex = parseOptionalInt(form.get("sortIndex"));
  const isDefaultRaw = parseOptionalString(form.get("isDefault"));

  if (!workspaceId || !mapId || !name) {
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

  let isDefault = true;
  if (isDefaultRaw !== null) {
    const normalized = isDefaultRaw.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      isDefault = true;
    } else if (["false", "0", "no", "off"].includes(normalized)) {
      isDefault = false;
    } else {
      return apiError("Invalid isDefault", 400);
    }
  }

  const layer = await prisma.mapLayer.create({
    data: {
      workspaceId,
      mapId,
      name,
      description: description || null,
      color: color || null,
      sortIndex: sortIndex ?? null,
      isDefault
    }
  });

  await logAudit({
    workspaceId,
    actorUserId: session.userId,
    action: "create",
    targetType: "map_layer",
    targetId: layer.id,
    meta: { mapId }
  });

  await notifyWatchers({
    workspaceId,
    targetType: "map",
    targetId: mapId,
    type: "map_layer_created",
    payload: { mapLayerId: layer.id, mapId }
  });

  return NextResponse.redirect(toRedirectUrl(request, "/maps"));
}
